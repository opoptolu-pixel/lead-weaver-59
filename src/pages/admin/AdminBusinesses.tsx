import { useState, useEffect } from "react";
import {
  Search,
  MoreVertical,
  CheckCircle,
  XCircle,
  Ban,
  Eye,
  Loader2,
  Shield,
  Download,
  Phone,
  MapPin,
  Calendar,
  Mail,
  PlusCircle,
  CreditCard,
  FileText,
  AlertTriangle,
  ExternalLink,
  Coins,
  Building2,
  User,
  Clock,
  Globe,
  Monitor,
  History,
} from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { useAdmin } from "@/contexts/AdminContext";
import { usePagination } from "@/hooks/usePagination";
import { PaginationControls } from "@/components/admin/PaginationControls";
import { exportToCsv } from "@/lib/exportCsv";
import { Textarea } from "@/components/ui/textarea";
import BusinessActivityTimeline from "@/components/admin/BusinessActivityTimeline";

interface Business {
  id: string;
  user_id: string;
  business_name: string | null;
  contact_name: string | null;
  phone: string | null;
  postcode: string | null;
  is_verified: boolean;
  verification_status: string | null;
  leads_purchased: number;
  credits: number;
  risk_score: number;
  is_suspended: boolean;
  suspension_reason: string | null;
  phone_verified: boolean;
  address_verified: boolean;
  whatsapp_optin: boolean;
  created_at: string;
  last_login: string | null;
  email?: string | null;
}

interface PurchaseHistory {
  id: string;
  job_type: string;
  postcode: string;
  unlocked_at: string;
  value: number;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  customer_address: string;
  date: string;
  property_type: string | null;
  bedrooms: string | null;
  frequency: string | null;
}

interface VerificationDocument {
  id: string;
  document_type: string;
  file_path: string;
  status: string;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
}

interface LoginHistoryEntry {
  id: string;
  login_at: string;
  ip_address: string | null;
  user_agent: string | null;
  country: string | null;
  city: string | null;
}

type StatusFilter = "all" | "active" | "suspended" | "unverified";

export default function AdminBusinesses() {
  const { getDateFilter, dateRange } = useAdmin();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [purchaseHistory, setPurchaseHistory] = useState<PurchaseHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [verificationDocs, setVerificationDocs] = useState<VerificationDocument[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [viewingDocUrl, setViewingDocUrl] = useState<string | null>(null);
  const [isDocViewerOpen, setIsDocViewerOpen] = useState(false);
  const [loginHistory, setLoginHistory] = useState<LoginHistoryEntry[]>([]);
  const [loadingLoginHistory, setLoadingLoginHistory] = useState(false);
  const [selectedLead, setSelectedLead] = useState<PurchaseHistory | null>(null);
  const [isLeadDetailsOpen, setIsLeadDetailsOpen] = useState(false);
  
  // Add credits dialog
  const [isAddCreditsOpen, setIsAddCreditsOpen] = useState(false);
  const [creditsToAdd, setCreditsToAdd] = useState("");
  const [creditsReason, setCreditsReason] = useState("");
  const [addingCredits, setAddingCredits] = useState(false);
  
  // Send email dialog
  const [isSendEmailOpen, setIsSendEmailOpen] = useState(false);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);
  
  // Suspension reason dialog
  const [isSuspendDialogOpen, setIsSuspendDialogOpen] = useState(false);
  const [suspensionReason, setSuspensionReason] = useState("");
  const [suspendingBusiness, setSuspendingBusiness] = useState<Business | null>(null);
  
  // Activity timeline
  const [isActivityTimelineOpen, setIsActivityTimelineOpen] = useState(false);
  const [activityTimelineUserId, setActivityTimelineUserId] = useState<string | null>(null);
  
  // Phone unlinking
  const [isUnlinkPhoneDialogOpen, setIsUnlinkPhoneDialogOpen] = useState(false);
  const [unlinkingPhone, setUnlinkingPhone] = useState(false);

  useEffect(() => {
    fetchBusinesses();
  }, [dateRange]);

  // Real-time subscription for live updates
  useEffect(() => {
    const channel = supabase
      .channel('admin-businesses-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        (payload) => {
          console.log('Profiles updated in realtime:', payload);
          fetchBusinesses();
          toast.info('Business data updated', { 
            description: `${payload.eventType === 'INSERT' ? 'New business registered' : payload.eventType === 'UPDATE' ? 'Business profile updated' : 'Profile removed'}`,
            duration: 3000 
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [dateRange]);

  const fetchBusinesses = async () => {
    const { start, end } = getDateFilter();
    
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .gte("created_at", start.toISOString())
      .lte("created_at", end.toISOString())
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching businesses:", error);
      toast.error("Failed to load businesses");
    } else {
      // Fetch emails for each user using the RPC function
      const businessesWithEmails = await Promise.all(
        (data || []).map(async (profile) => {
          const { data: email } = await supabase.rpc("get_user_email", { 
            user_uuid: profile.user_id 
          });
          return { ...profile, email: email || null };
        })
      );
      setBusinesses(businessesWithEmails);
    }
    setLoading(false);
  };

  const fetchVerificationDocs = async (userId: string) => {
    setLoadingDocs(true);
    const { data, error } = await supabase
      .from("verification_documents")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setVerificationDocs(data);
    } else {
      setVerificationDocs([]);
    }
    setLoadingDocs(false);
  };

  const viewDocument = async (filePath: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("get-signed-url", {
        body: { filePath },
      });
      
      if (error || !data?.signedUrl) {
        toast.error("Failed to load document");
        return;
      }
      
      setViewingDocUrl(data.signedUrl);
      setIsDocViewerOpen(true);
    } catch (err) {
      console.error("Error getting signed URL:", err);
      toast.error("Failed to load document");
    }
  };

  const viewProfile = async (business: Business) => {
    setSelectedBusiness(business);
    setIsProfileOpen(true);
    setLoadingHistory(true);
    setLoadingLoginHistory(true);

    // Fetch purchase history with full lead details
    const { data, error } = await supabase
      .from("leads")
      .select("id, job_type, postcode, unlocked_at, value, customer_name, customer_email, customer_phone, customer_address, date, property_type, bedrooms, frequency")
      .eq("unlocked_by", business.user_id)
      .order("unlocked_at", { ascending: false });

    if (!error && data) {
      setPurchaseHistory(data);
    }
    setLoadingHistory(false);

    // Fetch login history
    const { data: loginData, error: loginError } = await supabase
      .from("login_history")
      .select("*")
      .eq("user_id", business.user_id)
      .order("login_at", { ascending: false })
      .limit(20);

    if (!loginError && loginData) {
      setLoginHistory(loginData);
    }
    setLoadingLoginHistory(false);

    // Fetch verification documents
    fetchVerificationDocs(business.user_id);
  };

  const openSuspendDialog = (business: Business) => {
    setSuspendingBusiness(business);
    setSuspensionReason("");
    setIsSuspendDialogOpen(true);
  };

  const handleSuspend = async () => {
    if (!suspendingBusiness) return;
    
    const reason = suspensionReason.trim() || "Suspended by admin";
    
    const { error } = await supabase
      .from("profiles")
      .update({
        is_suspended: true,
        suspension_reason: reason,
      })
      .eq("id", suspendingBusiness.id);

    if (error) {
      toast.error("Failed to suspend business");
      return;
    }
    
    // Send suspension notification email
    if (suspendingBusiness.email) {
      try {
        const { data: template } = await supabase
          .from("email_templates")
          .select("subject, body")
          .eq("name", "account_suspended")
          .eq("is_active", true)
          .maybeSingle();

        if (template) {
          const variables: Record<string, string> = {
            business_name: suspendingBusiness.business_name || "Partner",
            contact_name: suspendingBusiness.contact_name || "there",
            suspension_reason: reason,
            support_email: "hello@cleanda.co.uk",
            current_year: new Date().getFullYear().toString(),
          };

          let subject = template.subject;
          let html = template.body;
          
          Object.entries(variables).forEach(([key, value]) => {
            subject = subject.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
            html = html.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
          });

          await supabase.functions.invoke("send-email", {
            body: {
              to: suspendingBusiness.email,
              subject,
              html,
              templateName: "account_suspended",
            },
          });
          
          toast.success("Suspension email sent to business");
        }
      } catch (emailError) {
        console.error("Failed to send suspension email:", emailError);
      }
    }
    
    toast.success("Business suspended");
    setIsSuspendDialogOpen(false);
    setSuspendingBusiness(null);
    fetchBusinesses();
  };

  const handleUnsuspend = async (business: Business) => {
    const { error } = await supabase
      .from("profiles")
      .update({
        is_suspended: false,
        suspension_reason: null,
      })
      .eq("id", business.id);

    if (error) {
      toast.error("Failed to unsuspend business");
      return;
    }
    
    // Send unsuspension notification email
    if (business.email) {
      try {
        const { data: template } = await supabase
          .from("email_templates")
          .select("subject, body")
          .eq("name", "account_unsuspended")
          .eq("is_active", true)
          .maybeSingle();

        if (template) {
          const variables: Record<string, string> = {
            business_name: business.business_name || "Partner",
            contact_name: business.contact_name || "there",
            support_email: "hello@cleanda.co.uk",
            current_year: new Date().getFullYear().toString(),
          };

          let subject = template.subject;
          let html = template.body;
          
          Object.entries(variables).forEach(([key, value]) => {
            subject = subject.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
            html = html.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
          });

          await supabase.functions.invoke("send-email", {
            body: {
              to: business.email,
              subject,
              html,
              templateName: "account_unsuspended",
            },
          });
          
          toast.success("Reactivation email sent to business");
        }
      } catch (emailError) {
        console.error("Failed to send unsuspension email:", emailError);
      }
    }
    
    toast.success("Business unsuspended");
    fetchBusinesses();
  };

  const verifyBusiness = async (business: Business) => {
    const { error } = await supabase
      .from("profiles")
      .update({
        is_verified: true,
        verification_status: "approved",
      })
      .eq("id", business.id);

    if (error) {
      toast.error("Failed to verify business");
      return;
    }

    // Send verification approved email
    if (business.email) {
      try {
        const { data: template } = await supabase
          .from("email_templates")
          .select("subject, body")
          .eq("name", "verification_approved")
          .eq("is_active", true)
          .maybeSingle();

        if (template) {
          const variables: Record<string, string> = {
            business_name: business.business_name || "Partner",
            contact_name: business.contact_name || "there",
            dashboard_url: "https://cleanda.co.uk/dashboard",
            support_email: "hello@cleanda.co.uk",
            current_year: new Date().getFullYear().toString(),
          };

          let subject = template.subject;
          let html = template.body;
          
          Object.entries(variables).forEach(([key, value]) => {
            subject = subject.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
            html = html.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
          });

          await supabase.functions.invoke("send-email", {
            body: {
              to: business.email,
              subject,
              html,
              templateName: "verification_approved",
            },
          });
          
          toast.success("Verification email sent to business");
        }
      } catch (emailError) {
        console.error("Failed to send verification email:", emailError);
      }
    }

    toast.success("Business verified");
    fetchBusinesses();
  };

  const handleUnlinkPhone = async () => {
    if (!selectedBusiness) return;
    
    setUnlinkingPhone(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ 
          phone_verified: false,
          // Keep the phone number but mark as unverified
        })
        .eq("id", selectedBusiness.id);

      if (error) throw error;

      // Log the action
      await supabase.from("activity_logs").insert({
        user_id: selectedBusiness.user_id,
        action: "phone_unlinked",
        entity_type: "profile",
        entity_id: selectedBusiness.id,
        details: { 
          phone: selectedBusiness.phone,
          unlinked_by: "admin",
          reason: "Manual admin action"
        },
      });

      toast.success("Phone number unlinked successfully. The user will need to verify again.");
      setIsUnlinkPhoneDialogOpen(false);
      fetchBusinesses();
      
      // Update selected business
      setSelectedBusiness(prev => prev ? { ...prev, phone_verified: false } : null);
    } catch (error) {
      console.error("Error unlinking phone:", error);
      toast.error("Failed to unlink phone number");
    } finally {
      setUnlinkingPhone(false);
    }
  };

  const handleAddCredits = async () => {
    if (!selectedBusiness || !creditsToAdd) return;
    
    const amount = parseInt(creditsToAdd, 10);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid number of credits");
      return;
    }
    
    setAddingCredits(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ credits: selectedBusiness.credits + amount })
        .eq("id", selectedBusiness.id);

      if (error) throw error;

      // Log as 'credits_granted' - distinct from 'credits_purchased' (Stripe payments)
      // This ensures manual credits don't appear in revenue/payment reports
      await supabase.from("activity_logs").insert({
        user_id: selectedBusiness.user_id,
        action: "credits_granted",
        entity_type: "business",
        entity_id: selectedBusiness.user_id,
        details: { 
          credits_added: amount,
          credits_total: selectedBusiness.credits + amount,
          reason: creditsReason || "Manual admin credit",
          granted_by: "admin",
          business_name: selectedBusiness.business_name || "Unknown Business",
          contact_name: selectedBusiness.contact_name || null,
        },
      });

      toast.success(`Granted ${amount} credits successfully`);
      setIsAddCreditsOpen(false);
      setCreditsToAdd("");
      setCreditsReason("");
      fetchBusinesses();
      
      // Update selected business
      setSelectedBusiness(prev => prev ? { ...prev, credits: prev.credits + amount } : null);
    } catch (error) {
      console.error("Error adding credits:", error);
      toast.error("Failed to add credits");
    } finally {
      setAddingCredits(false);
    }
  };

  const handleSendEmail = async () => {
    if (!selectedBusiness?.email || !emailSubject || !emailBody) {
      toast.error("Please fill in all fields");
      return;
    }
    
    setSendingEmail(true);
    try {
      const { error } = await supabase.functions.invoke("send-email", {
        body: {
          to: selectedBusiness.email,
          subject: emailSubject,
          html: emailBody.replace(/\n/g, "<br>"),
        },
      });

      if (error) throw error;

      toast.success("Email sent successfully");
      setIsSendEmailOpen(false);
      setEmailSubject("");
      setEmailBody("");
    } catch (error) {
      console.error("Error sending email:", error);
      toast.error("Failed to send email");
    } finally {
      setSendingEmail(false);
    }
  };

  // Filter by status first
  const statusFilteredBusinesses = businesses.filter((b) => {
    switch (statusFilter) {
      case "active":
        return !b.is_suspended && b.is_verified;
      case "suspended":
        return b.is_suspended;
      case "unverified":
        return !b.is_verified && !b.is_suspended;
      default:
        return true;
    }
  });

  // Then filter by search
  const filteredBusinesses = statusFilteredBusinesses.filter(
    (b) =>
      (b.business_name?.toLowerCase() || "").includes(searchQuery.toLowerCase()) ||
      (b.contact_name?.toLowerCase() || "").includes(searchQuery.toLowerCase()) ||
      (b.postcode?.toLowerCase() || "").includes(searchQuery.toLowerCase()) ||
      (b.email?.toLowerCase() || "").includes(searchQuery.toLowerCase())
  );

  const pagination = usePagination(filteredBusinesses);

  const handleExport = () => {
    exportToCsv(filteredBusinesses, "businesses", [
      { key: "business_name", label: "Business Name" },
      { key: "contact_name", label: "Contact Name" },
      { key: "email", label: "Email" },
      { key: "phone", label: "Phone" },
      { key: "postcode", label: "Postcode" },
      { key: "is_verified", label: "Verified" },
      { key: "leads_purchased", label: "Leads Purchased" },
      { key: "credits", label: "Credits" },
      { key: "risk_score", label: "Risk Score" },
      { key: "is_suspended", label: "Suspended" },
      { key: "suspension_reason", label: "Suspension Reason" },
      { key: "created_at", label: "Created At" },
    ]);
    toast.success("Export started");
  };

  const getVerificationBadge = (business: Business) => {
    if (business.is_suspended) {
      return <Badge variant="destructive">Suspended</Badge>;
    }
    if (business.is_verified) {
      return <Badge className="bg-green-500/20 text-green-500">Verified</Badge>;
    }
    if (business.verification_status === "pending") {
      return <Badge variant="secondary">Pending</Badge>;
    }
    return <Badge className="bg-amber-500/20 text-amber-500">Unverified</Badge>;
  };

  const getRiskBadge = (score: number) => {
    if (score >= 70) {
      return <Badge variant="destructive">High Risk</Badge>;
    }
    if (score >= 40) {
      return <Badge className="bg-amber-500/20 text-amber-500">Medium</Badge>;
    }
    return <Badge className="bg-green-500/20 text-green-500">Low</Badge>;
  };

  const getDocumentTypeName = (type: string) => {
    const names: Record<string, string> = {
      business_license: "Business License",
      address_proof: "Address Proof",
      id_document: "ID Document",
      insurance: "Insurance Certificate",
    };
    return names[type] || type;
  };

  const getDocStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-green-500/20 text-green-500">Approved</Badge>;
      case "rejected":
        return <Badge variant="destructive">Rejected</Badge>;
      default:
        return <Badge variant="secondary">Pending</Badge>;
    }
  };

  // Calculate stats
  const stats = {
    total: businesses.length,
    verified: businesses.filter((b) => b.is_verified).length,
    unverified: businesses.filter((b) => !b.is_verified && !b.is_suspended).length,
    suspended: businesses.filter((b) => b.is_suspended).length,
    totalCredits: businesses.reduce((sum, b) => sum + (b.credits || 0), 0),
  };

  return (
    <AdminLayout title="Businesses">
      {/* Search & Export */}
      <div className="flex gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search businesses..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              pagination.resetPage();
            }}
            className="pl-9"
          />
        </div>
        <Button variant="outline" onClick={handleExport}>
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-sm text-muted-foreground">Total Businesses</p>
          <p className="text-2xl font-bold text-foreground">{stats.total}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-sm text-muted-foreground">Verified</p>
          <p className="text-2xl font-bold text-green-500">{stats.verified}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-sm text-muted-foreground">Pending Verification</p>
          <p className="text-2xl font-bold text-amber-500">{stats.unverified}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-sm text-muted-foreground">Suspended</p>
          <p className="text-2xl font-bold text-destructive">{stats.suspended}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-sm text-muted-foreground flex items-center gap-1">
            <Coins className="w-4 h-4" /> Total Credits
          </p>
          <p className="text-2xl font-bold text-foreground">{stats.totalCredits}</p>
        </div>
      </div>

      {/* Status Filter Tabs */}
      <div className="mb-4">
        <Tabs value={statusFilter} onValueChange={(v) => {
          setStatusFilter(v as StatusFilter);
          pagination.resetPage();
        }}>
          <TabsList>
            <TabsTrigger value="all">
              All ({businesses.length})
            </TabsTrigger>
            <TabsTrigger value="active">
              Active ({businesses.filter(b => !b.is_suspended && b.is_verified).length})
            </TabsTrigger>
            <TabsTrigger value="unverified">
              Unverified ({businesses.filter(b => !b.is_verified && !b.is_suspended).length})
            </TabsTrigger>
            <TabsTrigger value="suspended" className="text-destructive">
              Suspended ({businesses.filter(b => b.is_suspended).length})
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-secondary" />
          </div>
        ) : pagination.paginatedData.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            No businesses found
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-4 font-medium text-muted-foreground">Business</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Email</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Status</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Risk</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Credits</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Leads</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Joined</th>
                    <th className="text-right p-4 font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {pagination.paginatedData.map((business) => (
                    <tr 
                      key={business.id} 
                      className={`hover:bg-muted/30 cursor-pointer ${business.is_suspended ? 'bg-destructive/5' : ''}`}
                      onClick={() => viewProfile(business)}
                    >
                      <td className="p-4">
                        <div>
                          <p className="font-medium text-foreground flex items-center gap-2">
                            {business.business_name || business.contact_name || "Unnamed"}
                            {business.is_suspended && (
                              <AlertTriangle className="w-4 h-4 text-destructive" />
                            )}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {business.postcode || "No postcode"} • {business.phone || "No phone"}
                          </p>
                        </div>
                      </td>
                      <td className="p-4">
                        <p className="text-sm text-muted-foreground">
                          {business.email || "No email"}
                        </p>
                      </td>
                      <td className="p-4">{getVerificationBadge(business)}</td>
                      <td className="p-4">{getRiskBadge(business.risk_score || 0)}</td>
                      <td className="p-4">
                        <div className="flex items-center gap-1">
                          <Coins className="w-4 h-4 text-amber-500" />
                          <span className={`font-semibold ${business.credits > 0 ? 'text-foreground' : 'text-muted-foreground'}`}>
                            {business.credits}
                          </span>
                        </div>
                      </td>
                      <td className="p-4">
                        <p className="text-foreground">{business.leads_purchased}</p>
                        <p className="text-xs text-muted-foreground">£{business.leads_purchased * 20} spent</p>
                      </td>
                      <td className="p-4 text-muted-foreground">
                        {format(new Date(business.created_at), "d MMM yyyy")}
                      </td>
                      <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => viewProfile(business)}>
                              <Eye className="w-4 h-4 mr-2" />
                              View Profile
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => {
                              setSelectedBusiness(business);
                              setIsAddCreditsOpen(true);
                            }}>
                              <PlusCircle className="w-4 h-4 mr-2 text-green-500" />
                              Add Credits
                            </DropdownMenuItem>
                            {business.email && (
                              <DropdownMenuItem onClick={() => {
                                setSelectedBusiness(business);
                                setIsSendEmailOpen(true);
                              }}>
                                <Mail className="w-4 h-4 mr-2 text-blue-500" />
                                Send Email
                              </DropdownMenuItem>
                            )}
                            {!business.is_verified && (
                              <DropdownMenuItem onClick={() => verifyBusiness(business)}>
                                <Shield className="w-4 h-4 mr-2 text-green-500" />
                                Verify Business
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            {business.is_suspended ? (
                              <DropdownMenuItem
                                onClick={() => handleUnsuspend(business)}
                                className="text-green-500"
                              >
                                <CheckCircle className="w-4 h-4 mr-2" />
                                Unsuspend
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                onClick={() => openSuspendDialog(business)}
                                className="text-destructive"
                              >
                                <Ban className="w-4 h-4 mr-2" />
                                Suspend
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <PaginationControls
              currentPage={pagination.currentPage}
              totalPages={pagination.totalPages}
              totalItems={pagination.totalItems}
              pageSize={pagination.pageSize}
              onPageChange={pagination.goToPage}
              onPageSizeChange={pagination.changePageSize}
              hasNextPage={pagination.hasNextPage}
              hasPrevPage={pagination.hasPrevPage}
            />
          </>
        )}
      </div>

      {/* Business Profile Dialog */}
      <Dialog open={isProfileOpen} onOpenChange={setIsProfileOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              {selectedBusiness?.business_name || selectedBusiness?.contact_name || "Business Profile"}
              {selectedBusiness && getVerificationBadge(selectedBusiness)}
            </DialogTitle>
            <DialogDescription>
              Business details, verification documents and purchase history
            </DialogDescription>
          </DialogHeader>

          {selectedBusiness && (
            <Tabs defaultValue="details" className="mt-4">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="activity" className="flex items-center gap-1">
                  <History className="w-3 h-3" />
                  Activity
                </TabsTrigger>
                <TabsTrigger value="documents" className="flex items-center gap-1">
                  <FileText className="w-3 h-3" />
                  Documents
                </TabsTrigger>
                <TabsTrigger value="purchases">Purchases</TabsTrigger>
                <TabsTrigger value="logins" className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Logins
                </TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="space-y-4 mt-4">
                {/* Suspended Warning */}
                {selectedBusiness.is_suspended && (
                  <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-destructive">Account Suspended</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {selectedBusiness.suspension_reason || "No reason provided"}
                      </p>
                    </div>
                  </div>
                )}

                {/* Basic Details */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-muted-foreground text-xs flex items-center gap-1">
                      <Building2 className="w-3 h-3" /> Business Name
                    </Label>
                    <p className="font-medium">{selectedBusiness.business_name || "Not set"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-muted-foreground text-xs flex items-center gap-1">
                      <User className="w-3 h-3" /> Contact Name
                    </Label>
                    <p className="font-medium">{selectedBusiness.contact_name || "Not set"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-muted-foreground text-xs flex items-center gap-1">
                      <Mail className="w-3 h-3" /> Email
                    </Label>
                    <p className="font-medium">{selectedBusiness.email || "Not set"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-muted-foreground text-xs flex items-center gap-1">
                      <Phone className="w-3 h-3" /> Phone
                    </Label>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{selectedBusiness.phone || "Not set"}</p>
                      {selectedBusiness.phone_verified ? (
                        <>
                          <Badge className="bg-green-500/20 text-green-500 text-xs">Verified</Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => setIsUnlinkPhoneDialogOpen(true)}
                          >
                            <XCircle className="w-3 h-3 mr-1" />
                            Unlink
                          </Button>
                        </>
                      ) : (
                        <Badge variant="secondary" className="text-xs">Not Verified</Badge>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-muted-foreground text-xs flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> Postcode
                    </Label>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{selectedBusiness.postcode || "Not set"}</p>
                      {selectedBusiness.address_verified && (
                        <Badge className="bg-green-500/20 text-green-500 text-xs">Verified</Badge>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-muted-foreground text-xs">WhatsApp Opt-in</Label>
                    <p className="font-medium">{selectedBusiness.whatsapp_optin ? "Yes" : "No"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-muted-foreground text-xs flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> Joined
                    </Label>
                    <p className="font-medium">{format(new Date(selectedBusiness.created_at), "d MMM yyyy HH:mm")}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-muted-foreground text-xs flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> Last Login
                    </Label>
                    <p className="font-medium">
                      {selectedBusiness.last_login 
                        ? format(new Date(selectedBusiness.last_login), "d MMM yyyy HH:mm") 
                        : "Never"}
                    </p>
                  </div>
                </div>

                {/* Risk & Verification Status */}
                <div className="border-t border-border pt-4 mt-4">
                  <h4 className="font-medium mb-3">Verification & Risk</h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-muted/50 rounded-lg p-3 text-center">
                      <p className="text-sm text-muted-foreground">Status</p>
                      <div className="mt-1">{getVerificationBadge(selectedBusiness)}</div>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-3 text-center">
                      <p className="text-sm text-muted-foreground">Risk Score</p>
                      <div className="mt-1">{getRiskBadge(selectedBusiness.risk_score || 0)}</div>
                      <p className="text-xs text-muted-foreground mt-1">{selectedBusiness.risk_score || 0}/100</p>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-3 text-center">
                      <p className="text-sm text-muted-foreground">User ID</p>
                      <p className="text-xs font-mono mt-1 truncate">{selectedBusiness.user_id}</p>
                    </div>
                  </div>
                </div>

                {/* Account Summary */}
                <div className="border-t border-border pt-4 mt-4">
                  <h4 className="font-medium mb-3">Account Summary</h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-muted/50 rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold text-foreground">{selectedBusiness.leads_purchased}</p>
                      <p className="text-xs text-muted-foreground">Leads Purchased</p>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold text-foreground">£{selectedBusiness.leads_purchased * 20}</p>
                      <p className="text-xs text-muted-foreground">Total Spend</p>
                    </div>
                    <div className="bg-amber-500/10 rounded-lg p-3 text-center border border-amber-500/20">
                      <div className="flex items-center justify-center gap-1">
                        <Coins className="w-5 h-5 text-amber-500" />
                        <p className="text-2xl font-bold text-foreground">{selectedBusiness.credits}</p>
                      </div>
                      <p className="text-xs text-muted-foreground">Credits Balance</p>
                    </div>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="border-t border-border pt-4 mt-4">
                  <h4 className="font-medium mb-3">Quick Actions</h4>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsAddCreditsOpen(true)}
                    >
                      <PlusCircle className="w-4 h-4 mr-2" />
                      Add Credits
                    </Button>
                    {selectedBusiness.email && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsSendEmailOpen(true)}
                      >
                        <Mail className="w-4 h-4 mr-2" />
                        Send Email
                      </Button>
                    )}
                    {!selectedBusiness.is_verified && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => verifyBusiness(selectedBusiness)}
                      >
                        <Shield className="w-4 h-4 mr-2" />
                        Verify Business
                      </Button>
                    )}
                    {selectedBusiness.is_suspended ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-green-500 border-green-500/30"
                        onClick={() => handleUnsuspend(selectedBusiness)}
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Unsuspend
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive border-destructive/30"
                        onClick={() => openSuspendDialog(selectedBusiness)}
                      >
                        <Ban className="w-4 h-4 mr-2" />
                        Suspend
                      </Button>
                    )}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="activity" className="mt-4">
                <div className="text-center py-4">
                  <Button
                    onClick={() => {
                      setActivityTimelineUserId(selectedBusiness.user_id);
                      setIsActivityTimelineOpen(true);
                    }}
                    className="w-full"
                  >
                    <History className="w-4 h-4 mr-2" />
                    View Full Activity Timeline
                  </Button>
                  <p className="text-sm text-muted-foreground mt-3">
                    See all signups, logins, purchases, and profile changes in a chronological timeline.
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="documents" className="mt-4">
                {loadingDocs ? (
                  <div className="p-8 text-center">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                  </div>
                ) : verificationDocs.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No verification documents uploaded</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {verificationDocs.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border border-border"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                            <FileText className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">{getDocumentTypeName(doc.document_type)}</p>
                            <p className="text-xs text-muted-foreground">
                              Uploaded {format(new Date(doc.created_at), "d MMM yyyy HH:mm")}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {getDocStatusBadge(doc.status)}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => viewDocument(doc.file_path)}
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            View
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="purchases" className="mt-4">
                {loadingHistory ? (
                  <div className="p-8 text-center">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                  </div>
                ) : purchaseHistory.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    No purchase history
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {purchaseHistory.map((purchase) => (
                      <div
                        key={purchase.id}
                        className="flex items-center justify-between p-3 bg-muted/30 rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => {
                          setSelectedLead(purchase);
                          setIsLeadDetailsOpen(true);
                        }}
                      >
                        <div>
                          <p className="font-medium">{purchase.job_type}</p>
                          <p className="text-sm text-muted-foreground">
                            {purchase.postcode}
                          </p>
                        </div>
                        <div className="text-right flex items-center gap-3">
                          <div>
                            <p className="font-medium">£{(purchase.value / 100).toFixed(2)}</p>
                            <p className="text-sm text-muted-foreground">
                              {purchase.unlocked_at
                                ? format(new Date(purchase.unlocked_at), "d MMM yyyy")
                                : "N/A"}
                            </p>
                          </div>
                          <Eye className="w-4 h-4 text-muted-foreground" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="logins" className="mt-4">
                {loadingLoginHistory ? (
                  <div className="p-8 text-center">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                  </div>
                ) : loginHistory.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No login history recorded</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {loginHistory.map((login) => (
                      <div
                        key={login.id}
                        className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                            <Monitor className="w-4 h-4 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">
                              {format(new Date(login.login_at), "d MMM yyyy HH:mm")}
                            </p>
                            <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                              {login.user_agent?.split(' ').slice(0, 3).join(' ') || "Unknown device"}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          {login.ip_address && (
                            <p className="text-xs text-muted-foreground font-mono">
                              IP: {login.ip_address}
                            </p>
                          )}
                          {login.city || login.country ? (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground" title="Location is estimated based on IP address and may not be accurate">
                              <Globe className="w-3 h-3" />
                              <span className="italic">~{[login.city, login.country].filter(Boolean).join(", ")}</span>
                            </div>
                          ) : !login.ip_address && (
                            <span className="text-xs text-muted-foreground">No location data</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      {/* Document Viewer Dialog */}
      <Dialog open={isDocViewerOpen} onOpenChange={setIsDocViewerOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Document Viewer</DialogTitle>
          </DialogHeader>
          {viewingDocUrl && (
            <div className="mt-4">
              {viewingDocUrl.includes('.pdf') ? (
                <iframe
                  src={viewingDocUrl}
                  className="w-full h-[70vh] rounded-lg border"
                  title="Document Viewer"
                />
              ) : (
                <img
                  src={viewingDocUrl}
                  alt="Document"
                  className="max-w-full max-h-[70vh] mx-auto rounded-lg"
                />
              )}
              <div className="mt-4 flex justify-end">
                <Button
                  variant="outline"
                  onClick={() => window.open(viewingDocUrl, '_blank')}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Open in New Tab
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Credits Dialog */}
      <Dialog open={isAddCreditsOpen} onOpenChange={(open) => {
        setIsAddCreditsOpen(open);
        if (!open) {
          setCreditsToAdd("");
          setCreditsReason("");
        }
      }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Coins className="w-5 h-5 text-green-500" />
              Grant Credits
            </DialogTitle>
            <DialogDescription>
              Grant free credits to {selectedBusiness?.business_name || selectedBusiness?.contact_name}'s account. This will not count as a payment.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Current Balance</Label>
              <p className="text-2xl font-bold">{selectedBusiness?.credits || 0} credits</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="credits-amount">Credits to Grant</Label>
              <Input
                id="credits-amount"
                type="number"
                min="1"
                placeholder="Enter amount..."
                value={creditsToAdd}
                onChange={(e) => setCreditsToAdd(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="credits-reason">Reason (optional)</Label>
              <Input
                id="credits-reason"
                placeholder="e.g., Goodwill, Compensation, Promo..."
                value={creditsReason}
                onChange={(e) => setCreditsReason(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Document why credits are being granted for audit purposes.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddCreditsOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddCredits} disabled={addingCredits || !creditsToAdd}>
              {addingCredits && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Grant Credits
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send Email Dialog */}
      <Dialog open={isSendEmailOpen} onOpenChange={setIsSendEmailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5" />
              Send Email
            </DialogTitle>
            <DialogDescription>
              Send an email to {selectedBusiness?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email-subject">Subject</Label>
              <Input
                id="email-subject"
                placeholder="Enter subject..."
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email-body">Message</Label>
              <Textarea
                id="email-body"
                className="min-h-[150px]"
                placeholder="Enter your message..."
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSendEmailOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSendEmail} 
              disabled={sendingEmail || !emailSubject || !emailBody}
            >
              {sendingEmail && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Send Email
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Suspend Business Dialog */}
      <Dialog open={isSuspendDialogOpen} onOpenChange={setIsSuspendDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Ban className="w-5 h-5" />
              Suspend Business
            </DialogTitle>
            <DialogDescription>
              Suspending {suspendingBusiness?.business_name || suspendingBusiness?.contact_name} will prevent them from purchasing leads.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="suspension-reason">Suspension Reason</Label>
              <Textarea
                id="suspension-reason"
                placeholder="Enter reason for suspension..."
                value={suspensionReason}
                onChange={(e) => setSuspensionReason(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                This reason will be recorded and visible in the business profile.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSuspendDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleSuspend}>
              Suspend Business
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lead Details Dialog */}
      <Dialog open={isLeadDetailsOpen} onOpenChange={setIsLeadDetailsOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Customer Details
            </DialogTitle>
            <DialogDescription>
              Full details for this lead
            </DialogDescription>
          </DialogHeader>
          {selectedLead && (
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">Job Type</Label>
                  <p className="font-medium">{selectedLead.job_type}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">Value</Label>
                  <p className="font-medium">£{(selectedLead.value / 100).toFixed(2)}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">Customer Name</Label>
                  <p className="font-medium">{selectedLead.customer_name}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">Phone</Label>
                  <p className="font-medium">{selectedLead.customer_phone}</p>
                </div>
                <div className="col-span-2 space-y-1">
                  <Label className="text-muted-foreground text-xs">Email</Label>
                  <p className="font-medium">{selectedLead.customer_email}</p>
                </div>
                <div className="col-span-2 space-y-1">
                  <Label className="text-muted-foreground text-xs">Address</Label>
                  <p className="font-medium">{selectedLead.customer_address}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">Postcode</Label>
                  <p className="font-medium">{selectedLead.postcode}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">Service Date</Label>
                  <p className="font-medium">
                    {selectedLead.date ? format(new Date(selectedLead.date), "d MMM yyyy") : "Not set"}
                  </p>
                </div>
                {selectedLead.property_type && (
                  <div className="space-y-1">
                    <Label className="text-muted-foreground text-xs">Property Type</Label>
                    <p className="font-medium capitalize">{selectedLead.property_type}</p>
                  </div>
                )}
                {selectedLead.bedrooms && (
                  <div className="space-y-1">
                    <Label className="text-muted-foreground text-xs">Bedrooms</Label>
                    <p className="font-medium">{selectedLead.bedrooms}</p>
                  </div>
                )}
                {selectedLead.frequency && (
                  <div className="space-y-1">
                    <Label className="text-muted-foreground text-xs">Frequency</Label>
                    <p className="font-medium capitalize">{selectedLead.frequency}</p>
                  </div>
                )}
                <div className="col-span-2 space-y-1">
                  <Label className="text-muted-foreground text-xs">Purchased</Label>
                  <p className="font-medium">
                    {selectedLead.unlocked_at 
                      ? format(new Date(selectedLead.unlocked_at), "d MMM yyyy HH:mm") 
                      : "N/A"}
                  </p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsLeadDetailsOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Business Activity Timeline */}
      <BusinessActivityTimeline
        userId={activityTimelineUserId || ""}
        open={isActivityTimelineOpen}
        onOpenChange={(open) => {
          setIsActivityTimelineOpen(open);
          if (!open) setActivityTimelineUserId(null);
        }}
      />

      {/* Unlink Phone Confirmation Dialog */}
      <Dialog open={isUnlinkPhoneDialogOpen} onOpenChange={setIsUnlinkPhoneDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Phone className="w-5 h-5" />
              Unlink Phone Number
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to unlink the phone number <strong>{selectedBusiness?.phone}</strong> from this account?
            </DialogDescription>
          </DialogHeader>
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 my-4">
            <p className="text-sm text-amber-700 dark:text-amber-300">
              <strong>Warning:</strong> This will:
            </p>
            <ul className="text-sm text-amber-700 dark:text-amber-300 mt-2 ml-4 list-disc space-y-1">
              <li>Mark the phone as unverified for this account</li>
              <li>Require the user to verify their phone again</li>
              <li>Allow another user to verify this phone number</li>
            </ul>
          </div>
          <DialogFooter className="gap-2">
            <Button 
              variant="outline" 
              onClick={() => setIsUnlinkPhoneDialogOpen(false)}
              disabled={unlinkingPhone}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleUnlinkPhone}
              disabled={unlinkingPhone}
            >
              {unlinkingPhone ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Unlinking...
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4 mr-2" />
                  Unlink Phone
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
