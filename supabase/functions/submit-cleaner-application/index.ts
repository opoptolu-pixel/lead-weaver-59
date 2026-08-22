import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const allowedServices = new Set([
  "end-of-tenancy", "move-in-move-out", "one-off-deep", "weekly-routine",
  "post-construction", "airbnb-short-let",
]);

const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return respond({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return respond({ error: "Authentication required" }, 401);

    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const anon = createClient(url, Deno.env.get("SUPABASE_ANON_KEY") ?? "");
    const { data: authData, error: authError } = await anon.auth.getUser(authHeader.slice(7));
    if (authError || !authData.user) return respond({ error: "Invalid session" }, 401);

    const body = await req.json();
    const fullName = String(body.fullName || "").trim().slice(0, 120);
    const phone = String(body.phone || "").replace(/[\s()-]/g, "").slice(0, 20);
    const postcode = String(body.postcode || "").trim().toUpperCase().slice(0, 10);
    const experience = String(body.experienceSummary || "").trim().slice(0, 2000) || null;
    const addressLine1 = String(body.addressLine1 || "").trim().slice(0, 160);
    const addressLine2 = String(body.addressLine2 || "").trim().slice(0, 160) || null;
    const city = String(body.city || "").trim().slice(0, 100);
    const citizenshipRoute = String(body.citizenshipRoute || "");
    const dateOfBirth = String(body.dateOfBirth || "");
    const shareCode = String(body.rightToWorkShareCode || "").replace(/\s/g, "").toUpperCase();
    const identityPath = String(body.identityPath || "");
    const addressPath = String(body.addressPath || "");
    const serviceSlugs = Array.isArray(body.serviceSlugs)
      ? [...new Set(body.serviceSlugs.map(String).filter((slug: string) => allowedServices.has(slug)))]
      : [];

    if (!fullName || !/^(?:\+44|0)\d{9,10}$/.test(phone) || !/^([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})$/i.test(postcode) || serviceSlugs.length === 0 || !addressLine1 || !city || !["british","irish","other"].includes(citizenshipRoute) || !identityPath || !addressPath) {
      return respond({ error: "Please complete all required application and document fields." }, 400);
    }
    if (citizenshipRoute === "other" && (!/^W[A-Z0-9]{8}$/.test(shareCode) || !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth))) {
      return respond({ error: "Enter the 9-character right-to-work share code beginning W and your date of birth." }, 400);
    }

    const service = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const { data: area, error: areaError } = await service.from("service_areas").select("id").eq("slug", "greater-manchester").eq("status", "active").single();
    if (areaError || !area) throw new Error("Greater Manchester service area is not configured");

    const { data: profile, error: profileError } = await service.from("cleaner_profiles").upsert({
      user_id: authData.user.id,
      full_name: fullName,
      phone,
      postcode,
      experience_summary: experience,
      has_transport: Boolean(body.hasTransport),
      application_status: "pending",
      operational_status: "inactive",
      verification_status: "not_started",
    }, { onConflict: "user_id" }).select("id").single();
    if (profileError) throw profileError;

    const { error: vettingError } = await service.from("cleaner_vetting_records").upsert({
      cleaner_id: profile.id, address_line_1: addressLine1, address_line_2: addressLine2, city,
      citizenship_route: citizenshipRoute, date_of_birth: citizenshipRoute === "other" ? dateOfBirth : null,
      right_to_work_share_code: citizenshipRoute === "other" ? shareCode : null,
      identity_status: "pending_review", address_status: "pending_review", right_to_work_status: "pending_review",
      right_to_work_basis: ["british","irish"].includes(citizenshipRoute) ? "continuous" : "time_limited",
      submitted_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }, { onConflict: "cleaner_id" });
    if (vettingError) throw vettingError;

    await service.from("cleaner_vetting_documents").update({ is_current: false, superseded_at: new Date().toISOString() }).eq("cleaner_id", profile.id).eq("is_current", true).in("document_type", ["identity","proof_of_address"]);
    const { error: documentError } = await service.from("cleaner_vetting_documents").insert([
      { cleaner_id: profile.id, document_type: "identity", file_path: identityPath },
      { cleaner_id: profile.id, document_type: "proof_of_address", file_path: addressPath },
    ]);
    if (documentError) throw documentError;

    const { data: serviceTypes, error: serviceError } = await service.from("service_types").select("id,slug").in("slug", serviceSlugs).eq("is_active", true);
    if (serviceError) throw serviceError;

    await Promise.all([
      service.from("cleaner_service_capabilities").delete().eq("cleaner_id", profile.id),
      service.from("cleaner_service_areas").delete().eq("cleaner_id", profile.id),
    ]);
    if (serviceTypes?.length) {
      const { error } = await service.from("cleaner_service_capabilities").insert(serviceTypes.map((item) => ({ cleaner_id: profile.id, service_type_id: item.id })));
      if (error) throw error;
    }
    const { error: coverageError } = await service.from("cleaner_service_areas").insert({ cleaner_id: profile.id, service_area_id: area.id });
    if (coverageError) throw coverageError;

    await service.from("activity_logs").insert({
      user_id: authData.user.id,
      entity_type: "cleaner_application",
      entity_id: profile.id,
      action: "cleaner_application_submitted",
      details: { full_name: fullName, postcode, service_count: serviceSlugs.length },
    });

    return respond({ success: true, cleanerProfileId: profile.id });
  } catch (error) {
    console.error("[SUBMIT-CLEANER-APPLICATION]", error);
    return respond({ error: "We could not save your application. Please try again." }, 500);
  }
});
