import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const FROM_EMAIL = "hello@cleanda.co.uk";
const UNSUBSCRIBE_EMAIL = "unsubscribe@cleanda.co.uk";
const BATCH_SIZE = 50;

interface CampaignRequest {
  subject: string;
  html_body: string;
  source_filter?: string; // 'all' | 'contact_form' | 'cleaning_request' | 'business_inquiry'
  test_email?: string; // If provided, only sends to this email
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify admin authorization
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    
    // Verify the user is an admin
    const userClient = createClient(SUPABASE_URL, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check admin role
    const adminClient = createClient(SUPABASE_URL, supabaseServiceKey);
    const { data: isAdmin } = await adminClient.rpc("is_admin", { _user_id: user.id });
    
    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: "Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { subject, html_body, source_filter, test_email }: CampaignRequest = await req.json();

    if (!subject || !html_body) {
      return new Response(
        JSON.stringify({ error: "Subject and HTML body are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If test email, just send to that email
    if (test_email) {
      const unsubscribeUrl = generateUnsubscribeUrl(test_email);
      const htmlWithUnsubscribe = appendUnsubscribeLink(html_body, unsubscribeUrl);
      
      const { error: sendError } = await resend.emails.send({
        from: `Cleanda <${FROM_EMAIL}>`,
        to: [test_email],
        subject: `[TEST] ${subject}`,
        html: htmlWithUnsubscribe,
        headers: {
          "List-Unsubscribe": `<mailto:${UNSUBSCRIBE_EMAIL}?subject=Unsubscribe>, <${unsubscribeUrl}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      });

      if (sendError) {
        console.error("Test email error:", sendError);
        return new Response(
          JSON.stringify({ error: "Failed to send test email", details: sendError }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, message: "Test email sent", sent_count: 1 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch active subscribers
    let query = adminClient
      .from("email_subscribers")
      .select("email, name")
      .eq("is_active", true);

    if (source_filter && source_filter !== "all") {
      query = query.eq("source", source_filter);
    }

    const { data: subscribers, error: fetchError } = await query;

    if (fetchError) {
      console.error("Error fetching subscribers:", fetchError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch subscribers" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!subscribers || subscribers.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No subscribers found", sent_count: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Sending campaign to ${subscribers.length} subscribers`);

    let sentCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    // Process in batches
    for (let i = 0; i < subscribers.length; i += BATCH_SIZE) {
      const batch = subscribers.slice(i, i + BATCH_SIZE);
      
      const emailPromises = batch.map(async (subscriber) => {
        try {
          const unsubscribeUrl = generateUnsubscribeUrl(subscriber.email);
          const htmlWithUnsubscribe = appendUnsubscribeLink(html_body, unsubscribeUrl);
          
          const { error: sendError } = await resend.emails.send({
            from: `Cleanda <${FROM_EMAIL}>`,
            to: [subscriber.email],
            subject: subject,
            html: htmlWithUnsubscribe,
            headers: {
              "List-Unsubscribe": `<mailto:${UNSUBSCRIBE_EMAIL}?subject=Unsubscribe>, <${unsubscribeUrl}>`,
              "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
            },
          });

          if (sendError) {
            throw sendError;
          }

          // Log the email
          await adminClient.from("email_logs").insert({
            recipient_email: subscriber.email,
            subject: subject,
            template_name: "campaign",
            status: "sent",
          });

          sentCount++;
        } catch (err: any) {
          console.error(`Error sending to ${subscriber.email}:`, err);
          errorCount++;
          errors.push(`${subscriber.email}: ${err.message || "Unknown error"}`);
        }
      });

      await Promise.all(emailPromises);
      
      // Small delay between batches to respect rate limits
      if (i + BATCH_SIZE < subscribers.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    console.log(`Campaign complete: ${sentCount} sent, ${errorCount} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Campaign sent successfully`,
        sent_count: sentCount,
        error_count: errorCount,
        errors: errors.slice(0, 10), // Return first 10 errors
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Campaign error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function generateUnsubscribeUrl(email: string): string {
  const token = btoa(email).replace(/=/g, "");
  return `${SUPABASE_URL}/functions/v1/unsubscribe?email=${encodeURIComponent(email)}&token=${token}`;
}

function appendUnsubscribeLink(html: string, unsubscribeUrl: string): string {
  const unsubscribeFooter = `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top: 30px; border-top: 1px solid #e8ebe9; padding-top: 20px;">
      <tr>
        <td align="center" style="padding: 20px;">
          <p style="color: #888888; font-size: 12px; line-height: 1.5; margin: 0;">
            You're receiving this email because you signed up at Cleanda.<br>
            <a href="${unsubscribeUrl}" style="color: #0B3D2E; text-decoration: underline;">Unsubscribe</a> from these emails.
          </p>
        </td>
      </tr>
    </table>
  `;

  // Try to insert before closing body tag
  if (html.includes("</body>")) {
    return html.replace("</body>", `${unsubscribeFooter}</body>`);
  }
  
  // Otherwise append to end
  return html + unsubscribeFooter;
}
