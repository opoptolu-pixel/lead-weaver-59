import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Generate a random recovery code
function generateRecoveryCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Excluding similar chars (0, O, I, 1)
  let code = "";
  for (let i = 0; i < 10; i++) {
    if (i === 5) code += "-";
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Simple hash function for recovery codes (using Web Crypto API)
async function hashCode(code: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(code.toLowerCase().replace(/-/g, ""));
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create client with user's token for auth
    const supabaseAuth = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get the user
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, code } = await req.json();

    // Use service role for database operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    if (action === "generate") {
      // Delete existing recovery codes for this user
      await supabaseAdmin
        .from("mfa_recovery_codes")
        .delete()
        .eq("user_id", user.id);

      // Generate 10 new recovery codes
      const codes: string[] = [];
      const insertData: { user_id: string; code_hash: string }[] = [];

      for (let i = 0; i < 10; i++) {
        const code = generateRecoveryCode();
        codes.push(code);
        const hash = await hashCode(code);
        insertData.push({ user_id: user.id, code_hash: hash });
      }

      // Insert hashed codes
      const { error: insertError } = await supabaseAdmin
        .from("mfa_recovery_codes")
        .insert(insertData);

      if (insertError) {
        console.error("Error inserting recovery codes:", insertError);
        return new Response(JSON.stringify({ error: "Failed to generate recovery codes" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Return the plain text codes (only shown once!)
      return new Response(JSON.stringify({ codes }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "verify") {
      if (!code) {
        return new Response(JSON.stringify({ error: "Code is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const codeHash = await hashCode(code);

      // Find matching unused recovery code
      const { data: matchingCode, error: findError } = await supabaseAdmin
        .from("mfa_recovery_codes")
        .select("id")
        .eq("user_id", user.id)
        .eq("code_hash", codeHash)
        .is("used_at", null)
        .maybeSingle();

      if (findError) {
        console.error("Error finding recovery code:", findError);
        return new Response(JSON.stringify({ error: "Failed to verify code" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!matchingCode) {
        return new Response(JSON.stringify({ valid: false, error: "Invalid or already used recovery code" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Mark the code as used
      await supabaseAdmin
        .from("mfa_recovery_codes")
        .update({ used_at: new Date().toISOString() })
        .eq("id", matchingCode.id);

      return new Response(JSON.stringify({ valid: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "count") {
      // Get count of unused recovery codes
      const { count, error: countError } = await supabaseAdmin
        .from("mfa_recovery_codes")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .is("used_at", null);

      if (countError) {
        return new Response(JSON.stringify({ error: "Failed to count codes" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ count: count || 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in mfa-recovery-codes:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
