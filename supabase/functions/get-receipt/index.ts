import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { jsPDF } from "https://esm.sh/jspdf@2.5.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Lead purchase price is fixed at £20
const LEAD_PRICE_POUNDS = 20;

const generatePDFReceipt = (data: {
  receiptId: string;
  date: string;
  jobType: string;
  postcode: string;
  amount: number;
  customerEmail: string;
  businessName?: string;
}): string => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Colors
  const primaryColor = [26, 54, 93]; // Navy blue
  const accentColor = [34, 197, 94]; // Green
  
  // Header background
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(0, 0, pageWidth, 55, "F");
  
  // Draw text-based logo with gradient effect simulation
  // Green gradient colors
  const greenStart = [74, 222, 128]; // #4ade80
  const greenEnd = [34, 197, 94]; // #22c55e
  
  // Company name "CLEANDA" with green gradient text
  doc.setFontSize(32);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(greenStart[0], greenStart[1], greenStart[2]);
  doc.text("CLEANDA", 15, 32);
  
  // Add a subtle green underline/accent
  doc.setDrawColor(accentColor[0], accentColor[1], accentColor[2]);
  doc.setLineWidth(2);
  doc.line(15, 36, 75, 36);
  
  // Company tagline
  doc.setTextColor(200, 220, 255);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Professional Cleaning Leads", 15, 45);
  
  // Receipt label
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("RECEIPT", pageWidth - 20, 25, { align: "right" });
  
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(200, 220, 255);
  doc.text(`#${data.receiptId.toUpperCase()}`, pageWidth - 20, 35, { align: "right" });
  
  // Receipt details section
  doc.setTextColor(100, 100, 100);
  doc.setFontSize(10);
  doc.text("Receipt Number:", 20, 70);
  doc.text("Date:", 20, 80);
  doc.text("Email:", 20, 90);
  
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold");
  doc.text(data.receiptId.toUpperCase(), 75, 70);
  doc.setFont("helvetica", "normal");
  
  const formattedDate = new Date(data.date).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long", 
    year: "numeric"
  });
  doc.text(formattedDate, 75, 80);
  doc.text(data.customerEmail, 75, 90);
  
  // Divider line
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.5);
  doc.line(20, 100, pageWidth - 20, 100);
  
  // Purchase details header
  doc.setFillColor(248, 250, 252);
  doc.rect(20, 110, pageWidth - 40, 12, "F");
  
  doc.setTextColor(100, 100, 100);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("DESCRIPTION", 25, 118);
  doc.text("AMOUNT", pageWidth - 25, 118, { align: "right" });
  
  // Purchase item
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text("Lead Purchase", 25, 135);
  
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(`Service: ${data.jobType}`, 25, 145);
  doc.text(`Location: ${data.postcode}`, 25, 155);
  
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(11);
  doc.text(`£${data.amount.toFixed(2)}`, pageWidth - 25, 135, { align: "right" });
  
  // Total section
  doc.setDrawColor(220, 220, 220);
  doc.line(20, 170, pageWidth - 20, 170);
  
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(pageWidth - 80, 180, 60, 20, "F");
  
  doc.setTextColor(100, 100, 100);
  doc.setFontSize(10);
  doc.text("Total Paid:", pageWidth - 85, 193, { align: "right" });
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(`£${data.amount.toFixed(2)}`, pageWidth - 50, 193, { align: "center" });
  
  // Payment status badge
  doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
  doc.roundedRect(20, 180, 40, 10, 2, 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("PAID", 40, 187, { align: "center" });
  
  // Footer
  doc.setTextColor(150, 150, 150);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  const footerY = 250;
  doc.text("Thank you for your purchase!", pageWidth / 2, footerY, { align: "center" });
  doc.text("Cleanda Ltd • support@cleanda.com", pageWidth / 2, footerY + 10, { align: "center" });
  doc.text("This is an official receipt for your records.", pageWidth / 2, footerY + 20, { align: "center" });
  
  // Return base64 PDF
  return doc.output("datauristring");
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Use service role key to bypass RLS for reading lead data
  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user?.email) {
      throw new Error("User not authenticated");
    }

    const { leadId } = await req.json();
    
    if (!leadId) {
      throw new Error("Lead ID is required");
    }

    // First get the lead to verify it exists and is unlocked
    const { data: lead, error: leadError } = await supabaseClient
      .from("leads")
      .select("id, job_type, postcode, unlocked_at, unlocked_by, value")
      .eq("id", leadId)
      .single();

    if (leadError || !lead) {
      throw new Error("Lead not found");
    }

    // Check if user is admin
    const { data: userRole } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .in("role", ["admin", "super_admin"])
      .single();

    const isAdmin = !!userRole;

    // Verify the user owns this lead or is an admin
    if (lead.unlocked_by !== user.id && !isAdmin) {
      throw new Error("You don't have access to this lead's receipt");
    }

    // Get the profile of the user who purchased the lead (not necessarily the requester)
    const purchaserUserId = lead.unlocked_by;
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("business_name")
      .eq("user_id", purchaserUserId)
      .single();

    // Get purchaser's email for the receipt
    const { data: purchaserEmail } = await supabaseClient
      .rpc("get_user_email", { user_uuid: purchaserUserId });

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Find the customer in Stripe (use purchaser's email, not requester's)
    const customerEmail = purchaserEmail || user.email;
    const customers = await stripe.customers.list({ email: customerEmail, limit: 1 });
    
    // Generate PDF receipt data - use fixed lead price of £20
    const receiptData = {
      receiptId: lead.id.substring(0, 8),
      date: lead.unlocked_at || new Date().toISOString(),
      jobType: lead.job_type,
      postcode: lead.postcode,
      amount: LEAD_PRICE_POUNDS,
      customerEmail: customerEmail,
      businessName: profile?.business_name || undefined,
    };

    // Try to get Stripe receipt URL first
    if (customers.data.length > 0) {
      const customerId = customers.data[0].id;
      const unlockTime = new Date(lead.unlocked_at).getTime() / 1000;
      
      // Search for payment intents
      const paymentIntents = await stripe.paymentIntents.list({
        customer: customerId,
        created: {
          gte: Math.floor(unlockTime - 3600),
          lte: Math.ceil(unlockTime + 3600),
        },
        limit: 10,
      });

      const successfulPayment = paymentIntents.data.find(
        (pi: { status: string }) => pi.status === "succeeded"
      );

      if (successfulPayment) {
        const charges = await stripe.charges.list({
          payment_intent: successfulPayment.id,
          limit: 1,
        });

        if (charges.data.length > 0 && charges.data[0].receipt_url) {
          return new Response(
            JSON.stringify({
              receipt: {
                type: "stripe",
                receiptUrl: charges.data[0].receipt_url,
                ...receiptData,
              }
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
          );
        }
      }
    }

    // Generate internal PDF receipt
    const pdfDataUri = generatePDFReceipt(receiptData);
    
    return new Response(
      JSON.stringify({
        receipt: {
          type: "pdf",
          pdfData: pdfDataUri,
          ...receiptData,
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );

  } catch (error) {
    console.error("Error getting receipt:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
