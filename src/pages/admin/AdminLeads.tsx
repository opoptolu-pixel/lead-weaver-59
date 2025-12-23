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
  Edit,
  RotateCcw,
  Trash2,
  Send,
} from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { useAdmin } from "@/contexts/AdminContext";

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
  source: string | null;
  job_notes: string | null;
  is_unlocked: boolean;
  lead_status: string;
  quality_score: number;
  created_at: string;
  admin_notes: string | null;
  unlocked_by: string | null;
  unlocked_at: string | null;
  refund_reason: string | null;
  outcome_status: string | null;
  outcome_notes: string | null;
  lost_reason: string | null;
}

// Admin pipeline statuses
const LEAD_STATUSES = [
  { value: "new", label: "New", color: "bg-blue-500/20 text-blue-500" },
  { value: "approved", label: "Approved", color: "bg-cyan-500/20 text-cyan-500" },
  { value: "published", label: "Published", color: "bg-secondary/20 text-secondary" },
  { value: "purchased", label: "Purchased", color: "bg-purple-500/20 text-purple-500" },
  { value: "expired", label: "Expired", color: "bg-muted text-muted-foreground" },
  { value: "refunded", label: "Refunded", color: "bg-destructive/20 text-destructive" },
  { value: "spam", label: "Spam/Fraud", color: "bg-red-500/20 text-red-500" },
];

// Outcome tracking statuses (for purchased leads)
const OUTCOME_STATUSES = [
  { value: "purchased", label: "Purchased", color: "bg-purple-500/20 text-purple-500" },
  { value: "contacted", label: "Contacted", color: "bg-blue-500/20 text-blue-500" },
  { value: "booked", label: "Booked", color: "bg-cyan-500/20 text-cyan-500" },
  { value: "completed", label: "Completed", color: "bg-green-500/20 text-green-500" },
  { value: "lost", label: "Lost", color: "bg-destructive/20 text-destructive" },
];

const SOURCES = [
  { value: "facebook", label: "Facebook" },
  { value: "google", label: "Google" },
  { value: "organic", label: "Organic" },
  { value: "referral", label: "Referral" },
];

export default function AdminLeads() {
  const { getDateFilter, dateRange } = useAdmin();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"table" | "kanban">("table");
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [adminNotes, setAdminNotes] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchLeads();
  }, [statusFilter, dateRange]);

  const fetchLeads = async () => {
    const { start, end } = getDateFilter();
    
    let query = supabase
      .from("leads")
      .select("*")
      .gte("created_at", start.toISOString())
      .lte("created_at", end.toISOString())
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

  const updateLeadStatus = async (leadId: string, newStatus: string, additionalData?: Record<string, any>) => {
    setActionLoading(true);
    const updateData: Record<string, any> = { lead_status: newStatus, ...additionalData };

    if (newStatus === "approved") {
      updateData.validated_at = new Date().toISOString();
    } else if (newStatus === "published") {
      updateData.published_at = new Date().toISOString();
    } else if (newStatus === "expired") {
      updateData.expired_at = new Date().toISOString();
    } else if (newStatus === "refunded") {
      updateData.refunded_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from("leads")
      .update(updateData)
      .eq("id", leadId);

    setActionLoading(false);
    if (error) {
      toast.error("Failed to update lead status");
    } else {
      toast.success(`Lead marked as ${newStatus}`);
      fetchLeads();
      setIsDetailOpen(false);
    }
  };

  const handleViewDetails = (lead: Lead) => {
    setSelectedLead(lead);
    setAdminNotes(lead.admin_notes || "");
    setIsDetailOpen(true);
  };

  const handleSaveNotes = async () => {
    if (!selectedLead) return;
    setActionLoading(true);
    const { error } = await supabase
      .from("leads")
      .update({ admin_notes: adminNotes })
      .eq("id", selectedLead.id);

    setActionLoading(false);
    if (error) {
      toast.error("Failed to save notes");
    } else {
      toast.success("Notes saved");
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

  const getSourceBadge = (source: string | null) => {
    if (!source) return <span className="text-muted-foreground text-sm">-</span>;
    const colors: Record<string, string> = {
      facebook: "bg-blue-500/20 text-blue-500",
      google: "bg-red-500/20 text-red-500",
      organic: "bg-green-500/20 text-green-500",
      referral: "bg-amber-500/20 text-amber-500",
    };
    return (
      <Badge className={colors[source] || "bg-muted"}>
        {source.charAt(0).toUpperCase() + source.slice(1)}
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
                    <th className="text-left p-4 font-medium text-muted-foreground">Source</th>
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
                      <td className="p-4">{getSourceBadge(lead.source)}</td>
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
                            <DropdownMenuItem onClick={() => handleViewDetails(lead)}>
                              <Eye className="w-4 h-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => updateLeadStatus(lead.id, "approved")}>
                              <CheckCircle className="w-4 h-4 mr-2 text-cyan-500" />
                              Approve
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => updateLeadStatus(lead.id, "published")}>
                              <Send className="w-4 h-4 mr-2 text-secondary" />
                              Publish
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => updateLeadStatus(lead.id, "expired")}>
                              <Clock className="w-4 h-4 mr-2 text-muted-foreground" />
                              Expire
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => updateLeadStatus(lead.id, "refunded")}>
                              <RotateCcw className="w-4 h-4 mr-2 text-amber-500" />
                              Refund
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
          {LEAD_STATUSES.map((status) => (
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
                      className="bg-card rounded-lg border border-border p-3 cursor-pointer hover:border-secondary/50"
                      onClick={() => handleViewDetails(lead)}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-medium text-foreground text-sm">
                          {lead.customer_name}
                        </p>
                        {getSourceBadge(lead.source)}
                      </div>
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

      {/* Lead Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Lead Details</DialogTitle>
            <DialogDescription>
              Full homeowner and job information
            </DialogDescription>
          </DialogHeader>

          {selectedLead && (
            <div className="space-y-6 py-4">
              {/* Status and Source */}
              <div className="flex items-center gap-3">
                {getStatusBadge(selectedLead.lead_status || "new")}
                {getSourceBadge(selectedLead.source)}
                {selectedLead.is_unlocked && (
                  <Badge className="bg-purple-500/20 text-purple-500">Purchased</Badge>
                )}
              </div>

              {/* Customer Details */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">Customer Name</Label>
                  <p className="font-medium">{selectedLead.customer_name}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">Phone</Label>
                  <p className="font-medium">{selectedLead.customer_phone}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">Email</Label>
                  <p className="font-medium">{selectedLead.customer_email}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">Postcode</Label>
                  <p className="font-medium">{selectedLead.postcode}</p>
                </div>
                <div className="space-y-1 md:col-span-2">
                  <Label className="text-muted-foreground text-xs">Full Address</Label>
                  <p className="font-medium">{selectedLead.customer_address}</p>
                </div>
              </div>

              {/* Job Details */}
              <div className="border-t pt-4">
                <h4 className="font-semibold mb-3">Job Details</h4>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-muted-foreground text-xs">Job Type</Label>
                    <p className="font-medium">{selectedLead.job_type}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-muted-foreground text-xs">Estimated Value</Label>
                    <p className="font-medium text-secondary">{selectedLead.display_value}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-muted-foreground text-xs">Requested Date</Label>
                    <p className="font-medium">{format(new Date(selectedLead.date), "d MMM yyyy")}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-muted-foreground text-xs">Lead Received</Label>
                    <p className="font-medium">{format(new Date(selectedLead.created_at), "d MMM yyyy HH:mm")}</p>
                  </div>
                </div>
                {selectedLead.job_notes && (
                  <div className="space-y-1 mt-4">
                    <Label className="text-muted-foreground text-xs">Customer Notes</Label>
                    <p className="text-sm bg-muted rounded-lg p-3">{selectedLead.job_notes}</p>
                  </div>
                )}
              </div>

              {/* Admin Notes */}
              <div className="border-t pt-4">
                <Label htmlFor="admin-notes" className="text-sm font-medium">Admin Notes</Label>
                <Textarea
                  id="admin-notes"
                  placeholder="Add internal notes about this lead..."
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  className="mt-2"
                  rows={3}
                />
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mt-2"
                  onClick={handleSaveNotes}
                  disabled={actionLoading}
                >
                  {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Save Notes
                </Button>
              </div>

              {/* Actions */}
              <DialogFooter className="flex-wrap gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => updateLeadStatus(selectedLead.id, "approved")}
                  disabled={actionLoading}
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Approve
                </Button>
                <Button 
                  variant="default" 
                  onClick={() => updateLeadStatus(selectedLead.id, "published")}
                  disabled={actionLoading}
                >
                  <Send className="w-4 h-4 mr-2" />
                  Publish
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => updateLeadStatus(selectedLead.id, "expired")}
                  disabled={actionLoading}
                >
                  <Clock className="w-4 h-4 mr-2" />
                  Expire
                </Button>
                <Button 
                  variant="outline" 
                  className="text-amber-600"
                  onClick={() => updateLeadStatus(selectedLead.id, "refunded")}
                  disabled={actionLoading}
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Refund
                </Button>
                <Button 
                  variant="destructive" 
                  onClick={() => updateLeadStatus(selectedLead.id, "spam")}
                  disabled={actionLoading}
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Spam
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}