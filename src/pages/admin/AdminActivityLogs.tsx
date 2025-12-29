import { useState, useEffect } from "react";
import {
  Search,
  Loader2,
  FileText,
  CreditCard,
  Eye,
  LogIn,
  RefreshCcw,
  Filter,
  Download,
  User,
  MapPin,
  Clock,
  Hash,
  ChevronRight,
  AlertCircle,
  CheckCircle,
  XCircle,
  Shield,
  Upload,
  MessageCircle,
  Mail,
  Phone,
  ArrowRight,
  Send,
  MessageSquare,
  Smartphone,
  History,
} from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, isToday, isYesterday, startOfDay } from "date-fns";
import { useAdmin } from "@/contexts/AdminContext";
import { usePagination } from "@/hooks/usePagination";
import { PaginationControls } from "@/components/admin/PaginationControls";
import { exportToCsv } from "@/lib/exportCsv";
import LeadActivityTimeline from "@/components/admin/LeadActivityTimeline";
import BusinessActivityTimeline from "@/components/admin/BusinessActivityTimeline";
interface ActivityLog {
  id: string;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: unknown;
  ip_address: string | null;
  created_at: string;
  user_name?: string | null;
  // Lead details for enriched context
  lead_customer_name?: string | null;
  lead_customer_email?: string | null;
  lead_customer_phone?: string | null;
  lead_postcode?: string | null;
  lead_job_type?: string | null;
}

const ACTION_ICONS: Record<string, any> = {
  login: LogIn,
  view: Eye,
  purchase: CreditCard,
  refund: RefreshCcw,
  update: FileText,
  credits_added: CreditCard,
  credits_purchased: CreditCard,
  verification_approved: CheckCircle,
  verification_rejected: XCircle,
  document_uploaded: Upload,
  suspension: Shield,
  confirmation_sent: Send,
  customer_response: MessageSquare,
  auto_published: CheckCircle,
  status_change: RefreshCcw,
  job_status_change: CheckCircle,
  lead_created: FileText,
  signup: User,
  profile_update: User,
};

const ACTION_LABELS: Record<string, string> = {
  login: "User Login",
  view: "Viewed Resource",
  purchase: "Lead Purchased",
  refund: "Refund Issued",
  update: "Record Updated",
  credits_added: "Credits Added (Admin)",
  credits_purchased: "Credits Purchased",
  verification_approved: "Verification Approved",
  verification_rejected: "Verification Rejected",
  document_uploaded: "Document Uploaded",
  suspension: "Account Suspension",
  confirmation_sent: "Confirmation Sent",
  customer_response: "Customer Response",
  auto_published: "Auto-Published",
  status_change: "Status Changed",
  job_status_change: "Job Status Updated",
  lead_created: "Lead Submitted",
  signup: "Business Signup",
  profile_update: "Profile Updated",
};

const ENTITY_LABELS: Record<string, string> = {
  lead: "Lead",
  profile: "User Profile",
  business: "Business",
  credits: "Credits",
  verification: "Verification",
  document: "Document",
  dispute: "Dispute",
  session: "Session",
};

export default function AdminActivityLogs() {
  const { getDateFilter, dateRange } = useAdmin();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [entityFilter, setEntityFilter] = useState<string>("all");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [selectedLog, setSelectedLog] = useState<ActivityLog | null>(null);
  const [timelineLeadId, setTimelineLeadId] = useState<string | null>(null);
  const [timelineBusinessUserId, setTimelineBusinessUserId] = useState<string | null>(null);

  useEffect(() => {
    fetchLogs();
  }, [dateRange]);

  useEffect(() => {
    const channel = supabase
      .channel('admin-activity-logs-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'activity_logs' },
        () => {
          fetchLogs();
          toast.info('New activity logged', { 
            description: 'Activity feed updated',
            duration: 2000 
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [dateRange]);

  const fetchLogs = async () => {
    setLoading(true);
    const { start, end } = getDateFilter();
    
    const { data, error } = await supabase
      .from("activity_logs")
      .select("*")
      .gte("created_at", start.toISOString())
      .lte("created_at", end.toISOString())
      .order("created_at", { ascending: false })
      .limit(1000);

    if (error) {
      console.error("Error fetching logs:", error);
      toast.error("Failed to load activity logs");
      setLoading(false);
      return;
    }

    // Get unique user IDs and lead IDs
    const userIds = [...new Set((data || []).map(log => log.user_id))];
    const leadIds = [...new Set((data || []).filter(log => log.entity_type === 'lead' && log.entity_id).map(log => log.entity_id))];
    
    // Fetch profiles
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, business_name, contact_name")
      .in("user_id", userIds);

    // Fetch lead details for enriched context
    const { data: leads } = leadIds.length > 0 
      ? await supabase
          .from("leads")
          .select("id, customer_name, customer_email, customer_phone, postcode, job_type")
          .in("id", leadIds)
      : { data: [] };

    const userNameMap = new Map(
      (profiles || []).map(p => [
        p.user_id, 
        p.business_name || p.contact_name || null
      ])
    );

    const leadMap = new Map(
      (leads || []).map(l => [l.id, l])
    );

    // Enrich logs with user names and lead details
    const logsWithDetails = (data || []).map(log => {
      const lead = log.entity_id ? leadMap.get(log.entity_id) : null;
      return {
        ...log,
        user_name: userNameMap.get(log.user_id) || null,
        lead_customer_name: lead?.customer_name || null,
        lead_customer_email: lead?.customer_email || null,
        lead_customer_phone: lead?.customer_phone || null,
        lead_postcode: lead?.postcode || null,
        lead_job_type: lead?.job_type || null,
      };
    });

    setLogs(logsWithDetails);
    setLoading(false);
  };

  const getActionIcon = (action: string) => {
    const Icon = ACTION_ICONS[action] || FileText;
    return <Icon className="w-4 h-4" />;
  };

  const getActionBadge = (action: string) => {
    const variants: Record<string, string> = {
      login: "bg-blue-500/20 text-blue-500",
      view: "bg-gray-500/20 text-gray-500",
      purchase: "bg-green-500/20 text-green-500",
      refund: "bg-amber-500/20 text-amber-500",
      update: "bg-purple-500/20 text-purple-500",
      credits_added: "bg-green-500/20 text-green-500",
      credits_purchased: "bg-emerald-500/20 text-emerald-500",
      verification_approved: "bg-green-500/20 text-green-500",
      verification_rejected: "bg-red-500/20 text-red-500",
      document_uploaded: "bg-blue-500/20 text-blue-500",
      suspension: "bg-red-500/20 text-red-500",
      confirmation_sent: "bg-blue-500/20 text-blue-500",
      customer_response: "bg-emerald-500/20 text-emerald-500",
      auto_published: "bg-amber-500/20 text-amber-500",
      status_change: "bg-purple-500/20 text-purple-500",
      job_status_change: "bg-cyan-500/20 text-cyan-500",
      signup: "bg-indigo-500/20 text-indigo-500",
      profile_update: "bg-violet-500/20 text-violet-500",
    };
    return variants[action] || "bg-muted text-muted-foreground";
  };

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.user_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (log.user_name?.toLowerCase() || "").includes(searchQuery.toLowerCase()) ||
      (log.lead_customer_name?.toLowerCase() || "").includes(searchQuery.toLowerCase()) ||
      log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.entity_type.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesEntity = entityFilter === "all" || log.entity_type === entityFilter;
    const matchesAction = actionFilter === "all" || log.action === actionFilter;
    return matchesSearch && matchesEntity && matchesAction;
  });

  // Group logs by date
  const groupedLogs = filteredLogs.reduce((acc, log) => {
    const date = startOfDay(new Date(log.created_at)).toISOString();
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(log);
    return acc;
  }, {} as Record<string, ActivityLog[]>);

  const sortedDateKeys = Object.keys(groupedLogs).sort((a, b) => 
    new Date(b).getTime() - new Date(a).getTime()
  );

  const pagination = usePagination(filteredLogs);

  const handleExport = () => {
    exportToCsv(filteredLogs.map(log => ({
      ...log,
      user_display: log.user_name || log.user_id,
    })), "activity_logs", [
      { key: "created_at", label: "Timestamp" },
      { key: "action", label: "Action" },
      { key: "entity_type", label: "Entity Type" },
      { key: "user_display", label: "User" },
      { key: "lead_customer_name", label: "Customer" },
      { key: "details", label: "Details" },
    ]);
    toast.success("Export started");
  };

  const uniqueEntities = [...new Set(logs.map((l) => l.entity_type))];
  const uniqueActions = [...new Set(logs.map((l) => l.action))];

  const getDateLabel = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) return "Today";
    if (isYesterday(date)) return "Yesterday";
    return format(date, "EEEE, d MMMM yyyy");
  };

  const formatDetailValue = (value: unknown): string => {
    if (value === null || value === undefined) return "-";
    if (typeof value === "boolean") return value ? "Yes" : "No";
    if (typeof value === "number") return value.toLocaleString();
    if (typeof value === "string") return value;
    if (Array.isArray(value)) return value.join(", ");
    if (typeof value === "object") return JSON.stringify(value, null, 2);
    return String(value);
  };

  const getDetailLabel = (key: string): string => {
    const labels: Record<string, string> = {
      lead_id: "Lead ID",
      credits: "Credits",
      amount: "Amount",
      reason: "Reason",
      postcode: "Postcode",
      job_type: "Job Type",
      customer_name: "Customer Name",
      status: "Status",
      old_status: "Previous Status",
      new_status: "New Status",
      previous_status: "Previous Status",
      document_type: "Document Type",
      business_name: "Business Name",
      contact_name: "Contact Name",
      payment_method: "Payment Method",
      credits_remaining: "Credits Remaining",
      amount_paid: "Amount Paid",
      is_new_user: "New User",
      notes: "Notes",
      admin_notes: "Admin Notes",
      ip_address: "IP Address",
      user_agent: "User Agent",
      session_id: "Session ID",
      value: "Value",
      display_value: "Display Value",
      method: "Method",
      auto_publish_at: "Auto-Publish At",
      customer_response: "Customer Reply",
      is_positive: "Positive Response",
    };
    return labels[key] || key.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
  };

  const getActivitySummary = (log: ActivityLog): string => {
    const details = (typeof log.details === 'object' && log.details !== null) 
      ? log.details as Record<string, unknown> 
      : null;
    
    if (log.action === "confirmation_sent") {
      const method = details?.method === "whatsapp" ? "WhatsApp" : "SMS";
      return `${method} sent to ${log.lead_customer_name || "customer"}`;
    }
    if (log.action === "customer_response") {
      const response = details?.customer_response || "";
      const isPositive = details?.is_positive;
      return `${log.lead_customer_name || "Customer"} replied "${response}" ${isPositive ? "✓" : "✗"}`;
    }
    if (log.action === "auto_published") {
      return `Lead auto-published (no response from ${log.lead_customer_name || "customer"})`;
    }
    if (log.action === "purchase") {
      const businessName = details?.business_name || log.user_name || "Unknown";
      const paymentMethod = details?.payment_method === "credit" ? "using credit" : "via Stripe";
      return `${businessName} purchased lead ${paymentMethod}`;
    }
    if (log.action === "job_status_change" && details) {
      const businessName = details?.business_name || log.user_name || "Business";
      const prevStatus = details?.previous_status || "pending";
      const newStatus = details?.new_status || "unknown";
      return `${businessName}: ${prevStatus} → ${newStatus}`;
    }
    if (log.action === "credits_added" && details) {
      return `Admin added ${details.credits || details.amount || "?"} credits to ${details.business_name || log.user_name || "business"}`;
    }
    if (log.action === "credits_purchased" && details) {
      const businessName = details?.business_name || log.user_name || "Business";
      return `${businessName} purchased ${details.credits_added || "?"} credits via Stripe`;
    }
    if (log.action === "refund" && details) {
      return `Refunded lead: ${details.reason || "No reason provided"}`;
    }
    if (log.action === "verification_approved") {
      return `Approved ${details?.document_type || "verification"} document`;
    }
    if (log.action === "verification_rejected") {
      return `Rejected ${details?.document_type || "verification"} document`;
    }
    if (log.action === "login") {
      const businessName = details?.business_name || log.user_name || "User";
      const location = details?.city && details?.country 
        ? ` from ${details.city}, ${details.country}` 
        : "";
      return `${businessName} logged in${location}`;
    }
    if (log.action === "signup") {
      const businessName = details?.business_name || log.user_name || "New Business";
      const postcode = details?.postcode ? ` (${details.postcode})` : "";
      return `${businessName} completed signup${postcode}`;
    }
    if (log.action === "profile_update") {
      const businessName = details?.business_name || log.user_name || "Business";
      return `${businessName} updated their profile`;
    }
    if (log.action === "status_change" && details) {
      return `Status: ${details.previous_status} → ${details.new_status}`;
    }
    
    return ACTION_LABELS[log.action] || log.action;
  };

  return (
    <AdminLayout title="Activity Logs">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Activity Logs</h1>
            <p className="text-muted-foreground">Full audit trail of system activity</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleExport}>
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
            <Button variant="outline" onClick={fetchLogs} disabled={loading}>
              <RefreshCcw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by user or customer name..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                pagination.resetPage();
              }}
              className="pl-9"
            />
          </div>
          <Select value={entityFilter} onValueChange={(v) => { setEntityFilter(v); pagination.resetPage(); }}>
            <SelectTrigger className="w-[150px]">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Entity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Entities</SelectItem>
              {uniqueEntities.map((entity) => (
                <SelectItem key={entity} value={entity}>
                  {ENTITY_LABELS[entity] || entity}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v); pagination.resetPage(); }}>
            <SelectTrigger className="w-[150px]">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Action" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Actions</SelectItem>
              {uniqueActions.map((action) => (
                <SelectItem key={action} value={action}>
                  {ACTION_LABELS[action] || action}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Grouped Activity Feed */}
        <div className="space-y-6">
          {loading ? (
            <div className="bg-card rounded-xl border border-border p-8 text-center">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-secondary" />
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="bg-card rounded-xl border border-border p-8 text-center text-muted-foreground">
              No activity logs found
            </div>
          ) : (
            sortedDateKeys.map((dateKey) => (
              <div key={dateKey} className="space-y-3">
                {/* Date Header */}
                <div className="flex items-center gap-3">
                  <h3 className="text-sm font-semibold text-muted-foreground">
                    {getDateLabel(dateKey)}
                  </h3>
                  <div className="flex-1 h-px bg-border" />
                  <Badge variant="secondary" className="text-xs">
                    {groupedLogs[dateKey].length} activities
                  </Badge>
                </div>

                {/* Activity Cards */}
                <div className="space-y-2">
                  {groupedLogs[dateKey].map((log) => (
                    <button
                      key={log.id}
                      onClick={() => setSelectedLog(log)}
                      className="w-full bg-card rounded-lg border border-border p-4 hover:bg-muted/50 transition-colors text-left group"
                    >
                      <div className="flex items-start gap-4">
                        {/* Icon */}
                        <div className={`p-2 rounded-full ${getActionBadge(log.action)}`}>
                          {getActionIcon(log.action)}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-medium text-foreground">
                                {getActivitySummary(log)}
                              </p>
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-sm text-muted-foreground">
                                {log.lead_customer_name && (
                                  <>
                                    <span className="flex items-center gap-1">
                                      <User className="w-3 h-3" />
                                      {log.lead_customer_name}
                                    </span>
                                    <span>•</span>
                                  </>
                                )}
                                {log.lead_postcode && (
                                  <>
                                    <span className="flex items-center gap-1">
                                      <MapPin className="w-3 h-3" />
                                      {log.lead_postcode}
                                    </span>
                                    <span>•</span>
                                  </>
                                )}
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {format(new Date(log.created_at), "HH:mm")}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">
                                {ENTITY_LABELS[log.entity_type] || log.entity_type}
                              </Badge>
                              <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pagination */}
        {!loading && filteredLogs.length > 0 && (
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
        )}
      </div>

      {/* Detail Modal */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className={`p-2 rounded-full ${selectedLog ? getActionBadge(selectedLog.action) : ""}`}>
                {selectedLog && getActionIcon(selectedLog.action)}
              </div>
              <span>{selectedLog ? (ACTION_LABELS[selectedLog.action] || selectedLog.action) : ""}</span>
            </DialogTitle>
          </DialogHeader>

          {selectedLog && (
            <div className="space-y-6">
              {/* Summary Card */}
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-foreground font-medium text-lg">
                      {getActivitySummary(selectedLog)}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {format(new Date(selectedLog.created_at), "d MMMM yyyy 'at' HH:mm:ss")}
                    </p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    {selectedLog.entity_type === "lead" && selectedLog.entity_id && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          setSelectedLog(null);
                          setTimelineLeadId(selectedLog.entity_id);
                        }}
                      >
                        <History className="w-4 h-4 mr-2" />
                        Lead Timeline
                      </Button>
                    )}
                    {selectedLog.entity_type === "business" && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          setSelectedLog(null);
                          setTimelineBusinessUserId(selectedLog.user_id);
                        }}
                      >
                        <History className="w-4 h-4 mr-2" />
                        Business Timeline
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {/* Communication Flow - Show for confirmation/response actions */}
              {(selectedLog.action === "confirmation_sent" || selectedLog.action === "customer_response") && (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Communication Flow</p>
                  <div className="bg-muted/30 rounded-lg p-4">
                    {selectedLog.action === "confirmation_sent" && (
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 bg-background rounded-lg px-3 py-2 border">
                          <Shield className="w-4 h-4 text-primary" />
                          <span className="font-medium">Cleanda</span>
                        </div>
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <ArrowRight className="w-4 h-4" />
                          {(selectedLog.details as any)?.method === "whatsapp" ? (
                            <MessageCircle className="w-4 h-4 text-green-500" />
                          ) : (
                            <Smartphone className="w-4 h-4 text-blue-500" />
                          )}
                        </div>
                        <div className="flex items-center gap-2 bg-background rounded-lg px-3 py-2 border flex-1">
                          <User className="w-4 h-4 text-muted-foreground" />
                          <div className="min-w-0">
                            <p className="font-medium truncate">{selectedLog.lead_customer_name || "Customer"}</p>
                            <p className="text-xs text-muted-foreground">{selectedLog.lead_customer_phone}</p>
                          </div>
                        </div>
                      </div>
                    )}
                    {selectedLog.action === "customer_response" && (
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 bg-background rounded-lg px-3 py-2 border flex-1">
                          <User className="w-4 h-4 text-muted-foreground" />
                          <div className="min-w-0">
                            <p className="font-medium truncate">{selectedLog.lead_customer_name || "Customer"}</p>
                            <p className="text-xs text-muted-foreground">{selectedLog.lead_customer_phone}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <MessageSquare className="w-4 h-4 text-emerald-500" />
                          <ArrowRight className="w-4 h-4" />
                        </div>
                        <div className="flex items-center gap-2 bg-background rounded-lg px-3 py-2 border">
                          <Shield className="w-4 h-4 text-primary" />
                          <span className="font-medium">Cleanda</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Customer Details - Show for lead-related actions */}
              {selectedLog.lead_customer_name && (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Customer Details</p>
                  <div className="bg-muted/30 rounded-lg divide-y divide-border">
                    <div className="flex items-center justify-between p-3">
                      <span className="text-sm text-muted-foreground flex items-center gap-2">
                        <User className="w-4 h-4" />
                        Name
                      </span>
                      <span className="text-sm font-medium">{selectedLog.lead_customer_name}</span>
                    </div>
                    {selectedLog.lead_customer_phone && (
                      <div className="flex items-center justify-between p-3">
                        <span className="text-sm text-muted-foreground flex items-center gap-2">
                          <Phone className="w-4 h-4" />
                          Phone
                        </span>
                        <span className="text-sm font-medium font-mono">{selectedLog.lead_customer_phone}</span>
                      </div>
                    )}
                    {selectedLog.lead_customer_email && (
                      <div className="flex items-center justify-between p-3">
                        <span className="text-sm text-muted-foreground flex items-center gap-2">
                          <Mail className="w-4 h-4" />
                          Email
                        </span>
                        <span className="text-sm font-medium">{selectedLog.lead_customer_email}</span>
                      </div>
                    )}
                    {selectedLog.lead_postcode && (
                      <div className="flex items-center justify-between p-3">
                        <span className="text-sm text-muted-foreground flex items-center gap-2">
                          <MapPin className="w-4 h-4" />
                          Postcode
                        </span>
                        <span className="text-sm font-medium">{selectedLog.lead_postcode}</span>
                      </div>
                    )}
                    {selectedLog.lead_job_type && (
                      <div className="flex items-center justify-between p-3">
                        <span className="text-sm text-muted-foreground flex items-center gap-2">
                          <FileText className="w-4 h-4" />
                          Job Type
                        </span>
                        <span className="text-sm font-medium">{selectedLog.lead_job_type}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Action Details */}
              {selectedLog.details && typeof selectedLog.details === 'object' && Object.keys(selectedLog.details).length > 0 && (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Action Details</p>
                  <div className="bg-muted/30 rounded-lg divide-y divide-border">
                    {Object.entries(selectedLog.details as Record<string, unknown>).map(([key, value]) => (
                      <div key={key} className="flex items-start justify-between p-3">
                        <span className="text-sm text-muted-foreground">
                          {getDetailLabel(key)}
                        </span>
                        <span className="text-sm font-medium text-right max-w-[60%] break-words">
                          {key === "method" ? (
                            <Badge variant="outline" className="capitalize">
                              {value === "whatsapp" ? "WhatsApp" : String(value)}
                            </Badge>
                          ) : key === "is_positive" ? (
                            value ? (
                              <Badge className="bg-green-500/20 text-green-600">Positive</Badge>
                            ) : (
                              <Badge className="bg-red-500/20 text-red-600">Negative</Badge>
                            )
                          ) : key === "auto_publish_at" ? (
                            format(new Date(String(value)), "d MMM yyyy 'at' HH:mm")
                          ) : (
                            formatDetailValue(value)
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* System Info */}
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">System Information</p>
                <div className="bg-muted/30 rounded-lg divide-y divide-border">
                  {selectedLog.user_name && (
                    <div className="flex items-center justify-between p-3">
                      <span className="text-sm text-muted-foreground">Triggered By</span>
                      <span className="text-sm font-medium">{selectedLog.user_name}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between p-3">
                    <span className="text-sm text-muted-foreground">User ID</span>
                    <span className="text-xs font-mono text-muted-foreground">{selectedLog.user_id.slice(0, 16)}...</span>
                  </div>
                  {selectedLog.entity_id && (
                    <div className="flex items-center justify-between p-3">
                      <span className="text-sm text-muted-foreground">Entity ID</span>
                      <span className="text-xs font-mono text-muted-foreground">{selectedLog.entity_id.slice(0, 16)}...</span>
                    </div>
                  )}
                  {selectedLog.ip_address && (
                    <div className="flex items-center justify-between p-3">
                      <span className="text-sm text-muted-foreground">IP Address</span>
                      <span className="text-sm font-mono">{selectedLog.ip_address}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Lead Activity Timeline */}
      <LeadActivityTimeline
        leadId={timelineLeadId || ""}
        open={!!timelineLeadId}
        onOpenChange={(open) => !open && setTimelineLeadId(null)}
      />

      {/* Business Activity Timeline */}
      <BusinessActivityTimeline
        userId={timelineBusinessUserId || ""}
        open={!!timelineBusinessUserId}
        onOpenChange={(open) => !open && setTimelineBusinessUserId(null)}
      />
    </AdminLayout>
  );
}
