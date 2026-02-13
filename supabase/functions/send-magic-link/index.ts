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
    const { email, redirectTo } = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: "Email is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Generate magic link via admin API
    const { data: linkData, error: linkError } =
      await supabaseAdmin.auth.admin.generateLink({
        type: "magiclink",
        email,
      });

    if (linkError) {
      console.error("Generate link error:", linkError);
      // Don't reveal if user exists or not
      return new Response(
        JSON.stringify({ message: "If an account exists, a login link has been sent." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract token_hash from the action_link
    const actionLink = linkData?.properties?.action_link || "";
    let tokenHash = "";
    try {
      const url = new URL(actionLink);
      tokenHash = url.searchParams.get("token") || "";
    } catch {
      console.error("Failed to parse action_link:", actionLink);
    }

    // Build a direct link to our app's auth page with the token
    const baseUrl = redirectTo || "https://cleanda.co.uk";
    const appOrigin = baseUrl.replace(/\/auth.*$/, "").replace(/\/$/, "");
    const magicLink = `${appOrigin}/auth?mode=magic-verify&token_hash=${tokenHash}&type=magiclink`;

    console.log("Generated magic link for app:", magicLink);

    // Fetch a magic_link email template if one exists
    const { data: template } = await supabaseAdmin
      .from("email_templates")
      .select("subject, body")
      .eq("name", "magic_link")
      .eq("is_active", true)
      .single();

    const currentYear = new Date().getFullYear().toString();
    const userName = email.split("@")[0];

    let htmlBody: string;
    let subject: string;

    if (template) {
      htmlBody = template.body
        .replace(/\{\{user_name\}\}/g, userName)
        .replace(/\{\{magic_link\}\}/g, magicLink)
        .replace(/\{\{current_year\}\}/g, currentYear)
        .replace(/\{\{unsubscribe_url\}\}/g, "");
      subject = template.subject;
    } else {
      subject = "Your Cleanda Login Link";
      htmlBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
          <div style="background: linear-gradient(135deg, #0B3D2E 0%, #145A3E 100%); padding: 32px; text-align: center; border-radius: 12px 12px 0 0;">
            <h1 style="color: #ffffff; font-size: 24px; margin: 0;">🔐 One-Time Login Link</h1>
          </div>
          <div style="padding: 32px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
            <p style="color: #334155; font-size: 16px; line-height: 1.6;">Hi${userName ? ` ${userName}` : ''},</p>
            <p style="color: #334155; font-size: 16px; line-height: 1.6;">Click the button below to securely sign in to your Cleanda account:</p>
            <div style="text-align: center; margin: 32px 0;">
              <a href="${magicLink}" style="display: inline-block; background: linear-gradient(135deg, #0B3D2E 0%, #145A3E 100%); color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(11, 61, 46, 0.3);">
                Log In →
              </a>
            </div>
            <p style="color: #64748b; font-size: 14px; line-height: 1.6;">This link expires in 24 hours and can only be used once.</p>
            <p style="color: #94a3b8; font-size: 13px; line-height: 1.6;">If you didn't request this, you can safely ignore this email.</p>
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
        JSON.stringify({ error: "Failed to send email" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Log the email
    await supabaseAdmin.from("email_logs").insert({
      recipient_email: email,
      subject,
      template_name: "magic_link",
      status: "sent",
      resend_id: resendData.id || null,
    });

    return new Response(
      JSON.stringify({ message: "If an account exists, a login link has been sent." }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Magic link error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
