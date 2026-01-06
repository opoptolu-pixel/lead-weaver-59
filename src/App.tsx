import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import { BackToTop } from "@/components/BackToTop";
import { ScrollToTop } from "@/components/ScrollToTop";
import ClarityAnalytics from "@/components/ClarityAnalytics";
import { VisitorPresenceTracker } from "@/components/VisitorPresenceTracker";

import { AuthProvider } from "@/contexts/AuthContext";
import { AdminProvider } from "@/contexts/AdminContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { PageLoader } from "@/components/PageLoader";

// Critical routes - loaded immediately
import Index from "./pages/Index";
import ForCleaners from "./pages/ForCleaners";
import Auth from "./pages/Auth";

// Lazy loaded routes - loaded on demand
const Leads = lazy(() => import("./pages/Leads"));
const AdminAuth = lazy(() => import("./pages/AdminAuth"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const Settings = lazy(() => import("./pages/Settings"));
const Billing = lazy(() => import("./pages/Billing"));
const Verification = lazy(() => import("./pages/Verification"));
const PaymentSuccess = lazy(() => import("./pages/PaymentSuccess"));
const CreditsSuccess = lazy(() => import("./pages/CreditsSuccess"));
const Performance = lazy(() => import("./pages/Performance"));
const Disputes = lazy(() => import("./pages/Disputes"));
const NotFound = lazy(() => import("./pages/NotFound"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const RefundPolicy = lazy(() => import("./pages/RefundPolicy"));
const GDPR = lazy(() => import("./pages/GDPR"));
const TermsOfUse = lazy(() => import("./pages/TermsOfUse"));
const RequestCleaning = lazy(() => import("./pages/RequestCleaning"));
const RequestCleaningThankYou = lazy(() => import("./pages/RequestCleaningThankYou"));
const Contact = lazy(() => import("./pages/Contact"));
const Blog = lazy(() => import("./pages/Blog"));
const BlogPost = lazy(() => import("./pages/BlogPost"));

// Admin routes - lazy loaded
const AdminOverview = lazy(() => import("./pages/admin/AdminOverview"));
const AdminLeads = lazy(() => import("./pages/admin/AdminLeads"));
const AdminBusinesses = lazy(() => import("./pages/admin/AdminBusinesses"));
const AdminVerifications = lazy(() => import("./pages/admin/AdminVerifications"));
const AdminPayments = lazy(() => import("./pages/admin/AdminPayments"));
const AdminDisputes = lazy(() => import("./pages/admin/AdminDisputes"));
const AdminAnalytics = lazy(() => import("./pages/admin/AdminAnalytics"));
const AdminSettings = lazy(() => import("./pages/admin/AdminSettings"));
const AdminActivityLogs = lazy(() => import("./pages/admin/AdminActivityLogs"));
const AdminFraud = lazy(() => import("./pages/admin/AdminFraud"));
const AdminInquiries = lazy(() => import("./pages/admin/AdminInquiries"));
const AdminEmailTemplates = lazy(() => import("./pages/admin/AdminEmailTemplates"));
const AdminAccounting = lazy(() => import("./pages/admin/AdminAccounting"));
const AdminContactSubmissions = lazy(() => import("./pages/admin/AdminContactSubmissions"));
const AdminEmailSubscribers = lazy(() => import("./pages/admin/AdminEmailSubscribers"));
const AdminLiveData = lazy(() => import("./pages/admin/AdminLiveData"));
const AdminUtmBuilder = lazy(() => import("./pages/admin/AdminUtmBuilder"));

const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <ClarityAnalytics />
          <ScrollToTop />
          <BackToTop />
          <AuthProvider>
            <AdminProvider>
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  {/* Critical routes - not lazy loaded */}
                  <Route path="/" element={<Index />} />
                  <Route path="/for-cleaners" element={<ForCleaners />} />
                  <Route path="/auth" element={<Auth />} />
                  
                  {/* Lazy loaded routes */}
                  <Route path="/leads" element={<Leads />} />
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
                  
                  {/* Blog */}
                  <Route path="/blog" element={<Blog />} />
                  <Route path="/blog/:slug" element={<BlogPost />} />
                  
                  {/* Legal Pages */}
                  <Route path="/privacy-policy" element={<PrivacyPolicy />} />
                  <Route path="/refund-policy" element={<RefundPolicy />} />
                  <Route path="/gdpr" element={<GDPR />} />
                  <Route path="/terms-of-use" element={<TermsOfUse />} />
                  <Route path="/contact" element={<Contact />} />
                  
                  {/* Admin Routes */}
                  <Route path="/admin-login" element={<AdminAuth />} />
                  <Route path="/admin" element={<AdminOverview />} />
                  <Route path="/admin/live" element={<AdminLiveData />} />
                  <Route path="/admin/inquiries" element={<AdminInquiries />} />
                  <Route path="/admin/contact" element={<AdminContactSubmissions />} />
                  <Route path="/admin/leads" element={<AdminLeads />} />
                  <Route path="/admin/businesses" element={<AdminBusinesses />} />
                  <Route path="/admin/verifications" element={<AdminVerifications />} />
                  <Route path="/admin/payments" element={<AdminPayments />} />
                  <Route path="/admin/accounting" element={<AdminAccounting />} />
                  <Route path="/admin/disputes" element={<AdminDisputes />} />
                  <Route path="/admin/fraud" element={<AdminFraud />} />
                  <Route path="/admin/analytics" element={<AdminAnalytics />} />
                  <Route path="/admin/utm-builder" element={<AdminUtmBuilder />} />
                  <Route path="/admin/activity-logs" element={<AdminActivityLogs />} />
                  <Route path="/admin/settings" element={<AdminSettings />} />
                  <Route path="/admin/email-templates" element={<AdminEmailTemplates />} />
                  <Route path="/admin/subscribers" element={<AdminEmailSubscribers />} />
                  
                  {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
              <MobileBottomNav />
              <VisitorPresenceTracker />
            </AdminProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;