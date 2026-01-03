import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, password, bootstrap_key } = await req.json();
    
    // Simple bootstrap protection - only works if no super_admins exist
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    });

    // Check if any super_admins already exist
    const { data: existingAdmins, error: checkError } = await adminClient
      .from("user_roles")
      .select("id")
      .eq("role", "super_admin")
      .limit(1);

    if (checkError) {
      console.error("Error checking for existing admins:", checkError);
      throw new Error("Failed to check for existing admins");
    }

    if (existingAdmins && existingAdmins.length > 0) {
      return new Response(
        JSON.stringify({ error: "Super admin already exists. Use the normal admin creation flow." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate inputs
    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: "Email and password are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Bootstrapping super_admin account:", email);

    // Check if user already exists
    const { data: existingUsers } = await adminClient.auth.admin.listUsers();
    let userId: string;
    
    const existingUser = existingUsers?.users?.find(u => u.email === email);
    
    if (existingUser) {
      // User exists, just add the role
      userId = existingUser.id;
      console.log("User already exists, adding super_admin role:", userId);
    } else {
      // Create the user
      const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          name: "System Admin",
          is_admin_user: true,
        },
      });

      if (createError) {
        console.error("Error creating user:", createError);
        throw new Error(createError.message);
      }
      
      userId = newUser.user.id;
      console.log("Created new user:", userId);
    }

    // Check if profile exists, create if not
    const { data: profile } = await adminClient
      .from("profiles")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (!profile) {
      const { error: profileError } = await adminClient
        .from("profiles")
        .insert({ 
          user_id: userId,
          contact_name: "System Admin",
          business_name: "Cleanda Admin"
        });
      
      if (profileError) {
        console.warn("Error creating profile:", profileError);
      }
    }

    // Add super_admin role
    const { error: roleError } = await adminClient
      .from("user_roles")
      .upsert({ user_id: userId, role: "super_admin" }, { onConflict: "user_id" });

    if (roleError) {
      console.error("Error adding role:", roleError);
      throw new Error("Failed to assign super_admin role");
    }

    console.log("Successfully bootstrapped super_admin:", email);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Super admin account created/restored successfully",
        user_id: userId,
        email
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Bootstrap error:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
