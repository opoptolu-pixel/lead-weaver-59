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

    // Generate the password reset link via admin API
    const { data: linkData, error: linkError } =
      await supabaseAdmin.auth.admin.generateLink({
        type: "recovery",
        email,
        options: {
          redirectTo: redirectTo || undefined,
        },
      });

    if (linkError) {
      console.error("Generate link error:", linkError);
      // Don't reveal if user exists or not
      return new Response(
        JSON.stringify({ message: "If an account exists, a reset link has been sent." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch the password_reset email template
    const { data: template } = await supabaseAdmin
      .from("email_templates")
      .select("subject, body")
      .eq("name", "password_reset")
      .eq("is_active", true)
      .single();

    const resetLink = linkData?.properties?.action_link || redirectTo || "";
    const currentYear = new Date().getFullYear().toString();
    const userName = email.split("@")[0]; // fallback name

    let htmlBody: string;
    let subject: string;

    if (template) {
      htmlBody = template.body
        .replace(/\{\{user_name\}\}/g, userName)
        .replace(/\{\{reset_link\}\}/g, resetLink)
        .replace(/\{\{expiry_hours\}\}/g, "24")
        .replace(/\{\{current_year\}\}/g, currentYear)
        .replace(/\{\{unsubscribe_url\}\}/g, "");
      subject = template.subject;
    } else {
      // Fallback if template not found
      subject = "Reset Your Cleanda Password";
      htmlBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #0B3D2E;">Password Reset Request</h2>
          <p>Hi,</p>
          <p>We received a request to reset your password. Click the button below:</p>
          <p><a href="${resetLink}" style="display: inline-block; background-color: #0B3D2E; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 4px;">Reset My Password</a></p>
          <p>This link expires in 24 hours.</p>
          <p style="font-size: 12px; color: #888;">Cleanda Ltd ${currentYear}</p>
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
      template_name: "password_reset",
      status: "sent",
      resend_id: resendData.id || null,
    });

    return new Response(
      JSON.stringify({ message: "If an account exists, a reset link has been sent." }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Password reset error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
