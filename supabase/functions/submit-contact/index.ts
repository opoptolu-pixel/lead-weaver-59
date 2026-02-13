import { createClient } from "npm:@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const SUPABASE_PROJECT_URL = "https://jqyhiekqqcffiwpctzsi.supabase.co";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Rate limiting configuration
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 3; // 3 requests per minute per IP
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

const getClientIP = (req: Request): string => {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
         req.headers.get("x-real-ip") ||
         req.headers.get("cf-connecting-ip") ||
         "unknown";
};

const checkRateLimit = (ip: string): { allowed: boolean; retryAfter?: number } => {
  const now = Date.now();
  const record = rateLimitMap.get(ip);
  
  // Clean up expired entries periodically
  if (rateLimitMap.size > 1000) {
    for (const [key, value] of rateLimitMap.entries()) {
      if (value.resetAt < now) rateLimitMap.delete(key);
    }
  }
  
  if (!record || record.resetAt < now) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true };
  }
  
  if (record.count >= MAX_REQUESTS_PER_WINDOW) {
    const retryAfter = Math.ceil((record.resetAt - now) / 1000);
    return { allowed: false, retryAfter };
  }
  
  record.count++;
  return { allowed: true };
};

interface ContactRequest {
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
}

// Generate unsubscribe URL with token for one-click unsubscribe
const generateUnsubscribeUrl = (email: string): string => {
  const token = btoa(email);
  return `${SUPABASE_PROJECT_URL}/functions/v1/unsubscribe?email=${encodeURIComponent(email)}&token=${token}`;
};

const handler = async (req: Request): Promise<Response> => {
  console.log("Submit contact function called");

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Check rate limit
    const clientIP = getClientIP(req);
    const rateLimit = checkRateLimit(clientIP);
    
    if (!rateLimit.allowed) {
      console.warn(`Rate limit exceeded for IP: ${clientIP}`);
      return new Response(
        JSON.stringify({ error: "Too many requests. Please try again later." }),
        { 
          status: 429, 
          headers: { 
            "Content-Type": "application/json", 
            "Retry-After": String(rateLimit.retryAfter),
            ...corsHeaders 
          } 
        }
      );
    }

    const { name, email, phone, subject, message }: ContactRequest = await req.json();

    console.log("Processing contact submission from:", email, "IP:", clientIP);

    // Validate required fields
    if (!name || !email || !subject || !message) {
      console.error("Missing required fields");
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.error("Invalid email format");
      return new Response(
        JSON.stringify({ error: "Invalid email format" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Create Supabase client with service role for inserting
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Insert contact submission into database
    const { data: submission, error: dbError } = await supabase
      .from("contact_submissions")
      .insert({
        name,
        email,
        phone: phone || null,
        subject,
        message,
        status: "new",
      })
      .select()
      .single();

    if (dbError) {
      console.error("Database error:", dbError);
      return new Response(
        JSON.stringify({ error: "Failed to save submission" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("Contact submission saved:", submission.id);

    // Add to email list only if not already subscribed (respects unsubscribe status)
    try {
      // First check if user exists and their unsubscribe status
      const { data: existingSubscriber } = await supabase
        .from("email_subscribers")
        .select("id, is_active, unsubscribed_at")
        .eq("email", email)
        .maybeSingle();

      if (!existingSubscriber) {
        // New subscriber - add them
        await supabase
          .from("email_subscribers")
          .insert({
            email: email,
            name: name,
            source: "contact_form",
            source_id: submission.id,
            is_active: true,
          });
        console.log("New email subscriber added:", email);
      } else if (existingSubscriber.unsubscribed_at) {
        // Previously unsubscribed - respect their choice, don't re-subscribe
        console.log("User previously unsubscribed, respecting preference:", email);
      } else {
        // Existing active subscriber - just update name if needed
        await supabase
          .from("email_subscribers")
          .update({ name: name })
          .eq("id", existingSubscriber.id);
        console.log("Email subscriber updated:", email);
      }
    } catch (subError) {
      console.error("Failed to add subscriber (non-blocking):", subError);
    }

    // Send notification email to admin
    try {
      const adminSubject = `New Contact Form Submission: ${subject}`;
      const adminHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #0B3D2E;">New Contact Form Submission</h2>
          <p>You have received a new contact form submission from your website.</p>
          
          <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Name:</strong> ${name}</p>
            <p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
            ${phone ? `<p><strong>Phone:</strong> <a href="tel:${phone}">${phone}</a></p>` : ""}
            <p><strong>Subject:</strong> ${subject}</p>
          </div>
          
          <div style="background: #fff; border: 1px solid #ddd; padding: 20px; border-radius: 8px;">
            <p><strong>Message:</strong></p>
            <p style="white-space: pre-wrap;">${message}</p>
          </div>
          
          <p style="color: #666; font-size: 12px; margin-top: 20px;">
            Submitted at: ${new Date().toLocaleString("en-GB", { timeZone: "Europe/London" })}
          </p>
        </div>
      `;
      const adminPlainText = `New Contact Form Submission\n\nName: ${name}\nEmail: ${email}${phone ? `\nPhone: ${phone}` : ""}\nSubject: ${subject}\n\nMessage:\n${message}\n\nSubmitted at: ${new Date().toLocaleString("en-GB", { timeZone: "Europe/London" })}`;
      
      const adminEmailResponse = await resend.emails.send({
        from: "Cleanda <hello@cleanda.co.uk>",
        to: ["hello@cleanda.co.uk"],
        subject: adminSubject,
        html: adminHtml,
        text: adminPlainText,
      });

      // Log admin notification email
      await supabase
        .from("email_logs")
        .insert({
          template_name: "contact_admin_notification",
          recipient_email: "hello@cleanda.co.uk",
          subject: adminSubject,
          status: "sent",
          resend_id: adminEmailResponse.data?.id || null,
          is_test: false,
        });

      console.log("Admin notification email sent and logged:", adminEmailResponse.data?.id);
    } catch (emailError) {
      console.error("Failed to send admin notification email:", emailError);
      // Don't fail the request if email fails - submission is already saved
    }

    // Send confirmation email to user
    try {
      const userSubject = "We've received your message - Cleanda";
      const unsubscribeUrl = generateUnsubscribeUrl(email);
      
      const userHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 20px; font-family: Arial, sans-serif; background-color: #ffffff; color: #333333; line-height: 1.6;">
  <div style="max-width: 600px; margin: 0 auto;">
    <h2 style="color: #0B3D2E; margin-bottom: 20px;">Thank You, ${name}!</h2>
    
    <p>We have received your message and will get back to you within 1-2 business days.</p>
    
    <div style="margin: 20px 0; padding: 15px; background-color: #f5f5f5; border-left: 4px solid #0B3D2E;">
      <strong>Your message summary:</strong><br>
      Subject: ${subject}<br><br>
      ${message.substring(0, 200)}${message.length > 200 ? "..." : ""}
    </div>
    
    <p>If your inquiry is urgent, please call us at 07757 188 197.</p>
    
    <p>Best regards,<br>The Cleanda Team</p>
    
    <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; font-size: 12px; color: #888888;">
      Cleanda Ltd ${new Date().getFullYear()}<br>
      A trading name of Orbit Shade Ltd (Company No. 15337705)<br>
      128 City Road, London, EC1V 2NX<br>
      <a href="${unsubscribeUrl}" style="color: #888888;">Unsubscribe</a>
    </p>
  </div>
</body>
</html>`;
      
      const userPlainText = `Thank You, ${name}!\n\nWe have received your message and will get back to you within 1-2 business days.\n\nYour message summary:\nSubject: ${subject}\n${message.substring(0, 200)}${message.length > 200 ? "..." : ""}\n\nIf your inquiry is urgent, please call us at 07757 188 197.\n\nBest regards,\nThe Cleanda Team\n\nCleanda Ltd ${new Date().getFullYear()}\nUnsubscribe: ${unsubscribeUrl}`;
      
      const userEmailResponse = await resend.emails.send({
        from: "Cleanda <hello@cleanda.co.uk>",
        to: [email],
        subject: userSubject,
        html: userHtml,
        text: userPlainText,
        headers: {
          "List-Unsubscribe": `<${unsubscribeUrl}>, <mailto:unsubscribe@cleanda.co.uk?subject=Unsubscribe>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          "Organization": "Cleanda Ltd",
        },
      });

      // Log user confirmation email
      await supabase
        .from("email_logs")
        .insert({
          template_name: "contact_user_confirmation",
          recipient_email: email,
          subject: userSubject,
          status: "sent",
          resend_id: userEmailResponse.data?.id || null,
          is_test: false,
        });

      console.log("User confirmation email sent and logged:", userEmailResponse.data?.id);
    } catch (emailError) {
      console.error("Failed to send user confirmation email:", emailError);
      // Don't fail the request if email fails
    }

    return new Response(
      JSON.stringify({ success: true, id: submission.id }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in submit-contact function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
