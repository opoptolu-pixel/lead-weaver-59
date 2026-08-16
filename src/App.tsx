import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import { BackToTop } from "@/components/BackToTop";
import { ScrollToTop } from "@/components/ScrollToTop";
import ClarityAnalytics from "@/components/ClarityAnalytics";
import MetaPixel from "@/components/MetaPixel";
import { VisitorPresenceTracker } from "@/components/VisitorPresenceTracker";

import { PageViewTracker } from "@/components/PageViewTracker";

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
const LegacyDashboard = lazy(() => import("./pages/Dashboard"));
const CleanerDashboard = lazy(() => import("./pages/CleanerDashboard"));
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
const Support = lazy(() => import("./pages/Support"));

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
const AdminSupport = lazy(() => import("./pages/admin/AdminSupport"));
const AdminEmailSequences = lazy(() => import("./pages/admin/AdminEmailSequences"));
const AdminServiceRequests = lazy(() => import("./pages/admin/AdminServiceRequests"));
const AdminCustomers = lazy(() => import("./pages/admin/AdminCustomers"));

const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <ClarityAnalytics />
          <MetaPixel />
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
                  <Route path="/leads" element={<Navigate to="/dashboard" replace />} />
                  <Route path="/dashboard" element={<CleanerDashboard />} />
                  <Route path="/legacy-marketplace-dashboard" element={<LegacyDashboard />} />
                  <Route path="/onboarding" element={<Onboarding />} />
                  <Route path="/settings" element={<Navigate to="/onboarding" replace />} />
                  <Route path="/settings/verification" element={<Navigate to="/onboarding" replace />} />
                  <Route path="/billing" element={<Navigate to="/dashboard" replace />} />
                  <Route path="/performance" element={<Navigate to="/dashboard" replace />} />
                  <Route path="/disputes" element={<Navigate to="/support" replace />} />
                  <Route path="/payment-success" element={<Navigate to="/dashboard" replace />} />
                  <Route path="/credits-success" element={<Navigate to="/dashboard" replace />} />
                  <Route path="/support" element={<Support />} />
                  <Route path="/legacy-marketplace/leads" element={<Leads />} />
                  <Route path="/legacy-marketplace/settings" element={<Settings />} />
                  <Route path="/legacy-marketplace/verification" element={<Verification />} />
                  <Route path="/legacy-marketplace/billing" element={<Billing />} />
                  <Route path="/legacy-marketplace/performance" element={<Performance />} />
                  <Route path="/legacy-marketplace/disputes" element={<Disputes />} />
                  <Route path="/legacy-marketplace/payment-success" element={<PaymentSuccess />} />
                  <Route path="/legacy-marketplace/credits-success" element={<CreditsSuccess />} />
                  
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
                  <Route path="/admin/operations" element={<AdminServiceRequests />} />
                  <Route path="/admin/cleaning-requests" element={<AdminServiceRequests />} />
                  <Route path="/admin/jobs" element={<AdminServiceRequests />} />
                  <Route path="/admin/cleaners" element={<AdminServiceRequests />} />
                  <Route path="/admin/onboarding" element={<AdminServiceRequests />} />
                  <Route path="/admin/customers" element={<AdminCustomers />} />
                  <Route path="/admin/quality" element={<AdminDisputes />} />
                  <Route path="/admin/messages" element={<AdminSupport />} />
                  <Route path="/admin/reports" element={<AdminAnalytics />} />
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
                  <Route path="/admin/support" element={<AdminSupport />} />
                  <Route path="/admin/email-sequences" element={<AdminEmailSequences />} />
                  
                  {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
              <MobileBottomNav />
              
              <VisitorPresenceTracker />
              <PageViewTracker />
            </AdminProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
