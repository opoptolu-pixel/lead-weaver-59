import { useState } from "react";
import { Shield, Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface TwoFactorVerifyProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export default function TwoFactorVerify({ onSuccess, onCancel }: TwoFactorVerifyProps) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (code.length !== 6) {
      toast.error("Please enter a valid 6-digit code");
      return;
    }

    setLoading(true);
    try {
      // Get the current MFA factors
      const { data: factorsData, error: factorsError } = await supabase.auth.mfa.listFactors();
      if (factorsError) throw factorsError;

      const totpFactor = factorsData.totp.find(f => f.status === 'verified');
      if (!totpFactor) {
        throw new Error("No verified 2FA factor found");
      }

      // Create a challenge
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: totpFactor.id,
      });
      if (challengeError) throw challengeError;

      // Verify the code
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: totpFactor.id,
        challengeId: challengeData.id,
        code,
      });

      if (verifyError) throw verifyError;

      toast.success("Two-factor authentication verified!");
      onSuccess();
    } catch (error: any) {
      console.error("2FA verification error:", error);
      toast.error(error.message || "Invalid verification code");
      setCode("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={onCancel}
        className="flex items-center gap-1 text-muted-foreground hover:text-foreground text-sm"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to sign in
      </button>

      <div className="text-center">
        <div className="bg-secondary/20 rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
          <Shield className="w-8 h-8 text-secondary" />
        </div>
        <h1 className="font-heading text-2xl font-bold text-foreground mb-2">
          Two-Factor Authentication
        </h1>
        <p className="text-muted-foreground">
          Enter the 6-digit code from your authenticator app
        </p>
      </div>

      <form onSubmit={handleVerify} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="code">Verification Code</Label>
          <Input
            id="code"
            placeholder="000000"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            className="text-center text-3xl tracking-[0.5em] font-mono h-14"
            maxLength={6}
            autoFocus
            autoComplete="one-time-code"
          />
        </div>

        <Button
          type="submit"
          variant="cta"
          size="lg"
          className="w-full"
          disabled={loading || code.length !== 6}
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            "Verify"
          )}
        </Button>
      </form>

      <p className="text-center text-muted-foreground text-sm">
        Open your authenticator app to view your code
      </p>
    </div>
  );
}