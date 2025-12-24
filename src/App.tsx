import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { AdminProvider } from "@/contexts/AdminContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import Index from "./pages/Index";
import Leads from "./pages/Leads";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Onboarding from "./pages/Onboarding";
import Settings from "./pages/Settings";
import Billing from "./pages/Billing";
import Verification from "./pages/Verification";
import PaymentSuccess from "./pages/PaymentSuccess";
import CreditsSuccess from "./pages/CreditsSuccess";
import Performance from "./pages/Performance";
import Disputes from "./pages/Disputes";
import NotFound from "./pages/NotFound";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import RefundPolicy from "./pages/RefundPolicy";
import GDPR from "./pages/GDPR";
import TermsOfUse from "./pages/TermsOfUse";
import RequestCleaning from "./pages/RequestCleaning";
import RequestCleaningThankYou from "./pages/RequestCleaningThankYou";
import AdminOverview from "./pages/admin/AdminOverview";
import AdminLeads from "./pages/admin/AdminLeads";
import AdminBusinesses from "./pages/admin/AdminBusinesses";
import AdminVerifications from "./pages/admin/AdminVerifications";
import AdminPayments from "./pages/admin/AdminPayments";
import AdminDisputes from "./pages/admin/AdminDisputes";
import AdminAnalytics from "./pages/admin/AdminAnalytics";
import AdminSettings from "./pages/admin/AdminSettings";
import AdminActivityLogs from "./pages/admin/AdminActivityLogs";
import AdminFraud from "./pages/admin/AdminFraud";
import AdminInquiries from "./pages/admin/AdminInquiries";
import AdminEmailTemplates from "./pages/admin/AdminEmailTemplates";
import AdminAccounting from "./pages/admin/AdminAccounting";

const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <AdminProvider>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/leads" element={<Leads />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/onboarding" element={<Onboarding />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/settings/verification" element={<Verification />} />
                <Route path="/billing" element={<Billing />} />
                <Route path="/performance" element={<Performance />} />
                <Route path="/disputes" element={<Disputes />} />
                <Route path="/payment-success" element={<PaymentSuccess />} />
                <Route path="/credits-success" element={<CreditsSuccess />} />
                {/* Customer-facing Pages */}
                <Route path="/request-cleaning" element={<RequestCleaning />} />
                <Route path="/request-cleaning/thank-you" element={<RequestCleaningThankYou />} />
                {/* Legal Pages */}
                <Route path="/privacy-policy" element={<PrivacyPolicy />} />
                <Route path="/refund-policy" element={<RefundPolicy />} />
                <Route path="/gdpr" element={<GDPR />} />
                <Route path="/terms-of-use" element={<TermsOfUse />} />
                {/* Admin Routes */}
                <Route path="/admin" element={<AdminOverview />} />
                <Route path="/admin/inquiries" element={<AdminInquiries />} />
                <Route path="/admin/leads" element={<AdminLeads />} />
                <Route path="/admin/businesses" element={<AdminBusinesses />} />
                <Route path="/admin/verifications" element={<AdminVerifications />} />
                <Route path="/admin/payments" element={<AdminPayments />} />
                <Route path="/admin/accounting" element={<AdminAccounting />} />
                <Route path="/admin/disputes" element={<AdminDisputes />} />
                <Route path="/admin/fraud" element={<AdminFraud />} />
                <Route path="/admin/analytics" element={<AdminAnalytics />} />
                <Route path="/admin/activity-logs" element={<AdminActivityLogs />} />
                <Route path="/admin/settings" element={<AdminSettings />} />
                <Route path="/admin/email-templates" element={<AdminEmailTemplates />} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
              <MobileBottomNav />
            </AdminProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
