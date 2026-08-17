import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

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
    const addressLine1 = String(body.addressLine1 || "").trim().slice(0, 160);
    const addressLine2 = String(body.addressLine2 || "").trim().slice(0, 160) || null;
    const city = String(body.city || "").trim().slice(0, 100);
    const route = String(body.citizenshipRoute || "");
    const dob = String(body.dateOfBirth || "");
    const shareCode = String(body.rightToWorkShareCode || "").replace(/\s/g, "").toUpperCase();
    const identityPath = String(body.identityPath || "");
    const addressPath = String(body.addressPath || "");
    const dbsPath = body.dbsPath ? String(body.dbsPath) : null;
    const ownedPrefix = `${auth.user.id}/cleaner-vetting/`;
    if (!addressLine1 || !city || !["british", "irish", "other"].includes(route) || !identityPath.startsWith(ownedPrefix) || !addressPath.startsWith(ownedPrefix) || (dbsPath && !dbsPath.startsWith(ownedPrefix))) return respond({ error: "Complete all required fields and upload valid documents." }, 400);
    if (route === "other" && (!/^W[A-Z0-9]{8}$/.test(shareCode) || !/^\d{4}-\d{2}-\d{2}$/.test(dob))) return respond({ error: "Enter your date of birth and the 9-character right-to-work share code beginning W." }, 400);

    const service = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "");
    const { data: profile, error: profileError } = await service.from("cleaner_profiles").select("id").eq("user_id", auth.user.id).single();
    if (profileError || !profile) return respond({ error: "Cleaner profile not found" }, 404);

    const vettingUpdate: Record<string, unknown> = {
      cleaner_id: profile.id, address_line_1: addressLine1, address_line_2: addressLine2, city, citizenship_route: route,
      date_of_birth: route === "other" ? dob : null, right_to_work_share_code: route === "other" ? shareCode : null,
      identity_status: "pending_review", address_status: "pending_review", right_to_work_status: "pending_review",
      right_to_work_basis: route === "other" ? "time_limited" : "continuous", right_to_work_expires_on: null,
      submitted_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    };
    if (dbsPath) vettingUpdate.dbs_status = "pending_review";
    const { error: vettingError } = await service.from("cleaner_vetting_records").upsert(vettingUpdate, { onConflict: "cleaner_id" });
    if (vettingError) throw vettingError;

    const replacements = [{ document_type: "identity", file_path: identityPath }, { document_type: "proof_of_address", file_path: addressPath }, ...(dbsPath ? [{ document_type: "dbs", file_path: dbsPath }] : [])];
    for (const replacement of replacements) {
      const { error: supersedeError } = await service.from("cleaner_vetting_documents").update({ is_current: false, superseded_at: new Date().toISOString() }).eq("cleaner_id", profile.id).eq("document_type", replacement.document_type).eq("is_current", true);
      if (supersedeError) throw supersedeError;
    }
    const { error: documentError } = await service.from("cleaner_vetting_documents").insert(replacements.map((document) => ({ cleaner_id: profile.id, ...document })));
    if (documentError) throw documentError;

    await service.from("activity_logs").insert({ user_id: auth.user.id, entity_type: "cleaner_vetting", entity_id: profile.id, action: "cleaner_vetting_submitted", details: { citizenship_route: route, dbs_supplied: Boolean(dbsPath) } });
    return respond({ success: true });
  } catch (error) {
    console.error("[SUBMIT-CLEANER-VETTING]", error);
    return respond({ error: "We could not submit your documents. Please try again." }, 500);
  }
});
