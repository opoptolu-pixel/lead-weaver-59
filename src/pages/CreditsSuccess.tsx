import { useState, useEffect } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { CheckCircle, Loader2, AlertCircle, Coins } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Logo } from "@/components/Logo";
import { trackCreditPurchase } from "@/lib/analytics";

export default function CreditsSuccess() {
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creditsAdded, setCreditsAdded] = useState(0);
  const [totalCredits, setTotalCredits] = useState(0);
  const { refreshProfile } = useAuth();
  const navigate = useNavigate();

  const sessionId = searchParams.get("session_id");
  const credits = searchParams.get("credits");

  useEffect(() => {
    const verifyCredits = async () => {
      if (!sessionId) {
        setError("Missing payment information");
        setLoading(false);
        return;
      }

      try {
        const { data, error: invokeError } = await supabase.functions.invoke("verify-credits", {
          body: { sessionId },
        });

        if (invokeError) throw invokeError;
        if (data.error) throw new Error(data.error);

        setCreditsAdded(data.creditsAdded);
        setTotalCredits(data.totalCredits);
        
        // Track credit purchase conversion in GA4
        trackCreditPurchase({
          amount: data.amountPaid || data.creditsAdded * 1, // fallback if amount not returned
          credits: data.creditsAdded,
        });
        
        await refreshProfile();
        toast.success(`${data.creditsAdded} credits added to your account!`);
      } catch (err) {
        console.error("Verification error:", err);
        setError(err instanceof Error ? err.message : "Failed to verify payment");
      } finally {
        setLoading(false);
      }
    };

    verifyCredits();
  }, [sessionId, refreshProfile]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-secondary mx-auto mb-4" />
          <p className="text-foreground text-lg">Adding credits to your account...</p>
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
          <Link to="/dashboard">
            <Button variant="cta">Back to Dashboard</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-primary border-b border-border">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-20">
            <Logo size="md" />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        <div className="max-w-lg mx-auto text-center">
          <div className="bg-secondary/20 rounded-full p-4 w-20 h-20 mx-auto mb-6 flex items-center justify-center">
            <CheckCircle className="w-10 h-10 text-secondary" />
          </div>

          <h1 className="font-heading text-3xl font-bold text-foreground mb-4">
            Credits Added!
          </h1>

          <p className="text-muted-foreground text-lg mb-8">
            Your credit pack has been successfully added to your account.
          </p>

          <div className="bg-card rounded-2xl border border-border p-8 mb-8">
            <div className="flex items-center justify-center gap-3 mb-4">
              <Coins className="w-8 h-8 text-secondary" />
              <span className="text-4xl font-bold text-foreground">+{creditsAdded}</span>
            </div>
            <p className="text-muted-foreground">credits added</p>
            
            <div className="mt-6 pt-6 border-t border-border">
              <p className="text-muted-foreground text-sm">Your new balance</p>
              <p className="text-3xl font-bold text-secondary">{totalCredits} credits</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/leads">
              <Button variant="cta" size="lg" className="w-full sm:w-auto">
                Browse Leads
              </Button>
            </Link>
            <Link to="/dashboard">
              <Button variant="outline" size="lg" className="w-full sm:w-auto">
                Go to Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
