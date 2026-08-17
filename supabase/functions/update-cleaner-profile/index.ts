import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const allowedServices = new Set(["end-of-tenancy", "move-in-move-out", "one-off-deep", "weekly-routine", "post-construction", "airbnb-short-let"]);

serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers: cors });
  if (request.method !== "POST") return respond({ error: "Method not allowed" }, 405);
  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return respond({ error: "Authentication required" }, 401);
    const url = Deno.env.get("SUPABASE_URL") || "";
    const anon = createClient(url, Deno.env.get("SUPABASE_ANON_KEY") || "");
    const { data: auth, error: authError } = await anon.auth.getUser(authHeader.slice(7));
    if (authError || !auth.user) return respond({ error: "Invalid session" }, 401);

    const body = await request.json();
    const phone = String(body.phone || "").replace(/[\s()-]/g, "").slice(0, 20);
    const postcode = String(body.postcode || "").trim().toUpperCase().slice(0, 10);
    const addressLine1 = String(body.addressLine1 || "").trim().slice(0, 160);
    const addressLine2 = String(body.addressLine2 || "").trim().slice(0, 160) || null;
    const city = String(body.city || "").trim().slice(0, 100);
    const serviceSlugs = Array.isArray(body.serviceSlugs) ? [...new Set(body.serviceSlugs.map(String).filter((slug: string) => allowedServices.has(slug)))] : [];
    if (!/^(?:\+44|0)\d{9,10}$/.test(phone) || !/^([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})$/i.test(postcode) || !addressLine1 || !city || serviceSlugs.length === 0) {
      return respond({ error: "Enter a valid phone number, full address, postcode and at least one cleaning service." }, 400);
    }

    const service = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "");
    const { data: profile, error: profileError } = await service.from("cleaner_profiles").select("id,phone,postcode,has_transport").eq("user_id", auth.user.id).single();
    if (profileError || !profile) return respond({ error: "Cleaner profile not found" }, 404);
    const { data: existingVetting } = await service.from("cleaner_vetting_records").select("address_line_1,address_line_2,city,address_status").eq("cleaner_id", profile.id).maybeSingle();
    const addressChanged = !existingVetting || existingVetting.address_line_1 !== addressLine1 || (existingVetting.address_line_2 || null) !== addressLine2 || existingVetting.city !== city || profile.postcode !== postcode;

    const { error: updateError } = await service.from("cleaner_profiles").update({ phone, postcode, has_transport: Boolean(body.hasTransport), updated_at: new Date().toISOString() }).eq("id", profile.id);
    if (updateError) throw updateError;
    const vettingUpdate: Record<string, unknown> = { cleaner_id: profile.id, address_line_1: addressLine1, address_line_2: addressLine2, city, updated_at: new Date().toISOString() };
    if (addressChanged) vettingUpdate.address_status = existingVetting?.address_status === "approved" ? "replacement_required" : "not_submitted";
    const { error: vettingError } = await service.from("cleaner_vetting_records").upsert(vettingUpdate, { onConflict: "cleaner_id" });
    if (vettingError) throw vettingError;

    const { data: serviceTypes, error: serviceError } = await service.from("service_types").select("id,slug").in("slug", serviceSlugs).eq("is_active", true);
    if (serviceError || !serviceTypes || serviceTypes.length !== serviceSlugs.length) return respond({ error: "One or more selected services are unavailable." }, 400);
    const { error: deleteError } = await service.from("cleaner_service_capabilities").delete().eq("cleaner_id", profile.id);
    if (deleteError) throw deleteError;
    const { error: insertError } = await service.from("cleaner_service_capabilities").insert(serviceTypes.map((item) => ({ cleaner_id: profile.id, service_type_id: item.id })));
    if (insertError) throw insertError;

    await service.from("activity_logs").insert({ user_id: auth.user.id, entity_type: "cleaner_profile", entity_id: profile.id, action: "cleaner_profile_updated", details: { address_changed: addressChanged, service_count: serviceSlugs.length } });
    return respond({ success: true, addressChanged });
  } catch (error) {
    console.error("[UPDATE-CLEANER-PROFILE]", error);
    return respond({ error: "We could not save your profile. Please try again." }, 500);
  }
});
