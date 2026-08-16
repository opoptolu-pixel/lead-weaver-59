import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^(?:\+44|0)\d{9,10}$/;
const postcodePattern = /^([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})$/i;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalisePostcode(value: string) {
  const compact = value.replace(/\s+/g, "").toUpperCase();
  return `${compact.slice(0, -3)} ${compact.slice(-3)}`;
}

async function hashValue(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function normalisePhone(value: string) {
  return value.replace(/[\s()-]/g, "");
}

function makeReference() {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const random = crypto.randomUUID().slice(0, 6).toUpperCase();
  return `CLR-${date}-${random}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json();
    const name = String(body.customerName || "").trim().slice(0, 120);
    const email = String(body.customerEmail || "").trim().toLowerCase().slice(0, 254);
    const phone = normalisePhone(String(body.customerPhone || "")).slice(0, 20);
    const rawPostcode = String(body.postcode || "").trim();
    const serviceName = String(body.jobType || "").trim();
    const preferredDateFrom = String(body.preferredDate || body.dateFrom || "").trim();
    const preferredDateTo = String(body.dateTo || "").trim() || null;

    if (!name || !emailPattern.test(email) || !phonePattern.test(phone) || !postcodePattern.test(rawPostcode) || !serviceName || !preferredDateFrom) {
      return json({ error: "Please check the required request details." }, 400);
    }

    const postcode = normalisePostcode(rawPostcode);
    const postcodeResponse = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(postcode)}`);
    if (!postcodeResponse.ok) return json({ error: "We could not verify that postcode." }, 400);

    const postcodeData = await postcodeResponse.json();
    const adminDistrict = postcodeData?.result?.admin_district as string | undefined;
    if (!adminDistrict) return json({ error: "We could not identify the service area for that postcode." }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const sourceIp =
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-real-ip") ||
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "unknown";
    const rateLimitKey = await hashValue(`${sourceIp}:${req.headers.get("user-agent") || "unknown"}`);
    const { data: allowed, error: rateLimitError } = await supabase.rpc(
      "check_public_submission_rate_limit",
      {
        p_key_hash: rateLimitKey,
        p_action: "submit-service-request",
        p_max_requests: 10,
        p_window_minutes: 60,
      },
    );
    if (rateLimitError) {
      console.error("Rate-limit check failed", rateLimitError);
      return json({ error: "Unable to process this request right now." }, 503);
    }
    if (!allowed) {
      return json({ error: "Too many requests. Please try again later.", code: "RATE_LIMITED" }, 429);
    }

    const { data: serviceArea, error: areaError } = await supabase
      .from("service_areas")
      .select("id, name, coverage_values")
      .eq("slug", "greater-manchester")
      .eq("status", "active")
      .single();
    if (areaError || !serviceArea) throw new Error("Active Greater Manchester service area is not configured");

    const coveredDistricts = (serviceArea.coverage_values || []).map((value: string) => value.toLowerCase());
    if (!coveredDistricts.includes(adminDistrict.toLowerCase())) {
      return json({
        error: "OUTSIDE_SERVICE_AREA",
        message: "Cleanda currently serves Greater Manchester. We can let you know when we launch in your area.",
      });
    }

    const { data: serviceType, error: serviceError } = await supabase
      .from("service_types")
      .select("id, name")
      .eq("name", serviceName)
      .eq("is_active", true)
      .single();
    if (serviceError || !serviceType) return json({ error: "That cleaning service is not currently available." }, 400);

    let customer: { id: string } | null = null;
    const { data: emailCustomer } = await supabase
      .from("customers")
      .select("id")
      .ilike("email", email)
      .limit(1)
      .maybeSingle();
    customer = emailCustomer;

    if (!customer) {
      const { data: phoneCustomer } = await supabase
        .from("customers")
        .select("id")
        .eq("phone", phone)
        .limit(1)
        .maybeSingle();
      customer = phoneCustomer;
    }

    if (customer) {
      await supabase.from("customers").update({ name, email, phone }).eq("id", customer.id);
    } else {
      const { data, error } = await supabase
        .from("customers")
        .insert({ name, email, phone })
        .select("id")
        .single();
      if (error) throw error;
      customer = data;
    }

    const { data: address, error: addressError } = await supabase
      .from("customer_addresses")
      .insert({
        customer_id: customer.id,
        address_line_1: body.customerAddress && body.customerAddress !== rawPostcode ? String(body.customerAddress).slice(0, 200) : null,
        city: adminDistrict,
        postcode,
        service_area_id: serviceArea.id,
      })
      .select("id")
      .single();
    if (addressError) throw addressError;

    const reference = makeReference();
    const customerNotes = [body.additionalNotes, body.jobDescription]
      .filter((value) => typeof value === "string" && value.trim())
      .join("\n\n")
      .slice(0, 2000) || null;

    const { data: serviceRequest, error: requestError } = await supabase
      .from("service_requests")
      .insert({
        reference,
        customer_id: customer.id,
        address_id: address.id,
        service_type_id: serviceType.id,
        service_area_id: serviceArea.id,
        preferred_date_from: preferredDateFrom,
        preferred_date_to: preferredDateTo,
        property_type: body.propertyType || null,
        bedrooms: body.bedrooms || null,
        frequency: serviceName === "Weekly Routine Cleaning" ? "weekly" : body.frequency || null,
        customer_notes: customerNotes,
        source: body.source || "direct",
        utm_data: body.utmData || null,
      })
      .select("id, reference")
      .single();
    if (requestError) throw requestError;

    await supabase.from("activity_logs").insert({
      user_id: "00000000-0000-0000-0000-000000000000",
      entity_type: "service_request",
      entity_id: serviceRequest.id,
      action: "service_request_created",
      details: { reference, service: serviceType.name, postcode, service_area: serviceArea.name, source: body.source || "direct" },
    });

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (resendApiKey) {
      const subject = `We received your Cleanda request – ${reference}`;
      const html = `<p>Hi ${name.replaceAll("<", "&lt;")},</p><p>Thanks for requesting <strong>${serviceType.name}</strong> through Cleanda.</p><p>Our team will review your requirements, confirm the price and contact you before anything is booked.</p><p>Your reference is <strong>${reference}</strong>.</p><p>Cleanda – professional cleaning, managed across Greater Manchester.</p>`;
      const emailResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: "Cleanda <hello@cleanda.co.uk>", to: [email], subject, html }),
      });
      const emailResult = await emailResponse.json().catch(() => ({}));
      await supabase.from("email_logs").insert({
        recipient_email: email,
        subject,
        template_name: "service_request_received",
        status: emailResponse.ok ? "sent" : "failed",
        resend_id: emailResult?.id || null,
      });
    }

    return json({ success: true, referenceId: reference, requestId: serviceRequest.id });
  } catch (error) {
    console.error("[SUBMIT-SERVICE-REQUEST]", error);
    return json({ error: "We could not submit your request. Please try again." }, 500);
  }
});
