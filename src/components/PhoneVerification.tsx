import { useState, useEffect } from "react";
import { Phone, CheckCircle, Clock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { FunctionsHttpError } from "@supabase/supabase-js";

interface PhoneVerificationProps {
  phone: string | null;
  phoneVerified: boolean;
  onVerified: () => void;
  onSavePhone?: () => Promise<void>;
}

export default function PhoneVerification({
  phone,
  phoneVerified,
  onVerified,
  onSavePhone,
}: PhoneVerificationProps) {
  const [localPhone, setLocalPhone] = useState<string | null>(phone);
  const [sendingCode, setSendingCode] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [deliveryMethod, setDeliveryMethod] = useState<string | null>(null);
  const [retryAfter, setRetryAfter] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState<number>(0);

  // Countdown timer effect
  useEffect(() => {
    if (!retryAfter) {
      setCountdown(0);
      return;
    }

    const updateCountdown = () => {
      const remaining = Math.max(0, Math.ceil((retryAfter.getTime() - Date.now()) / 1000));
      setCountdown(remaining);
      if (remaining === 0) {
        setRetryAfter(null);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [retryAfter]);

  // Keep local phone in sync with prop only when codeSent is false
  useEffect(() => {
    if (!codeSent && phone) {
      setLocalPhone(phone);
    }
  }, [phone, codeSent]);

  const handleSendVerificationCode = async () => {
    const phoneToVerify = localPhone || phone;
    
    if (!phoneToVerify) {
      toast.error("Please save your phone number first");
      return;
    }

    setSendingCode(true);
    try {
      // If onSavePhone is provided, save the phone first to ensure it's persisted
      if (onSavePhone) {
        try {
          await onSavePhone();
        } catch (saveError) {
          console.error("Error saving phone:", saveError);
          // Continue anyway - the phone will be passed directly to the function
        }
      }

      // Refresh session before calling protected edge function
      const { error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError) {
        console.error("Session refresh error:", refreshError);
        toast.error("Session expired. Please log in again.");
        setSendingCode(false);
        return;
      }
      
      // Store the phone we're verifying to prevent UI from showing wrong number
      setLocalPhone(phoneToVerify);
      
      const response = await supabase.functions.invoke("send-verification-code", {
        body: { phone: phoneToVerify },
      });

      const { data, error } = response;
      
      console.log("Send verification response:", { data, error });

      // Handle error message from function response body (for non-2xx responses)
      if (data?.error) {
        toast.error(data.error);
        return;
      }

      if (data?.rateLimited && data?.retryAfter) {
        setRetryAfter(new Date(data.retryAfter));
        toast.error("Too many requests. Please wait before trying again.");
        return;
      }

      if (error) {
        console.log("Error object:", error);
        console.log("Error type:", error.constructor?.name);
        
        // For FunctionsHttpError, use the async context.json() method
        if (error instanceof FunctionsHttpError) {
          try {
            const errorData = await error.context.json();
            console.log("Parsed error data:", errorData);
            if (errorData?.error) {
              toast.error(errorData.error);
              setSendingCode(false);
              return;
            }
          } catch (parseError) {
            console.error("Failed to parse error context:", parseError);
          }
        }
        
        throw error;
      }

      setCodeSent(true);
      setDeliveryMethod(data?.deliveryMethod || null);
      toast.success(`Verification code sent via ${data?.deliveryMethod || "message"}!`);
    } catch (error: any) {
      console.error("Error sending code:", error);
      
      // Final fallback - try to extract any error message
      let errorMessage = "Failed to send verification code";
      
      // Check if it's a FunctionsHttpError we haven't handled
      if (error instanceof FunctionsHttpError) {
        try {
          const errorData = await error.context.json();
          if (errorData?.error) {
            errorMessage = errorData.error;
          }
        } catch {
          // Ignore
        }
      } else if (error?.message && !error.message.includes("non-2xx")) {
        errorMessage = error.message;
      }
      
      toast.error(errorMessage);
    } finally {
      setSendingCode(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!verificationCode || verificationCode.length !== 8) {
      toast.error("Please enter a valid 8-character code");
      return;
    }

    setVerifyingCode(true);
    try {
      // Refresh session before calling protected edge function
      const { error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError) {
        console.error("Session refresh error:", refreshError);
        toast.error("Session expired. Please log in again.");
        setVerifyingCode(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke("verify-phone-code", {
        body: { code: verificationCode },
      });

      if (error) throw error;
      toast.success("Phone number verified!");
      setCodeSent(false);
      setVerificationCode("");
      setDeliveryMethod(null);
      onVerified();
    } catch (error: any) {
      console.error("Error verifying code:", error);
      toast.error(error.message || "Invalid verification code");
    } finally {
      setVerifyingCode(false);
    }
  };

  if (phoneVerified && phone) {
    return (
      <div className="flex items-center gap-3 p-4 rounded-xl bg-secondary/10 border border-secondary/30">
        <div className="w-10 h-10 rounded-full bg-secondary/20 flex items-center justify-center">
          <CheckCircle className="w-5 h-5 text-secondary" />
        </div>
        <div>
          <p className="font-semibold text-foreground">Phone Verified</p>
          <p className="text-sm text-muted-foreground">{phone}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0">
          <Phone className="w-5 h-5 text-amber-500" />
        </div>
        <div className="flex-1 space-y-3">
          <div>
            <p className="font-semibold text-foreground">Phone Verification Required</p>
            <p className="text-sm text-muted-foreground">
              Verify your phone number to purchase leads
            </p>
          </div>

          {!(localPhone || phone) && (
            <p className="text-sm text-amber-600">
              Please save your phone number above first
            </p>
          )}

          {(localPhone || phone) && !codeSent && (
            <div className="space-y-3">
              {countdown > 0 && (
                <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-500/10 p-2 rounded-lg">
                  <Clock className="w-4 h-4" />
                  <span>
                    You can request a new code in {Math.floor(countdown / 60)}:{(countdown % 60).toString().padStart(2, '0')}
                  </span>
                </div>
              )}
              <Button
                variant="cta"
                size="sm"
                onClick={handleSendVerificationCode}
                disabled={sendingCode || countdown > 0}
              >
                {sendingCode && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                {countdown > 0 ? "Please Wait" : "Send Verification Code"}
              </Button>
            </div>
          )}

          {codeSent && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Code sent via <span className="font-medium text-secondary">{deliveryMethod || "message"}</span> to {localPhone || phone}
              </p>
              <div className="flex gap-2">
                <Input
                  placeholder="Enter 8-character code"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8))}
                  maxLength={8}
                  className="max-w-[180px] uppercase"
                />
                <Button size="sm" onClick={handleVerifyCode} disabled={verifyingCode}>
                  {verifyingCode ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verify"}
                </Button>
              </div>
              {countdown > 0 ? (
                <p className="text-sm text-amber-500 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Resend available in {Math.floor(countdown / 60)}:{(countdown % 60).toString().padStart(2, '0')}
                </p>
              ) : (
                <button
                  className="text-sm text-secondary hover:underline disabled:opacity-50"
                  onClick={handleSendVerificationCode}
                  disabled={sendingCode}
                >
                  Resend code
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
