import { useState, useEffect } from "react";
import {
  Search,
  Filter,
  Eye,
  MoreVertical,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Loader2,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

interface Lead {
  id: string;
  postcode: string;
  job_type: string;
  value: number;
  display_value: string;
  date: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  customer_address: string;
  is_unlocked: boolean;
  lead_status: string;
  quality_score: number;
  created_at: string;
  admin_notes: string | null;
}

const LEAD_STATUSES = [
  { value: "new", label: "New", color: "bg-blue-500/20 text-blue-500" },
  { value: "validated", label: "Validated", color: "bg-green-500/20 text-green-500" },
  { value: "needs_clarification", label: "Needs Clarification", color: "bg-amber-500/20 text-amber-500" },
  { value: "published", label: "Published", color: "bg-secondary/20 text-secondary" },
  { value: "purchased", label: "Purchased", color: "bg-purple-500/20 text-purple-500" },
  { value: "expired", label: "Expired", color: "bg-muted text-muted-foreground" },
  { value: "refunded", label: "Refunded", color: "bg-destructive/20 text-destructive" },
  { value: "spam", label: "Spam/Fraud", color: "bg-red-500/20 text-red-500" },
];

export default function AdminLeads() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"table" | "kanban">("table");

  useEffect(() => {
    fetchLeads();
  }, [statusFilter]);

  const fetchLeads = async () => {
    let query = supabase
      .from("leads")
      .select("*")
      .order("created_at", { ascending: false });

    if (statusFilter !== "all") {
      query = query.eq("lead_status", statusFilter);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching leads:", error);
      toast.error("Failed to load leads");
    } else {
      setLeads(data || []);
    }
    setLoading(false);
  };

  const updateLeadStatus = async (leadId: string, newStatus: string) => {
    const updateData: Record<string, any> = { lead_status: newStatus };

    if (newStatus === "validated") {
      updateData.validated_at = new Date().toISOString();
    } else if (newStatus === "published") {
      updateData.published_at = new Date().toISOString();
    } else if (newStatus === "expired") {
      updateData.expired_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from("leads")
      .update(updateData)
      .eq("id", leadId);

    if (error) {
      toast.error("Failed to update lead status");
    } else {
      toast.success(`Lead marked as ${newStatus}`);
      fetchLeads();
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = LEAD_STATUSES.find((s) => s.value === status);
    return (
      <Badge className={statusConfig?.color || "bg-muted"}>
        {statusConfig?.label || status}
      </Badge>
    );
  };

  const filteredLeads = leads.filter(
    (lead) =>
      lead.postcode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.job_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.customer_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <AdminLayout title="Lead Pipeline">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search leads..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {LEAD_STATUSES.map((status) => (
              <SelectItem key={status.value} value={status.value}>
                {status.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex gap-2">
          <Button
            variant={viewMode === "table" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("table")}
          >
            Table
          </Button>
          <Button
            variant={viewMode === "kanban" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("kanban")}
          >
            Kanban
          </Button>
        </div>
      </div>

      {/* Table View */}
      {viewMode === "table" && (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          {loading ? (
            <div className="p-8 text-center">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-secondary" />
            </div>
          ) : filteredLeads.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              No leads found
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-4 font-medium text-muted-foreground">Lead</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Location</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Value</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Status</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Date</th>
                    <th className="text-right p-4 font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredLeads.map((lead) => (
                    <tr key={lead.id} className="hover:bg-muted/30">
                      <td className="p-4">
                        <div>
                          <p className="font-medium text-foreground">{lead.customer_name}</p>
                          <p className="text-sm text-muted-foreground">{lead.job_type}</p>
                        </div>
                      </td>
                      <td className="p-4">
                        <p className="text-foreground">{lead.postcode}</p>
                      </td>
                      <td className="p-4">
                        <p className="text-foreground">{lead.display_value}</p>
                      </td>
                      <td className="p-4">{getStatusBadge(lead.lead_status || "new")}</td>
                      <td className="p-4 text-muted-foreground">
                        {format(new Date(lead.created_at), "d MMM yyyy")}
                      </td>
                      <td className="p-4 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>
                              <Eye className="w-4 h-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => updateLeadStatus(lead.id, "validated")}>
                              <CheckCircle className="w-4 h-4 mr-2 text-green-500" />
                              Validate
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => updateLeadStatus(lead.id, "published")}>
                              <Clock className="w-4 h-4 mr-2 text-secondary" />
                              Publish
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => updateLeadStatus(lead.id, "spam")}>
                              <XCircle className="w-4 h-4 mr-2 text-destructive" />
                              Mark as Spam
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Kanban View */}
      {viewMode === "kanban" && (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {LEAD_STATUSES.slice(0, 5).map((status) => (
            <div
              key={status.value}
              className="flex-shrink-0 w-72 bg-muted/30 rounded-xl p-4"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium text-foreground">{status.label}</h3>
                <Badge variant="secondary">
                  {filteredLeads.filter((l) => l.lead_status === status.value).length}
                </Badge>
              </div>

              <div className="space-y-3">
                {filteredLeads
                  .filter((lead) => lead.lead_status === status.value)
                  .map((lead) => (
                    <div
                      key={lead.id}
                      className="bg-card rounded-lg border border-border p-3"
                    >
                      <p className="font-medium text-foreground text-sm">
                        {lead.customer_name}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {lead.job_type}
                      </p>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-muted-foreground">
                          {lead.postcode}
                        </span>
                        <span className="text-xs font-medium text-secondary">
                          {lead.display_value}
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminLayout>
  );
}