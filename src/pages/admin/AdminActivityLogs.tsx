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
}

const ACTION_ICONS: Record<string, any> = {
  login: LogIn,
  view: Eye,
  purchase: CreditCard,
  refund: RefreshCcw,
  update: FileText,
  credits_added: CreditCard,
  verification_approved: CheckCircle,
  verification_rejected: XCircle,
  document_uploaded: Upload,
  suspension: Shield,
};

const ACTION_LABELS: Record<string, string> = {
  login: "User Login",
  view: "Viewed Resource",
  purchase: "Lead Purchased",
  refund: "Refund Issued",
  update: "Record Updated",
  credits_added: "Credits Added",
  verification_approved: "Verification Approved",
  verification_rejected: "Verification Rejected",
  document_uploaded: "Document Uploaded",
  suspension: "Account Suspension",
};

const ENTITY_LABELS: Record<string, string> = {
  lead: "Lead",
  profile: "User Profile",
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

    const userIds = [...new Set((data || []).map(log => log.user_id))];
    
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, business_name, contact_name")
      .in("user_id", userIds);

    const userNameMap = new Map(
      (profiles || []).map(p => [
        p.user_id, 
        p.business_name || p.contact_name || null
      ])
    );

    const logsWithNames = (data || []).map(log => ({
      ...log,
      user_name: userNameMap.get(log.user_id) || null,
    }));

    setLogs(logsWithNames);
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
      verification_approved: "bg-green-500/20 text-green-500",
      verification_rejected: "bg-red-500/20 text-red-500",
      document_uploaded: "bg-blue-500/20 text-blue-500",
      suspension: "bg-red-500/20 text-red-500",
    };
    return variants[action] || "bg-muted text-muted-foreground";
  };

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.user_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (log.user_name?.toLowerCase() || "").includes(searchQuery.toLowerCase()) ||
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
      document_type: "Document Type",
      business_name: "Business Name",
      admin_notes: "Admin Notes",
      ip_address: "IP Address",
      user_agent: "User Agent",
      session_id: "Session ID",
      value: "Value",
      display_value: "Display Value",
    };
    return labels[key] || key.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
  };

  const getActivitySummary = (log: ActivityLog): string => {
    const action = ACTION_LABELS[log.action] || log.action;
    const entity = ENTITY_LABELS[log.entity_type] || log.entity_type;
    const details = (typeof log.details === 'object' && log.details !== null) 
      ? log.details as Record<string, unknown> 
      : null;
    
    if (log.action === "purchase" && details) {
      return `Purchased lead in ${details.postcode || "unknown area"}`;
    }
    if (log.action === "credits_added" && details) {
      return `Added ${details.credits || details.amount || "?"} credits`;
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
      return "User logged into the system";
    }
    
    return `${action} on ${entity}`;
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
              placeholder="Search by user name or ID..."
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
                              <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                                <User className="w-3 h-3" />
                                <span>{log.user_name || log.user_id.slice(0, 8) + "..."}</span>
                                <span>•</span>
                                <Clock className="w-3 h-3" />
                                <span>{format(new Date(log.created_at), "HH:mm")}</span>
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
        <DialogContent className="max-w-lg">
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
              {/* Summary */}
              <div className="bg-muted/50 rounded-lg p-4">
                <p className="text-foreground font-medium">
                  {getActivitySummary(selectedLog)}
                </p>
              </div>

              {/* Metadata */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">User</p>
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <div>
                      {selectedLog.user_name && (
                        <p className="font-medium">{selectedLog.user_name}</p>
                      )}
                      <p className="text-xs text-muted-foreground font-mono">
                        {selectedLog.user_id.slice(0, 12)}...
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Timestamp</p>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{format(new Date(selectedLog.created_at), "HH:mm:ss")}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(selectedLog.created_at), "d MMMM yyyy")}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Entity Type</p>
                  <Badge variant="outline">
                    {ENTITY_LABELS[selectedLog.entity_type] || selectedLog.entity_type}
                  </Badge>
                </div>

                {selectedLog.entity_id && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Entity ID</p>
                    <div className="flex items-center gap-2">
                      <Hash className="w-4 h-4 text-muted-foreground" />
                      <p className="text-xs font-mono">{selectedLog.entity_id.slice(0, 12)}...</p>
                    </div>
                  </div>
                )}

                {selectedLog.ip_address && (
                  <div className="space-y-1 col-span-2">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">IP Address</p>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-muted-foreground" />
                      <p className="font-mono text-sm">{selectedLog.ip_address}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Details */}
              {selectedLog.details && typeof selectedLog.details === 'object' && Object.keys(selectedLog.details).length > 0 && (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Transaction Details</p>
                  <div className="bg-muted/30 rounded-lg divide-y divide-border">
                    {Object.entries(selectedLog.details as Record<string, unknown>).map(([key, value]) => (
                      <div key={key} className="flex items-start justify-between p-3">
                        <span className="text-sm text-muted-foreground">
                          {getDetailLabel(key)}
                        </span>
                        <span className="text-sm font-medium text-right max-w-[60%] break-words">
                          {formatDetailValue(value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* No Details Message */}
              {(!selectedLog.details || typeof selectedLog.details !== 'object' || Object.keys(selectedLog.details).length === 0) && (
                <div className="flex items-center gap-2 text-muted-foreground text-sm bg-muted/30 rounded-lg p-4">
                  <AlertCircle className="w-4 h-4" />
                  <span>No additional details recorded for this activity</span>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
