import { ReactNode, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Shield } from "lucide-react";
import { ThemeProvider } from "next-themes";
import { useAdmin } from "@/contexts/AdminContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import AdminSidebar from "./AdminSidebar";
import AdminTopBar from "./AdminTopBar";
import AdminMobileNav from "./AdminMobileNav";
import TwoFactorSetup from "./TwoFactorSetup";

interface AdminLayoutProps {
  children: ReactNode;
  title: string;
}

export default function AdminLayout({ children, title }: AdminLayoutProps) {
  const { isAdmin, isLoading: adminLoading } = useAdmin();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [mfaStatus, setMfaStatus] = useState<'loading' | 'enrolled' | 'not_enrolled'>('loading');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/admin-login");
    } else if (!adminLoading && user && !isAdmin) {
      navigate("/admin-login");
    }
  }, [user, authLoading, isAdmin, adminLoading, navigate]);

  // Check MFA enrollment status for admins
  useEffect(() => {
    const checkMfaStatus = async () => {
      if (!user || !isAdmin) {
        setMfaStatus('loading');
        return;
      }

      try {
        const { data, error } = await supabase.auth.mfa.listFactors();
        if (error) {
          console.error("Error checking MFA status:", error);
          setMfaStatus('not_enrolled');
          return;
        }

        const hasVerifiedTotp = data.totp.some(f => f.status === 'verified');
        setMfaStatus(hasVerifiedTotp ? 'enrolled' : 'not_enrolled');
      } catch (err) {
        console.error("Error checking MFA status:", err);
        setMfaStatus('not_enrolled');
      }
    };

    if (!adminLoading && isAdmin) {
      checkMfaStatus();
    }
  }, [user, isAdmin, adminLoading]);

  if (authLoading || adminLoading || (isAdmin && mfaStatus === 'loading')) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-secondary" />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  // Force 2FA enrollment for admins who haven't set it up
  if (mfaStatus === 'not_enrolled') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full space-y-6">
          <div className="text-center">
            <div className="bg-secondary/20 rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
              <Shield className="w-8 h-8 text-secondary" />
            </div>
            <h1 className="font-heading text-2xl font-bold text-foreground mb-2">
              Two-Factor Authentication Required
            </h1>
            <p className="text-muted-foreground">
              As an admin, you must enable two-factor authentication to access the admin dashboard.
            </p>
          </div>
          
          <div className="bg-card border border-border rounded-lg p-6">
            <TwoFactorSetup onComplete={() => setMfaStatus('enrolled')} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <div className="h-screen bg-background flex w-full overflow-hidden admin-layout">
        {/* Desktop sidebar - hidden on mobile */}
        <div className="hidden md:block">
          <AdminSidebar />
        </div>
        
        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
        
        {/* Mobile sidebar drawer */}
        <div className={`
          fixed inset-y-0 left-0 z-50 md:hidden transform transition-transform duration-300 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}>
          <AdminSidebar onNavigate={() => setSidebarOpen(false)} />
        </div>

        <div className="flex-1 flex flex-col h-screen overflow-hidden w-full">
          <AdminTopBar 
            title={title} 
            onMenuClick={() => setSidebarOpen(!sidebarOpen)}
          />
          <main className="flex-1 overflow-auto bg-background px-4 py-6 pb-20 sm:px-6 md:px-8 md:py-8 md:pb-10 lg:px-10 lg:py-10 xl:px-12 xl:py-12">
            {children}
          </main>
        </div>
        
        {/* Mobile bottom navigation */}
        <AdminMobileNav />
      </div>
    </ThemeProvider>
  );
}
