import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const email = url.searchParams.get("email");
    const token = url.searchParams.get("token");

    if (!email) {
      return new Response(
        generateHtmlPage("Error", "Invalid unsubscribe link. Email is missing."),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "text/html" } }
      );
    }

    // Simple token validation: base64 encoded email must match
    const expectedToken = btoa(email).replace(/=/g, "");
    if (token !== expectedToken) {
      return new Response(
        generateHtmlPage("Error", "Invalid unsubscribe link."),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "text/html" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Update subscriber status
    const { data, error } = await supabase
      .from("email_subscribers")
      .update({
        is_active: false,
        unsubscribed_at: new Date().toISOString(),
      })
      .eq("email", email)
      .select()
      .single();

    if (error) {
      console.error("Error unsubscribing:", error);
      return new Response(
        generateHtmlPage("Error", "Failed to process unsubscribe request. Please try again."),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "text/html" } }
      );
    }

    if (!data) {
      return new Response(
        generateHtmlPage("Not Found", "Email address not found in our mailing list."),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "text/html" } }
      );
    }

    console.log(`Successfully unsubscribed: ${email}`);

    return new Response(
      generateHtmlPage(
        "Unsubscribed Successfully",
        `You have been successfully unsubscribed from our mailing list. You will no longer receive marketing emails from Deep Clean UK.`,
        true
      ),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "text/html" } }
    );
  } catch (error: any) {
    console.error("Unsubscribe error:", error);
    return new Response(
      generateHtmlPage("Error", "An unexpected error occurred. Please try again later."),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "text/html" } }
    );
  }
});

function generateHtmlPage(title: string, message: string, success = false): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - Deep Clean UK</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background-color: #f0f4f3;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 16px;
      box-shadow: 0 4px 24px rgba(11, 61, 46, 0.08);
      max-width: 480px;
      width: 100%;
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #0B3D2E 0%, #145A44 100%);
      padding: 32px;
      text-align: center;
    }
    .header h1 {
      color: white;
      font-size: 24px;
      font-weight: 700;
    }
    .header p {
      color: #7DD3A8;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-top: 6px;
    }
    .content {
      padding: 40px 32px;
      text-align: center;
    }
    .icon {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 20px;
      font-size: 28px;
    }
    .icon.success { background-color: #E8F5E9; }
    .icon.error { background-color: #FFEBEE; }
    .title {
      font-size: 20px;
      font-weight: 600;
      color: #333;
      margin-bottom: 12px;
    }
    .message {
      color: #666;
      font-size: 15px;
      line-height: 1.6;
    }
    .footer {
      padding: 20px 32px;
      background-color: #fafafa;
      text-align: center;
      border-top: 1px solid #eee;
    }
    .footer a {
      color: #0B3D2E;
      text-decoration: none;
      font-weight: 500;
    }
    .footer a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Deep Clean UK</h1>
      <p>Professional Cleaning Network</p>
    </div>
    <div class="content">
      <div class="icon ${success ? 'success' : 'error'}">
        ${success ? '✓' : '✕'}
      </div>
      <h2 class="title">${title}</h2>
      <p class="message">${message}</p>
    </div>
    <div class="footer">
      <a href="https://deepcleanco.uk">Return to Deep Clean UK</a>
    </div>
  </div>
</body>
</html>`;
}
