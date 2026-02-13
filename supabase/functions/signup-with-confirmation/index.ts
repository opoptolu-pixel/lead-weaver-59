import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, password, redirectTo } = await req.json();

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: "Email and password are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (password.length < 6) {
      return new Response(
        JSON.stringify({ error: "Password must be at least 6 characters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check if user already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const userExists = existingUsers?.users?.some(u => u.email === email);
    
    if (userExists) {
      return new Response(
        JSON.stringify({ error: "This email is already registered. Please sign in instead." }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create user WITHOUT auto-confirming email
    const { data: userData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: false,
    });

    if (createError) {
      console.error("Create user error:", createError);
      if (createError.message?.includes("already been registered")) {
        return new Response(
          JSON.stringify({ error: "This email is already registered. Please sign in instead." }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ error: createError.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate a signup confirmation link
    const { data: linkData, error: linkError } =
      await supabaseAdmin.auth.admin.generateLink({
        type: "signup",
        email,
        password,
      });

    if (linkError) {
      console.error("Generate link error:", linkError);
      // User was created but we couldn't generate a confirmation link
      // They can still request a new one later
    }

    // Extract token_hash from the action_link
    let tokenHash = "";
    if (linkData?.properties?.action_link) {
      try {
        const url = new URL(linkData.properties.action_link);
        tokenHash = url.searchParams.get("token") || "";
      } catch {
        console.error("Failed to parse action_link");
      }
    }

    // Build a direct link to our app
    const baseUrl = redirectTo || "https://cleanda.co.uk";
    const appOrigin = baseUrl.replace(/\/auth.*$/, "").replace(/\/$/, "");
    const confirmLink = `${appOrigin}/auth?mode=confirm-signup&token_hash=${tokenHash}&type=signup`;

    console.log("Generated confirmation link for:", email);

    // Fetch the signup_confirmation email template if one exists
    const { data: template } = await supabaseAdmin
      .from("email_templates")
      .select("subject, body")
      .eq("name", "signup_confirmation")
      .eq("is_active", true)
      .single();

    const currentYear = new Date().getFullYear().toString();
    const userName = email.split("@")[0];

    let htmlBody: string;
    let subject: string;

    if (template) {
      htmlBody = template.body
        .replace(/\{\{user_name\}\}/g, userName)
        .replace(/\{\{confirm_link\}\}/g, confirmLink)
        .replace(/\{\{current_year\}\}/g, currentYear)
        .replace(/\{\{unsubscribe_url\}\}/g, "");
      subject = template.subject;
    } else {
      subject = "Confirm Your Cleanda Account";
      htmlBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
          <div style="background: linear-gradient(135deg, #0B3D2E 0%, #145A3E 100%); padding: 32px; text-align: center; border-radius: 12px 12px 0 0;">
            <h1 style="color: #ffffff; font-size: 24px; margin: 0;">✅ Confirm Your Account</h1>
          </div>
          <div style="padding: 32px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
            <p style="color: #334155; font-size: 16px; line-height: 1.6;">Hi${userName ? ` ${userName}` : ''},</p>
            <p style="color: #334155; font-size: 16px; line-height: 1.6;">Welcome to Cleanda! Please confirm your email address to activate your account and start receiving cleaning leads.</p>
            <div style="text-align: center; margin: 32px 0;">
              <a href="${confirmLink}" style="display: inline-block; background: linear-gradient(135deg, #0B3D2E 0%, #145A3E 100%); color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(11, 61, 46, 0.3);">
                Confirm My Account →
              </a>
            </div>
            <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin: 24px 0;">
              <p style="color: #166534; font-size: 14px; margin: 0; line-height: 1.5;">
                <strong>💡 What happens next?</strong><br/>
                Once confirmed, you can complete your business profile, get verified, and start unlocking leads in your area.
              </p>
            </div>
            <p style="color: #94a3b8; font-size: 13px; line-height: 1.6;">If you didn't create this account, you can safely ignore this email.</p>
          </div>
          <div style="text-align: center; padding: 16px; color: #94a3b8; font-size: 12px;">
            <p style="margin: 0;">© ${currentYear} Cleanda Ltd. All rights reserved.</p>
          </div>
        </div>
      `;
    }

    // Send via Resend
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.error("RESEND_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Cleanda <hello@cleanda.co.uk>",
        to: [email],
        subject,
        html: htmlBody,
      }),
    });

    const resendData = await resendRes.json();

    if (!resendRes.ok) {
      console.error("Resend error:", resendData);
      return new Response(
        JSON.stringify({ error: "Failed to send confirmation email" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Log the email
    await supabaseAdmin.from("email_logs").insert({
      recipient_email: email,
      subject,
      template_name: "signup_confirmation",
      status: "sent",
      resend_id: resendData.id || null,
    });

    return new Response(
      JSON.stringify({ 
        message: "Account created! Please check your email to confirm.",
        userId: userData.user?.id,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Signup error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
