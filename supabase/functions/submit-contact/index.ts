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
      const adminEmailResponse = await resend.emails.send({
        from: "Deep Clean UK <hello@deepcleanco.uk>",
        to: ["hello@deepcleanuk.com"],
        subject: adminSubject,
        html: `
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
        `,
      });

      // Log admin notification email
      await supabase
        .from("email_logs")
        .insert({
          template_name: "contact_admin_notification",
          recipient_email: "hello@deepcleanuk.com",
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
      const userSubject = "We've received your message - Deep Clean UK";
      const userEmailResponse = await resend.emails.send({
        from: "Deep Clean UK <hello@deepcleanco.uk>",
        to: [email],
        subject: userSubject,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #0B3D2E 0%, #145A44 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Thank You, ${name}!</h1>
            </div>
            
            <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e5e5; border-top: none; border-radius: 0 0 12px 12px;">
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
              
              <p style="color: #666; font-size: 12px; text-align: center;">
                © ${new Date().getFullYear()} Deep Clean UK · All rights reserved<br>
                A trading name of Orbit Shade Ltd (Company No. 15337705)<br>
                128 City Road, London, EC1V 2NX<br><br>
                <a href="mailto:unsubscribe@deepcleanco.uk?subject=Unsubscribe" style="color: #888;">Unsubscribe</a>
              </p>
            </div>
          </div>
        `,
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