import { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Mail, Lock, Loader2, Eye, EyeOff, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import TwoFactorVerify from "@/components/TwoFactorVerify";
import { SEOHead } from "@/components/SEOHead";
import { trackCleanerSignup } from "@/lib/analytics";

const authSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const emailSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

type AuthMode = "login" | "signup" | "forgot" | "magic" | "2fa" | "update-password" | "magic-verify" | "confirm-signup";

export default function Auth() {
  const [searchParams] = useSearchParams();
  const modeParam = searchParams.get("mode");
  const tokenHash = searchParams.get("token_hash");
  const tokenType = searchParams.get("type");
  const initialMode: AuthMode = modeParam === "signup" ? "signup" : modeParam === "update-password" ? "update-password" : modeParam === "magic-verify" ? "magic-verify" : modeParam === "confirm-signup" ? "confirm-signup" : "login";
  
  
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [tokenVerified, setTokenVerified] = useState(false);
  const [tokenVerifying, setTokenVerifying] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; newPassword?: string }>({});
  const [needsMfaForReset, setNeedsMfaForReset] = useState(false);
  const verifyingRef = useRef(false);
  const { signIn, signUp, user } = useAuth();
  const navigate = useNavigate();

  // Verify recovery token when arriving with token_hash
  useEffect(() => {
    if (mode === "update-password" && tokenHash && tokenType === "recovery" && !tokenVerified && !tokenVerifying && !verifyingRef.current) {
      verifyingRef.current = true;
      setTokenVerifying(true);
      supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: "recovery",
      }).then(async ({ data, error }) => {
        setTokenVerifying(false);
        if (error) {
          console.error("Token verification failed:", error);
          toast.error("This reset link is invalid or has expired. Please request a new one.");
          setMode("forgot");
        } else {
          // Only check MFA for admin users
          const userId = data.user?.id;
          let isAdmin = false;
          if (userId) {
            const { data: roleData } = await supabase.from('user_roles').select('role').eq('user_id', userId);
            isAdmin = roleData?.some(r => r.role === 'admin' || r.role === 'super_admin') ?? false;
          }
          if (isAdmin) {
            const { data: factorsData } = await supabase.auth.mfa.listFactors();
            const hasVerifiedFactors = factorsData?.totp?.some(f => f.status === 'verified');
            if (hasVerifiedFactors) {
              const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
              if (aalData?.nextLevel === 'aal2' && aalData?.currentLevel === 'aal1') {
                setNeedsMfaForReset(true);
                toast.info("Please verify your 2FA to continue resetting your password.");
                return;
              }
            }
          }
          setTokenVerified(true);
          toast.success("Token verified! Please set your new password.");
        }
      });
    }
  }, [mode, tokenHash, tokenType, tokenVerified, tokenVerifying]);

  // Redirect if already logged in (skip during special flows)
  useEffect(() => {
    if (user && mode !== "2fa" && mode !== "update-password" && mode !== "magic-verify" && mode !== "confirm-signup" && !needsMfaForReset && !tokenHash) {
      navigate("/dashboard");
    }
  }, [user, mode, navigate, needsMfaForReset, tokenHash]);

  const validateForm = () => {
    try {
      if (mode === "forgot" || mode === "magic") {
        emailSchema.parse({ email });
      } else {
        authSchema.parse({ email, password });
      }
      setErrors({});
      return true;
    } catch (err) {
      if (err instanceof z.ZodError) {
        const fieldErrors: { email?: string; password?: string } = {};
        err.errors.forEach((error) => {
          if (error.path[0] === "email") fieldErrors.email = error.message;
          if (error.path[0] === "password") fieldErrors.password = error.message;
        });
        setErrors(fieldErrors);
      }
      return false;
    }
  };

  const handleForgotPassword = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-password-reset`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            redirectTo: `${window.location.origin}/auth`,
          }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        toast.error(data.error || "Failed to send reset email.");
        return;
      }

      toast.success("Password reset email sent! Check your inbox.");
      setMode("login");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (newPassword.length < 6) {
      setErrors({ newPassword: "Password must be at least 6 characters" });
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrors({ newPassword: "Passwords do not match" });
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Password updated successfully! You can now sign in.");
      setMode("login");
      setNewPassword("");
      setConfirmPassword("");
    } finally {
      setLoading(false);
    }
  };

  const handleMagicLink = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-magic-link`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            redirectTo: `${window.location.origin}/auth`,
          }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        toast.error(data.error || "Failed to send login link.");
        return;
      }
      
      toast.success("Login link sent! Check your email to sign in.");
    } finally {
      setLoading(false);
    }
  };

  // Verify magic link token when arriving with magic-verify mode
  useEffect(() => {
    if (mode === "magic-verify" && tokenHash && tokenType === "magiclink" && !tokenVerified && !tokenVerifying && !verifyingRef.current) {
      verifyingRef.current = true;
      setTokenVerifying(true);
      supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: "magiclink",
      }).then(async ({ data, error }) => {
        setTokenVerifying(false);
        if (error) {
          console.error("Magic link verification failed:", error);
          toast.error("This login link is invalid or has expired. Please request a new one.");
          setMode("magic");
        } else {
          // Only check MFA for admin users
          const userId = data.user?.id;
          let isAdmin = false;
          if (userId) {
            const { data: roleData } = await supabase.from('user_roles').select('role').eq('user_id', userId);
            isAdmin = roleData?.some(r => r.role === 'admin' || r.role === 'super_admin') ?? false;
          }
          if (isAdmin) {
            const { data: factorsData } = await supabase.auth.mfa.listFactors();
            const hasVerifiedFactors = factorsData?.totp?.some(f => f.status === 'verified');
            if (hasVerifiedFactors) {
              const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
              if (aalData?.nextLevel === 'aal2' && aalData?.currentLevel === 'aal1') {
                setMode("2fa");
                toast.info("Please verify your 2FA to complete sign in.");
                return;
              }
            }
          }
          toast.success("Signed in successfully!");
          navigate("/dashboard");
        }
      });
    }
  }, [mode, tokenHash, tokenType, tokenVerified, tokenVerifying]);

  // Verify signup confirmation token
  useEffect(() => {
    if (mode === "confirm-signup" && tokenHash && tokenType === "signup" && !tokenVerified && !tokenVerifying && !verifyingRef.current) {
      verifyingRef.current = true;
      setTokenVerifying(true);
      supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: "signup",
      }).then(async ({ data, error }) => {
        setTokenVerifying(false);
        if (error) {
          console.error("Signup confirmation failed:", error);
          toast.error("This confirmation link is invalid or has expired.");
          setMode("login");
        } else {
          toast.success("Email confirmed! Welcome to Cleanda.");
          navigate("/dashboard");
        }
      });
    }
  }, [mode, tokenHash, tokenType, tokenVerified, tokenVerifying]);

  const checkMFARequired = async (): Promise<boolean> => {
    try {
      // Only require MFA for admin users
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) return false;

      const { data: roleData } = await supabase.from('user_roles').select('role').eq('user_id', currentUser.id);
      const isAdmin = roleData?.some(r => r.role === 'admin' || r.role === 'super_admin') ?? false;
      if (!isAdmin) return false;

      const { data: factorsData } = await supabase.auth.mfa.listFactors();
      const hasVerifiedFactors = factorsData?.totp?.some(f => f.status === 'verified');
      if (!hasVerifiedFactors) return false;

      const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (error) {
        console.error("Error checking MFA level:", error);
        return false;
      }
      return data.nextLevel === 'aal2' && data.currentLevel === 'aal1';
    } catch {
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (mode === "forgot") {
      await handleForgotPassword();
      return;
    }

    if (mode === "magic") {
      await handleMagicLink();
      return;
    }

    if (mode === "update-password") {
      await handleUpdatePassword();
      return;
    }

    if (!validateForm()) return;

    setLoading(true);
    try {
      if (mode === "login") {
        const { error } = await signIn(email, password);
        if (error) {
          if (error.message.includes("Invalid login credentials")) {
            toast.error("Invalid email or password. Please try again.");
          } else {
            toast.error(error.message);
          }
          return;
        }
        
        // Check if MFA is required
        const mfaRequired = await checkMFARequired();
        if (mfaRequired) {
          setMode("2fa");
          return;
        }
        
        toast.success("Welcome back!");
        navigate("/dashboard");
      } else {
        // Use custom signup edge function for branded confirmation email
        setLoading(true);
        try {
          const response = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/signup-with-confirmation`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                email,
                password,
                redirectTo: `${window.location.origin}/auth`,
              }),
            }
          );

          const data = await response.json();

          if (!response.ok) {
            if (response.status === 409 || data.error?.includes("already registered")) {
              toast.error("This email is already registered. Please sign in instead.");
              setMode("login");
            } else {
              toast.error(data.error || "Failed to create account.");
            }
            return;
          }
          
          // Track signup conversion
          trackCleanerSignup();
          
          // Fire Meta Pixel CompleteRegistration event
          if (window.fbq) {
            window.fbq('track', 'CompleteRegistration', {
              content_name: 'cleaner_signup',
              status: true,
              currency: 'GBP',
              value: 0,
            });
          }
          
          toast.success("Account created! Please check your email to confirm.");
        } finally {
          setLoading(false);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handle2FASuccess = () => {
    toast.success("Welcome back!");
    navigate("/dashboard");
  };

  const handle2FACancel = async () => {
    // Sign out and go back to login
    await supabase.auth.signOut();
    setMode("login");
  };

  const getTitle = () => {
    switch (mode) {
      case "login": return "Welcome Back";
      case "signup": return "Create Account";
      case "forgot": return "Reset Password";
      case "magic": return "Get Login Link";
      case "2fa": return "Two-Factor Authentication";
      case "update-password": return "Set New Password";
      case "magic-verify": return "Verifying Login Link";
      case "confirm-signup": return "Confirming Your Account";
    }
  };

  const getSubtitle = () => {
    switch (mode) {
      case "login": return "Sign in to access your unlocked leads";
      case "signup": return "Join to start getting cleaning leads";
      case "forgot": return "Enter your email to receive a reset link";
      case "magic": return "We'll send you a secure link to sign in";
      case "2fa": return "Enter your authentication code";
      case "update-password": return "Enter your new password below";
      case "magic-verify": return "Please wait while we verify your login link";
      case "confirm-signup": return "Please wait while we confirm your email";
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SEOHead
        title={mode === "login" ? "Sign In" : mode === "signup" ? "Create Account" : "Reset Password"}
        description="Sign in to Cleanda to access exclusive cleaning leads in your area. Manage your leads and grow your cleaning business."
        canonical="https://cleanda.co.uk/auth"
        noIndex={true}
      />
      {/* Header */}
      <header className="bg-primary border-b border-border">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-20">
            <Logo size="md" variant="white" linkTo="/" />
          </div>
        </div>
      </header>

      {/* Auth Form */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="bg-card rounded-2xl shadow-elevated border border-border p-8">
            {mode === "2fa" ? (
              <TwoFactorVerify 
                onSuccess={handle2FASuccess} 
                onCancel={handle2FACancel} 
              />
            ) : needsMfaForReset ? (
              <TwoFactorVerify
                onSuccess={() => {
                  setNeedsMfaForReset(false);
                  setTokenVerified(true);
                  toast.success("Verified! Please set your new password.");
                }}
                onCancel={async () => {
                  await supabase.auth.signOut();
                  setNeedsMfaForReset(false);
                  setMode("login");
                }}
              />
            ) : (
              <>
                {(mode === "forgot" || mode === "magic") && (
                  <button
                    type="button"
                    onClick={() => {
                      setMode("login");
                      setErrors({});
                    }}
                    className="flex items-center gap-1 text-muted-foreground hover:text-foreground mb-4 text-sm"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Back to sign in
                  </button>
                )}
                
                <div className="text-center mb-8">
                  <h1 className="font-heading text-2xl font-bold text-foreground mb-2">
                    {getTitle()}
                  </h1>
                  <p className="text-muted-foreground">
                    {getSubtitle()}
                  </p>
                </div>

                {mode === "magic-verify" || mode === "confirm-signup" ? (
                  <div className="flex flex-col items-center gap-4 py-8">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    <p className="text-muted-foreground">
                      {mode === "confirm-signup" ? "Confirming your email..." : "Verifying your login link..."}
                    </p>
                  </div>
                ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  {mode === "update-password" ? (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="newPassword">New Password</Label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                          <Input
                            id="newPassword"
                            type={showPassword ? "text" : "password"}
                            placeholder="••••••••"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className={`pl-10 pr-10 ${errors.newPassword ? "border-destructive" : ""}`}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          >
                            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                          </button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="confirmPassword">Confirm Password</Label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                          <Input
                            id="confirmPassword"
                            type={showPassword ? "text" : "password"}
                            placeholder="••••••••"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="pl-10"
                          />
                        </div>
                      </div>
                      {errors.newPassword && (
                        <p className="text-destructive text-sm">{errors.newPassword}</p>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                          <Input
                            id="email"
                            type="email"
                            placeholder="you@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className={`pl-10 ${errors.email ? "border-destructive" : ""}`}
                          />
                        </div>
                        {errors.email && (
                          <p className="text-destructive text-sm">{errors.email}</p>
                        )}
                      </div>

                      {(mode !== "forgot" && mode !== "magic") && (
                        <div className="space-y-2">
                          <Label htmlFor="password">Password</Label>
                          <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                            <Input
                              id="password"
                              type={showPassword ? "text" : "password"}
                              placeholder="••••••••"
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              className={`pl-10 pr-10 ${errors.password ? "border-destructive" : ""}`}
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            >
                              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                          </div>
                          {errors.password && (
                            <p className="text-destructive text-sm">{errors.password}</p>
                          )}
                        </div>
                      )}
                    </>
                  )}

                  {mode === "login" && (
                    <div className="flex justify-between items-center">
                      <button
                        type="button"
                        onClick={() => {
                          setMode("magic");
                          setErrors({});
                        }}
                        className="text-sm text-secondary hover:underline"
                      >
                        Send me a login link
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setMode("forgot");
                          setErrors({});
                        }}
                        className="text-sm text-secondary hover:underline"
                      >
                        Forgot password?
                      </button>
                    </div>
                  )}

                  <Button
                    type="submit"
                    variant="cta"
                    size="lg"
                    className="w-full"
                    disabled={loading}
                  >
                    {loading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : mode === "login" ? (
                      "Sign In"
                    ) : mode === "signup" ? (
                      "Create Account"
                    ) : mode === "magic" ? (
                      "Send Login Link"
                    ) : mode === "update-password" ? (
                      "Update Password"
                    ) : (
                      "Send Reset Link"
                    )}
                  </Button>
                </form>
                )}

                {(mode !== "forgot" && mode !== "magic" && mode !== "update-password") && (
                  <div className="mt-6 text-center">
                    <p className="text-muted-foreground">
                      {mode === "login" ? "Don't have an account?" : "Already have an account?"}{" "}
                      <button
                        type="button"
                        onClick={() => {
                          setMode(mode === "login" ? "signup" : "login");
                          setErrors({});
                        }}
                        className="text-secondary font-semibold hover:underline"
                      >
                        {mode === "login" ? "Sign up" : "Sign in"}
                      </button>
                    </p>
                  </div>
                )}
              </>
            )}
          </div>

          <p className="text-center text-muted-foreground text-sm mt-6">
            By signing up, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </main>
    </div>
  );
}