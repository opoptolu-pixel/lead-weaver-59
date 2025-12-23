import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { AdminProvider } from "@/contexts/AdminContext";
import Index from "./pages/Index";
import Leads from "./pages/Leads";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Settings from "./pages/Settings";
import Verification from "./pages/Verification";
import PaymentSuccess from "./pages/PaymentSuccess";
import CreditsSuccess from "./pages/CreditsSuccess";
import NotFound from "./pages/NotFound";
import AdminOverview from "./pages/admin/AdminOverview";
import AdminLeads from "./pages/admin/AdminLeads";
import AdminBusinesses from "./pages/admin/AdminBusinesses";
import AdminVerifications from "./pages/admin/AdminVerifications";
import AdminPayments from "./pages/admin/AdminPayments";
import AdminDisputes from "./pages/admin/AdminDisputes";
import AdminAnalytics from "./pages/admin/AdminAnalytics";
import AdminSettings from "./pages/admin/AdminSettings";

const queryClient = new QueryClient();

const App = () => (
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
              <Route path="/settings" element={<Settings />} />
              <Route path="/settings/verification" element={<Verification />} />
              <Route path="/payment-success" element={<PaymentSuccess />} />
              <Route path="/credits-success" element={<CreditsSuccess />} />
              {/* Admin Routes */}
              <Route path="/admin" element={<AdminOverview />} />
              <Route path="/admin/leads" element={<AdminLeads />} />
              <Route path="/admin/businesses" element={<AdminBusinesses />} />
              <Route path="/admin/verifications" element={<AdminVerifications />} />
              <Route path="/admin/payments" element={<AdminPayments />} />
              <Route path="/admin/disputes" element={<AdminDisputes />} />
              <Route path="/admin/analytics" element={<AdminAnalytics />} />
              <Route path="/admin/settings" element={<AdminSettings />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AdminProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
