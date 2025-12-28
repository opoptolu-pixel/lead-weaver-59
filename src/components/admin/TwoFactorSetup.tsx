import { useState, useEffect } from "react";
import { Shield, ShieldCheck, ShieldOff, Loader2, Copy, Check, AlertTriangle, Key, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface MFAFactor {
  id: string;
  friendly_name?: string;
  factor_type: string;
  status: string;
  created_at: string;
}

interface TwoFactorSetupProps {
  onComplete?: () => void;
}

export default function TwoFactorSetup({ onComplete }: TwoFactorSetupProps) {
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [disabling, setDisabling] = useState(false);
  const [factors, setFactors] = useState<MFAFactor[]>([]);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [showEnrollDialog, setShowEnrollDialog] = useState(false);
  const [showDisableDialog, setShowDisableDialog] = useState(false);
  const [disableCode, setDisableCode] = useState("");
  const [copiedSecret, setCopiedSecret] = useState(false);
  
  // Recovery codes state
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [showRecoveryCodesDialog, setShowRecoveryCodesDialog] = useState(false);
  const [recoveryCodeCount, setRecoveryCodeCount] = useState<number>(0);
  const [generatingCodes, setGeneratingCodes] = useState(false);
  const [copiedCodes, setCopiedCodes] = useState(false);

  useEffect(() => {
    fetchMFAFactors();
  }, []);

  useEffect(() => {
    if (factors.length > 0) {
      fetchRecoveryCodeCount();
    }
  }, [factors]);

  const fetchMFAFactors = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;
      
      // Filter for verified TOTP factors
      const totpFactors = data.totp.filter(f => f.status === 'verified');
      setFactors(totpFactors);
    } catch (error) {
      console.error("Error fetching MFA factors:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRecoveryCodeCount = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await supabase.functions.invoke('mfa-recovery-codes', {
        body: { action: 'count' },
      });

      if (response.data?.count !== undefined) {
        setRecoveryCodeCount(response.data.count);
      }
    } catch (error) {
      console.error("Error fetching recovery code count:", error);
    }
  };

  const generateRecoveryCodes = async () => {
    setGeneratingCodes(true);
    try {
      const response = await supabase.functions.invoke('mfa-recovery-codes', {
        body: { action: 'generate' },
      });

      if (response.error) throw response.error;
      
      if (response.data?.codes) {
        setRecoveryCodes(response.data.codes);
        setShowRecoveryCodesDialog(true);
        setRecoveryCodeCount(response.data.codes.length);
        toast.success("Recovery codes generated successfully");
      }
    } catch (error: any) {
      console.error("Error generating recovery codes:", error);
      toast.error(error.message || "Failed to generate recovery codes");
    } finally {
      setGeneratingCodes(false);
    }
  };

  const copyAllCodes = async () => {
    const codesText = recoveryCodes.join("\n");
    await navigator.clipboard.writeText(codesText);
    setCopiedCodes(true);
    toast.success("Recovery codes copied to clipboard");
    setTimeout(() => setCopiedCodes(false), 2000);
  };

  const downloadCodes = () => {
    const codesText = `Cleanda 2FA Recovery Codes\n${"=".repeat(30)}\n\nKeep these codes in a safe place. Each code can only be used once.\n\n${recoveryCodes.join("\n")}\n\nGenerated: ${new Date().toLocaleString()}`;
    const blob = new Blob([codesText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "cleanda-recovery-codes.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Recovery codes downloaded");
  };

  const startEnrollment = async () => {
    setEnrolling(true);
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'Authenticator App',
      });

      if (error) throw error;

      setQrCode(data.totp.qr_code);
      setSecret(data.totp.secret);
      setFactorId(data.id);
      setShowEnrollDialog(true);
    } catch (error: any) {
      console.error("Error enrolling MFA:", error);
      toast.error(error.message || "Failed to start 2FA enrollment");
    } finally {
      setEnrolling(false);
    }
  };

  const verifyEnrollment = async () => {
    if (!factorId || verificationCode.length !== 6) {
      toast.error("Please enter a valid 6-digit code");
      return;
    }

    setVerifying(true);
    try {
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId,
      });

      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code: verificationCode,
      });

      if (verifyError) throw verifyError;

      toast.success("Two-factor authentication enabled successfully!");
      setShowEnrollDialog(false);
      setQrCode(null);
      setSecret(null);
      setFactorId(null);
      setVerificationCode("");
      
      // Generate recovery codes after successful enrollment
      await fetchMFAFactors();
      await generateRecoveryCodes();
      
      onComplete?.();
    } catch (error: any) {
      console.error("Error verifying MFA:", error);
      toast.error(error.message || "Invalid verification code");
    } finally {
      setVerifying(false);
    }
  };

  const disableMFA = async () => {
    if (factors.length === 0) return;
    
    const factor = factors[0];
    
    setDisabling(true);
    try {
      // First, we need to verify the current code
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: factor.id,
      });

      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: factor.id,
        challengeId: challengeData.id,
        code: disableCode,
      });

      if (verifyError) throw verifyError;

      // Now unenroll the factor
      const { error: unenrollError } = await supabase.auth.mfa.unenroll({
        factorId: factor.id,
      });

      if (unenrollError) throw unenrollError;

      toast.success("Two-factor authentication disabled");
      setShowDisableDialog(false);
      setDisableCode("");
      fetchMFAFactors();
    } catch (error: any) {
      console.error("Error disabling MFA:", error);
      toast.error(error.message || "Failed to disable 2FA. Check your code.");
    } finally {
      setDisabling(false);
    }
  };

  const copySecret = async () => {
    if (secret) {
      await navigator.clipboard.writeText(secret);
      setCopiedSecret(true);
      toast.success("Secret copied to clipboard");
      setTimeout(() => setCopiedSecret(false), 2000);
    }
  };

  const is2FAEnabled = factors.length > 0;

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Two-Factor Authentication
          </CardTitle>
          <CardDescription>
            Add an extra layer of security to your admin account using an authenticator app
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {is2FAEnabled ? (
            <>
              <Alert className="bg-green-500/10 border-green-500/30">
                <ShieldCheck className="h-4 w-4 text-green-500" />
                <AlertDescription className="text-green-400">
                  Two-factor authentication is enabled. Your account is protected.
                </AlertDescription>
              </Alert>
              
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">Authenticator App</p>
                  <p className="text-sm text-muted-foreground">
                    Added on {new Date(factors[0].created_at).toLocaleDateString()}
                  </p>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setShowDisableDialog(true)}
                >
                  <ShieldOff className="w-4 h-4 mr-2" />
                  Disable
                </Button>
              </div>

              {/* Recovery Codes Section */}
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium flex items-center gap-2">
                    <Key className="w-4 h-4" />
                    Recovery Codes
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {recoveryCodeCount > 0 
                      ? `${recoveryCodeCount} unused codes remaining`
                      : "No recovery codes generated"}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={generateRecoveryCodes}
                  disabled={generatingCodes}
                >
                  {generatingCodes ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Key className="w-4 h-4 mr-2" />
                  )}
                  {recoveryCodeCount > 0 ? "Regenerate" : "Generate"}
                </Button>
              </div>

              {recoveryCodeCount > 0 && recoveryCodeCount <= 3 && (
                <Alert className="bg-yellow-500/10 border-yellow-500/30">
                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                  <AlertDescription className="text-yellow-400">
                    You have only {recoveryCodeCount} recovery code{recoveryCodeCount !== 1 ? 's' : ''} left. Consider regenerating new codes.
                  </AlertDescription>
                </Alert>
              )}
            </>
          ) : (
            <>
              <Alert className="bg-yellow-500/10 border-yellow-500/30">
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
                <AlertDescription className="text-yellow-400">
                  Two-factor authentication is not enabled. We strongly recommend enabling it for admin accounts.
                </AlertDescription>
              </Alert>
              
              <Button onClick={startEnrollment} disabled={enrolling}>
                {enrolling ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Shield className="w-4 h-4 mr-2" />
                )}
                Enable Two-Factor Authentication
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Enrollment Dialog */}
      <Dialog open={showEnrollDialog} onOpenChange={setShowEnrollDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Set Up Two-Factor Authentication</DialogTitle>
            <DialogDescription>
              Scan the QR code with your authenticator app (like Google Authenticator or Authy)
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {qrCode && (
              <div className="flex justify-center">
                <img src={qrCode} alt="2FA QR Code" className="w-48 h-48 rounded-lg" />
              </div>
            )}
            
            {secret && (
              <div className="space-y-2">
                <Label className="text-muted-foreground text-sm">
                  Or enter this secret manually:
                </Label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-muted px-3 py-2 rounded text-sm font-mono break-all">
                    {secret}
                  </code>
                  <Button variant="outline" size="sm" onClick={copySecret}>
                    {copiedSecret ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="code">Enter verification code</Label>
              <Input
                id="code"
                placeholder="000000"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="text-center text-2xl tracking-widest font-mono"
                maxLength={6}
              />
              <p className="text-xs text-muted-foreground text-center">
                Enter the 6-digit code from your authenticator app
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEnrollDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={verifyEnrollment} 
              disabled={verifying || verificationCode.length !== 6}
            >
              {verifying ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <ShieldCheck className="w-4 h-4 mr-2" />
              )}
              Verify & Enable
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disable Dialog */}
      <Dialog open={showDisableDialog} onOpenChange={setShowDisableDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Disable Two-Factor Authentication</DialogTitle>
            <DialogDescription>
              Enter your current authenticator code to disable 2FA. This will make your account less secure.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <Alert className="bg-destructive/10 border-destructive/30">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <AlertDescription className="text-destructive">
                Warning: Disabling 2FA reduces the security of your admin account.
              </AlertDescription>
            </Alert>
            
            <div className="space-y-2">
              <Label htmlFor="disableCode">Enter verification code</Label>
              <Input
                id="disableCode"
                placeholder="000000"
                value={disableCode}
                onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="text-center text-2xl tracking-widest font-mono"
                maxLength={6}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDisableDialog(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={disableMFA} 
              disabled={disabling || disableCode.length !== 6}
            >
              {disabling ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <ShieldOff className="w-4 h-4 mr-2" />
              )}
              Disable 2FA
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Recovery Codes Dialog */}
      <Dialog open={showRecoveryCodesDialog} onOpenChange={setShowRecoveryCodesDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="w-5 h-5" />
              Your Recovery Codes
            </DialogTitle>
            <DialogDescription>
              Save these codes in a safe place. Each code can only be used once to regain access if you lose your authenticator.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <Alert className="bg-yellow-500/10 border-yellow-500/30">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              <AlertDescription className="text-yellow-400">
                These codes will only be shown once. Make sure to save them now!
              </AlertDescription>
            </Alert>
            
            <div className="grid grid-cols-2 gap-2 p-4 bg-muted rounded-lg font-mono text-sm">
              {recoveryCodes.map((code, index) => (
                <div key={index} className="p-2 bg-background rounded text-center">
                  {code}
                </div>
              ))}
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={copyAllCodes} className="w-full sm:w-auto">
              {copiedCodes ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
              Copy All
            </Button>
            <Button variant="outline" onClick={downloadCodes} className="w-full sm:w-auto">
              <Download className="w-4 h-4 mr-2" />
              Download
            </Button>
            <Button onClick={() => setShowRecoveryCodesDialog(false)} className="w-full sm:w-auto">
              I've Saved My Codes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
