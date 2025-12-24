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
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
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
};

export default function AdminActivityLogs() {
  const { getDateFilter, dateRange } = useAdmin();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [entityFilter, setEntityFilter] = useState<string>("all");
  const [actionFilter, setActionFilter] = useState<string>("all");

  useEffect(() => {
    fetchLogs();
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

    // Fetch user names for all unique user_ids
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

    // Add user names to logs
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
                  {entity}
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
                  {action}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Logs Table */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          {loading ? (
            <div className="p-8 text-center">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-secondary" />
            </div>
          ) : pagination.paginatedData.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              No activity logs found
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-4 font-medium text-muted-foreground">Timestamp</th>
                      <th className="text-left p-4 font-medium text-muted-foreground">Action</th>
                      <th className="text-left p-4 font-medium text-muted-foreground">Entity</th>
                      <th className="text-left p-4 font-medium text-muted-foreground">User</th>
                      <th className="text-left p-4 font-medium text-muted-foreground">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {pagination.paginatedData.map((log) => (
                      <tr key={log.id} className="hover:bg-muted/30">
                        <td className="p-4 text-sm text-muted-foreground whitespace-nowrap">
                          {format(new Date(log.created_at), "d MMM yyyy HH:mm:ss")}
                        </td>
                        <td className="p-4">
                          <Badge className={getActionBadge(log.action)}>
                            <span className="flex items-center gap-1">
                              {getActionIcon(log.action)}
                              {log.action}
                            </span>
                          </Badge>
                        </td>
                        <td className="p-4">
                          <Badge variant="outline">{log.entity_type}</Badge>
                        </td>
                        <td className="p-4">
                          {log.user_name ? (
                            <div>
                              <p className="font-medium text-foreground">{log.user_name}</p>
                              <p className="font-mono text-xs text-muted-foreground">
                                {log.user_id.slice(0, 8)}...
                              </p>
                            </div>
                          ) : (
                            <p className="font-mono text-sm text-muted-foreground">
                              {log.user_id.slice(0, 8)}...
                            </p>
                          )}
                        </td>
                        <td className="p-4 text-sm text-muted-foreground max-w-xs truncate">
                          {log.details ? JSON.stringify(log.details) : "-"}
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
      </div>
    </AdminLayout>
  );
}
