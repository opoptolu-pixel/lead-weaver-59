import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Mail, Lock, Loader2, Eye, EyeOff, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import TwoFactorVerify from "@/components/TwoFactorVerify";
import { SEOHead } from "@/components/SEOHead";

const authSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type AuthMode = "login" | "2fa";

export default function AdminAuth() {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  
  const navigate = useNavigate();

  // Check if already logged in as admin
  useEffect(() => {
    const checkAdminSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user && mode !== "2fa") {
        // Check if user is admin
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", session.user.id)
          .maybeSingle();
        
        if (roleData && (roleData.role === "admin" || roleData.role === "super_admin")) {
          navigate("/admin");
        }
      }
    };
    checkAdminSession();
  }, [mode, navigate]);

  const validateForm = () => {
    try {
      authSchema.parse({ email, password });
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

  const checkMFARequired = async (): Promise<boolean> => {
    try {
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
    
    if (!validateForm()) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) {
        if (error.message.includes("Invalid login credentials")) {
          toast.error("Invalid email or password. Please try again.");
        } else {
          toast.error(error.message);
        }
        return;
      }

      // Check if user is admin
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", data.user.id)
        .maybeSingle();

      if (!roleData || (roleData.role !== "admin" && roleData.role !== "super_admin")) {
        await supabase.auth.signOut();
        toast.error("Access denied. This login is for administrators only.");
        return;
      }

      // Check if MFA is required
      const mfaRequired = await checkMFARequired();
      if (mfaRequired) {
        setMode("2fa");
        return;
      }

      // Update last login
      await supabase
        .from("profiles")
        .update({ last_login: new Date().toISOString() })
        .eq("user_id", data.user.id);
      
      toast.success("Welcome back, Admin!");
      navigate("/admin");
    } finally {
      setLoading(false);
    }
  };

  const handle2FASuccess = () => {
    toast.success("Welcome back, Admin!");
    navigate("/admin");
  };

  const handle2FACancel = async () => {
    await supabase.auth.signOut();
    setMode("login");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SEOHead
        title="Admin Login"
        description="Cleanda Admin Portal - Sign in to access the administration dashboard."
        canonical="https://cleanda.co.uk/admin-login"
        noIndex={true}
      />
      
      {/* Header */}
      <header className="bg-primary border-b border-border">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-20">
            <Logo size="md" variant="white" />
            <div className="flex items-center gap-2 text-primary-foreground/80">
              <Shield className="w-5 h-5" />
              <span className="text-sm font-medium">Admin Portal</span>
            </div>
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
            ) : (
              <>
                <div className="text-center mb-8">
                  <div className="bg-secondary/10 rounded-full p-3 w-14 h-14 mx-auto mb-4 flex items-center justify-center">
                    <Shield className="w-7 h-7 text-secondary" />
                  </div>
                  <h1 className="font-heading text-2xl font-bold text-foreground mb-2">
                    Admin Login
                  </h1>
                  <p className="text-muted-foreground">
                    Sign in to access the admin dashboard
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="admin@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className={`pl-10 ${errors.email ? "border-destructive" : ""}`}
                      />
                    </div>
                    {errors.email && (
                      <p className="text-destructive text-sm">{errors.email}</p>
                    )}
                  </div>

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

                  <Button
                    type="submit"
                    variant="cta"
                    size="lg"
                    className="w-full"
                    disabled={loading}
                  >
                    {loading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      "Sign In"
                    )}
                  </Button>
                </form>

                <p className="text-center text-muted-foreground text-xs mt-6">
                  This portal is for authorized administrators only.
                </p>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
