import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ContactRequest {
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("Submit contact function called");

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { name, email, phone, subject, message }: ContactRequest = await req.json();

    console.log("Processing contact submission from:", email);

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

    // Send notification email to admin
    try {
      const adminEmailResponse = await resend.emails.send({
        from: "Deep Clean UK <onboarding@resend.dev>",
        to: ["hello@deepcleanuk.com"],
        subject: `New Contact Form Submission: ${subject}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #1e3a5f;">New Contact Form Submission</h2>
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
        `,
      });

      console.log("Admin notification email sent:", adminEmailResponse);
    } catch (emailError) {
      console.error("Failed to send admin notification email:", emailError);
      // Don't fail the request if email fails - submission is already saved
    }

    // Send confirmation email to user
    try {
      const userEmailResponse = await resend.emails.send({
        from: "Deep Clean UK <onboarding@resend.dev>",
        to: [email],
        subject: "We've received your message - Deep Clean UK",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #1e3a5f;">Thank you for contacting us, ${name}!</h2>
            
            <p>We have received your message and will get back to you within 1-2 business days.</p>
            
            <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p><strong>Your message summary:</strong></p>
              <p><strong>Subject:</strong> ${subject}</p>
              <p style="white-space: pre-wrap;">${message.substring(0, 200)}${message.length > 200 ? "..." : ""}</p>
            </div>
            
            <p>If your inquiry is urgent, please call us at <strong>07757 188 197</strong>.</p>
            
            <p style="margin-top: 30px;">
              Best regards,<br>
              <strong>The Deep Clean UK Team</strong>
            </p>
            
            <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;" />
            
            <p style="color: #666; font-size: 12px;">
              Deep Clean UK is a trading name of Orbit Shade Ltd (Company No. 15337705)<br>
              128 City Road, London, EC1V 2NX
            </p>
          </div>
        `,
      });

      console.log("User confirmation email sent:", userEmailResponse);
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
