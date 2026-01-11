import { useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { CheckCircle, Loader2, AlertCircle, Phone, Mail, MapPin, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Logo } from "@/components/Logo";
import { trackLeadUnlock } from "@/lib/analytics";

interface LeadDetails {
  id: string;
  postcode: string;
  job_type: string;
  display_value: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  customer_address: string;
  date: string;
}

interface VerifyResponse {
  success: boolean;
  isNewUser: boolean;
  email: string;
  lead: LeadDetails;
  error?: string;
}

export default function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<VerifyResponse | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const sessionId = searchParams.get("session_id");
  const leadId = searchParams.get("lead_id");

  useEffect(() => {
    const verifyPayment = async () => {
      if (!sessionId || !leadId) {
        setError("Missing payment information");
        setLoading(false);
        return;
      }

      try {
        const { data, error: invokeError } = await supabase.functions.invoke("verify-payment", {
          body: { sessionId, leadId },
        });

        if (invokeError) throw invokeError;
        if (data.error) throw new Error(data.error);

        setResult(data);
        
        // Track lead unlock conversion in GA4
        trackLeadUnlock({
          leadValue: parseFloat(data.lead.display_value?.replace(/[^0-9.]/g, '') || '5'),
          jobType: data.lead.job_type,
        });
        
        toast.success("Lead unlocked successfully!");
      } catch (err) {
        console.error("Verification error:", err);
        setError(err instanceof Error ? err.message : "Failed to verify payment");
      } finally {
        setLoading(false);
      }
    };

    verifyPayment();
  }, [sessionId, leadId]);

  const copyToClipboard = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopiedField(null), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-secondary mx-auto mb-4" />
          <p className="text-foreground text-lg">Verifying your payment...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="bg-destructive/10 rounded-full p-4 w-20 h-20 mx-auto mb-6 flex items-center justify-center">
            <AlertCircle className="w-10 h-10 text-destructive" />
          </div>
          <h1 className="font-heading text-2xl font-bold text-foreground mb-4">
            Something went wrong
          </h1>
          <p className="text-muted-foreground mb-8">{error}</p>
          <Link to="/leads">
            <Button variant="cta">Back to Leads</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (!result) return null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-primary border-b border-border">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-20">
            <Logo size="md" variant="white" linkTo={null} />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        <div className="max-w-2xl mx-auto">
          {/* Success header */}
          <div className="text-center mb-10">
            <div className="bg-secondary/20 rounded-full p-4 w-20 h-20 mx-auto mb-6 flex items-center justify-center">
              <CheckCircle className="w-10 h-10 text-secondary" />
            </div>
            <h1 className="font-heading text-3xl font-bold text-foreground mb-4">
              Lead Unlocked Successfully!
            </h1>
            <p className="text-muted-foreground">
              Here are the full details for your new lead. Contact them as soon as possible!
            </p>
          </div>

          {/* New account info - Passwordless flow */}
          {result.isNewUser && (
            <div className="bg-secondary/10 border border-secondary/30 rounded-xl p-6 mb-8">
              <div className="flex items-start gap-4">
                <div className="bg-secondary/20 rounded-full p-3 flex-shrink-0">
                  <Mail className="w-6 h-6 text-secondary" />
                </div>
                <div>
                  <h2 className="font-heading text-lg font-semibold text-foreground mb-2">
                    Check Your Email to Access Your Account
                  </h2>
                  <p className="text-muted-foreground text-sm mb-3">
                    We've sent a secure login link to <span className="font-semibold text-foreground">{result.email}</span>
                  </p>
                  <p className="text-muted-foreground text-sm">
                    Click the link in your email to access your dashboard where you can manage all your leads, 
                    purchase credits, and track your business performance.
                  </p>
                  <div className="mt-4 p-3 bg-background rounded-lg border border-border">
                    <p className="text-xs text-muted-foreground">
                      <strong>Didn't receive the email?</strong> Check your spam folder, or{" "}
                      <Link to="/auth" className="text-secondary hover:underline font-medium">
                        request a new login link
                      </Link>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Lead details card */}
          <div className="bg-card rounded-2xl shadow-elevated border border-border overflow-hidden">
            <div className="bg-primary text-primary-foreground px-6 py-4">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="font-heading text-xl font-bold">{result.lead.job_type}</h2>
                  <p className="text-primary-foreground/80">{result.lead.postcode}</p>
                </div>
                <div className="text-right">
                  <p className="text-secondary font-bold text-2xl">{result.lead.display_value}</p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Customer name */}
              <div>
                <h3 className="text-muted-foreground text-sm font-medium mb-1">Customer Name</h3>
                <p className="text-foreground text-lg font-semibold">{result.lead.customer_name}</p>
              </div>

              {/* Contact details */}
              <div className="grid md:grid-cols-2 gap-4">
                <div className="flex items-start gap-3 bg-muted/50 rounded-lg p-4">
                  <Phone className="w-5 h-5 text-secondary mt-0.5" />
                  <div className="flex-1">
                    <h3 className="text-muted-foreground text-sm font-medium mb-1">Phone</h3>
                    <a 
                      href={`tel:${result.lead.customer_phone}`}
                      className="text-foreground font-semibold hover:text-secondary transition-colors"
                    >
                      {result.lead.customer_phone}
                    </a>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(result.lead.customer_phone, "phone")}
                  >
                    {copiedField === "phone" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>

                <div className="flex items-start gap-3 bg-muted/50 rounded-lg p-4">
                  <Mail className="w-5 h-5 text-secondary mt-0.5" />
                  <div className="flex-1">
                    <h3 className="text-muted-foreground text-sm font-medium mb-1">Email</h3>
                    <a 
                      href={`mailto:${result.lead.customer_email}`}
                      className="text-foreground font-semibold hover:text-secondary transition-colors break-all"
                    >
                      {result.lead.customer_email}
                    </a>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(result.lead.customer_email, "custEmail")}
                  >
                    {copiedField === "custEmail" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
              </div>

              {/* Address */}
              <div className="flex items-start gap-3 bg-muted/50 rounded-lg p-4">
                <MapPin className="w-5 h-5 text-secondary mt-0.5" />
                <div className="flex-1">
                  <h3 className="text-muted-foreground text-sm font-medium mb-1">Full Address</h3>
                  <p className="text-foreground font-semibold">{result.lead.customer_address}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(result.lead.customer_address, "address")}
                >
                  {copiedField === "address" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-4 mt-8 justify-center">
            <a href={`tel:${result.lead.customer_phone}`}>
              <Button variant="cta" size="lg" className="w-full sm:w-auto gap-2">
                <Phone className="w-5 h-5" />
                Call Now
              </Button>
            </a>
            <Link to="/leads">
              <Button variant="outline" size="lg" className="w-full sm:w-auto">
                Browse More Leads
              </Button>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}