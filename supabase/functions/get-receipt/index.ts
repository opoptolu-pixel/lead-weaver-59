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

// Hardcoded Cleanda logo as base64 (dark background with green star and white text)
// This is a small optimized PNG of the logo
const CLEANDA_LOGO_BASE64 = "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";

// Helper function for text-based logo fallback
const drawTextLogo = (doc: jsPDF, accentGreen: number[]) => {
  // Draw star symbol using green
  doc.setFontSize(20);
  doc.setTextColor(accentGreen[0], accentGreen[1], accentGreen[2]);
  doc.text("✦", 15, 30);
  
  // Draw "Cleanda" text in white
  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text("Cleanda", 28, 30);
};

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
  
  // Brand colors matching the Cleanda logo
  const headerBg = [30, 41, 59]; // Dark navy (#1e293b)
  const accentGreen = [74, 222, 128]; // Green (#4ade80)
  const primaryColor = [26, 54, 93]; // Navy blue
  
  // Header background - dark navy to match logo
  doc.setFillColor(headerBg[0], headerBg[1], headerBg[2]);
  doc.rect(0, 0, pageWidth, 50, "F");
  
  // Add the hardcoded logo
  try {
    doc.addImage(`data:image/png;base64,${CLEANDA_LOGO_BASE64}`, "PNG", 15, 12, 55, 26);
  } catch (e) {
    console.error("Error adding logo image:", e);
    drawTextLogo(doc, accentGreen);
  }
  
  // Receipt label box on the right
  doc.setFillColor(accentGreen[0], accentGreen[1], accentGreen[2]);
  doc.roundedRect(pageWidth - 70, 12, 55, 26, 3, 3, "F");
  
  doc.setTextColor(headerBg[0], headerBg[1], headerBg[2]);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("RECEIPT", pageWidth - 42.5, 22, { align: "center" });
  
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`#${data.receiptId.toUpperCase()}`, pageWidth - 42.5, 32, { align: "center" });
  
  // Receipt details section
  doc.setTextColor(100, 100, 100);
  doc.setFontSize(10);
  doc.text("Receipt Number:", 20, 65);
  doc.text("Date:", 20, 75);
  doc.text("Email:", 20, 85);
  
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold");
  doc.text(data.receiptId.toUpperCase(), 75, 65);
  doc.setFont("helvetica", "normal");
  
  const formattedDate = new Date(data.date).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long", 
    year: "numeric"
  });
  doc.text(formattedDate, 75, 75);
  doc.text(data.customerEmail, 75, 85);
  
  // Divider line
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.5);
  doc.line(20, 95, pageWidth - 20, 95);
  
  // Purchase details header
  doc.setFillColor(248, 250, 252);
  doc.rect(20, 105, pageWidth - 40, 12, "F");
  
  doc.setTextColor(100, 100, 100);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("DESCRIPTION", 25, 113);
  doc.text("AMOUNT", pageWidth - 25, 113, { align: "right" });
  
  // Purchase item
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text("Lead Purchase", 25, 130);
  
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(`Service: ${data.jobType}`, 25, 140);
  doc.text(`Location: ${data.postcode}`, 25, 150);
  
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(11);
  doc.text(`£${data.amount.toFixed(2)}`, pageWidth - 25, 130, { align: "right" });
  
  // Total section
  doc.setDrawColor(220, 220, 220);
  doc.line(20, 165, pageWidth - 20, 165);
  
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(pageWidth - 80, 175, 60, 20, "F");
  
  doc.setTextColor(100, 100, 100);
  doc.setFontSize(10);
  doc.text("Total Paid:", pageWidth - 85, 188, { align: "right" });
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(`£${data.amount.toFixed(2)}`, pageWidth - 50, 188, { align: "center" });
  
  // Payment status badge
  doc.setFillColor(accentGreen[0], accentGreen[1], accentGreen[2]);
  doc.roundedRect(20, 175, 40, 10, 2, 2, "F");
  doc.setTextColor(headerBg[0], headerBg[1], headerBg[2]);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("PAID", 40, 182, { align: "center" });
  
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
