import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

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
    const { email, password } = await req.json();

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

    // Create user with email auto-confirmed so they can sign in immediately
    const { data: userData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (createError) {
      console.error("Create user error:", createError);
      if (
        createError.message?.includes("already been registered") ||
        createError.message?.includes("already exists") ||
        createError.status === 422
      ) {
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

    // Sign the user in immediately to get a session
    const { data: sessionData, error: signInError } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError || !sessionData.session) {
      console.error("Sign in error:", signInError);
      // User was created but sign-in failed — they can still sign in manually
      return new Response(
        JSON.stringify({
          message: "Account created! Please sign in.",
          userId: userData.user?.id,
          session: null,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send a welcome email (no action required — not a confirmation gate)
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    const { data: signupClosed } = await supabaseAdmin.rpc("is_closed_account_email", { _email: email });
    if (signupClosed) {
      console.log("Blocked welcome email: recipient account is closed");
    }

    if (resendApiKey && !signupClosed) {
      const currentYear = new Date().getFullYear().toString();
      const userName = email.split("@")[0];

      // Check for a custom welcome email template
      const { data: template } = await supabaseAdmin
        .from("email_templates")
        .select("subject, body")
        .eq("name", "signup_confirmation")
        .eq("is_active", true)
        .single();

      let subject: string;
      let htmlBody: string;

      if (template) {
        subject = template.subject;
        htmlBody = template.body
          .replace(/\{\{user_name\}\}/g, userName)
          .replace(/\{\{confirm_link\}\}/g, "https://cleanda.co.uk/onboarding")
          .replace(/\{\{current_year\}\}/g, currentYear)
          .replace(/\{\{unsubscribe_url\}\}/g, "");
      } else {
        subject = "Welcome to Cleanda — You're All Set!";
        htmlBody = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
            <div style="background: linear-gradient(135deg, #0B3D2E 0%, #145A3E 100%); padding: 32px; text-align: center; border-radius: 12px 12px 0 0;">
              <h1 style="color: #ffffff; font-size: 24px; margin: 0;">🎉 Welcome to Cleanda!</h1>
            </div>
            <div style="padding: 32px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
              <p style="color: #334155; font-size: 16px; line-height: 1.6;">Hi ${userName},</p>
              <p style="color: #334155; font-size: 16px; line-height: 1.6;">Your Cleanda account has been created and you're ready to go. Complete your business profile to start receiving cleaning leads in your area.</p>
              <div style="text-align: center; margin: 32px 0;">
                <a href="https://cleanda.co.uk/onboarding" style="display: inline-block; background: linear-gradient(135deg, #0B3D2E 0%, #145A3E 100%); color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(11, 61, 46, 0.3);">
                  Complete Your Profile →
                </a>
              </div>
              <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin: 24px 0;">
                <p style="color: #166534; font-size: 14px; margin: 0; line-height: 1.5;">
                  <strong>💡 Next steps:</strong><br/>
                  Fill in your business details, get verified, and start unlocking leads near you. No email confirmation needed — you're already in!
                </p>
              </div>
              <p style="color: #94a3b8; font-size: 13px; line-height: 1.6;">If you didn't create this account, please contact us at hello@cleanda.co.uk.</p>
            </div>
            <div style="text-align: center; padding: 16px; color: #94a3b8; font-size: 12px;">
              <p style="margin: 0; line-height: 1.6;">Cleanda is a trading name of Orbit Shade Limited (Company No. 15337705)<br>First Floor, Swan Buildings, 20 Swan Street, Manchester, M4 5JW<br>&copy; ${currentYear} Orbit Shade Limited. All rights reserved.<br><a href="https://cleanda.co.uk/privacy-policy" style="color: #94a3b8;">Privacy Policy</a></p>
            </div>
          </div>
        `;
      }

      try {
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

        // Log the email (best effort)
        await supabaseAdmin.from("email_logs").insert({
          recipient_email: email,
          subject,
          template_name: "signup_welcome",
          status: resendRes.ok ? "sent" : "failed",
          resend_id: resendData.id || null,
        });
      } catch (emailErr) {
        console.error("Welcome email send failed (non-fatal):", emailErr);
      }
    }

    return new Response(
      JSON.stringify({
        message: "Account created! Signing you in…",
        userId: userData.user?.id,
        session: sessionData.session,
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
