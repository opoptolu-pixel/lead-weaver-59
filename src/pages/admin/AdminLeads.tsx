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
  RotateCcw,
  Send,
  Download,
  Mail,
  MessageSquare,
  CheckSquare,
  HelpCircle,
  Lock,
  Ban,
  Info,
  GripVertical,
} from "lucide-react";
import { usePagination } from "@/hooks/usePagination";
import { PaginationControls } from "@/components/admin/PaginationControls";
import { exportToCsv } from "@/lib/exportCsv";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
  // New confirmation fields
  confirmation_sent_at: string | null;
  confirmation_response: string | null;
  auto_publish_at: string | null;
  confirmation_method: string | null;
}

// Kanban columns in FIXED order - leads go straight to pending_confirmation
const KANBAN_COLUMNS = [
  { 
    value: "pending_confirmation", 
    label: "Pending Confirmation", 
    color: "bg-cyan-500/20 text-cyan-500",
    description: "Awaiting customer response via WhatsApp/SMS"
  },
  { 
    value: "confirmation_failed", 
    label: "Confirmation Failed", 
    color: "bg-amber-500/20 text-amber-500",
    description: "WhatsApp/SMS failed to send - needs manual review"
  },
  { 
    value: "published", 
    label: "Published", 
    color: "bg-secondary/20 text-secondary",
    description: "Live and visible to cleaning businesses"
  },
  { 
    value: "purchased", 
    label: "Purchased (Locked)", 
    color: "bg-purple-500/20 text-purple-500",
    description: "Paid £20 and locked to one cleaner"
  },
  { 
    value: "expired", 
    label: "Expired", 
    color: "bg-muted text-muted-foreground",
    description: "Not purchased within time window"
  },
  { 
    value: "refunded", 
    label: "Refunded", 
    color: "bg-amber-500/20 text-amber-500",
    description: "Payment refunded to cleaner"
  },
  { 
    value: "spam", 
    label: "Spam / Rejected", 
    color: "bg-destructive/20 text-destructive",
    description: "Invalid, fake, or non-compliant lead"
  },
];

// Minimum value required for publishing (form already validates this)
const MIN_LEAD_VALUE = 100;

// Valid status transitions - leads start at pending_confirmation
const VALID_TRANSITIONS: Record<string, string[]> = {
  pending_confirmation: ["confirmation_failed", "published", "spam"], // Awaiting response, can mark failed or force publish
  confirmation_failed: ["pending_confirmation", "published", "spam"], // Can retry confirmation or publish directly
  published: ["purchased", "expired", "spam"],
  purchased: ["refunded"],
  expired: ["spam"],
  refunded: [],
  spam: [],
};

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
  // Default to Kanban view
  const [viewMode, setViewMode] = useState<"table" | "kanban">("kanban");
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [adminNotes, setAdminNotes] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [draggedLead, setDraggedLead] = useState<Lead | null>(null);

  useEffect(() => {
    fetchLeads();
  }, [statusFilter, dateRange]);

  // Real-time subscription for live updates
  useEffect(() => {
    const channel = supabase
      .channel('admin-leads-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'leads' },
        (payload) => {
          console.log('Leads updated in realtime:', payload);
          fetchLeads();
          toast.info('Lead data updated', { 
            description: `${payload.eventType === 'INSERT' ? 'New lead received' : payload.eventType === 'UPDATE' ? 'Lead updated' : 'Lead removed'}`,
            duration: 3000 
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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

  // Log activity for status changes
  const logActivity = async (
    leadId: string,
    previousStatus: string,
    newStatus: string,
    additionalDetails?: Record<string, any>
  ) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      await supabase.from("activity_logs").insert({
        user_id: user?.id || "system",
        entity_type: "lead",
        entity_id: leadId,
        action: "status_change",
        details: {
          previous_status: previousStatus,
          new_status: newStatus,
          ...additionalDetails,
        },
      });
    } catch (error) {
      console.error("Failed to log activity:", error);
    }
  };

  // Check if a transition is valid
  const isValidTransition = (fromStatus: string, toStatus: string): boolean => {
    const validTargets = VALID_TRANSITIONS[fromStatus] || [];
    return validTargets.includes(toStatus);
  };

  // Check if lead meets value requirements for approval/publishing
  const meetsValueRequirement = (lead: Lead): boolean => {
    return lead.value >= MIN_LEAD_VALUE;
  };

  // Get transition error message
  const getTransitionError = (lead: Lead, targetStatus: string): string | null => {
    const currentStatus = lead.lead_status || "new";
    
    if (!isValidTransition(currentStatus, targetStatus)) {
      return `Cannot move from "${currentStatus}" to "${targetStatus}"`;
    }
    
    if ((targetStatus === "approved" || targetStatus === "published") && !meetsValueRequirement(lead)) {
      return `Lead value must be £${MIN_LEAD_VALUE}+ to approve/publish (current: £${lead.value})`;
    }
    
    return null;
  };

  const updateLeadStatus = async (
    leadId: string, 
    newStatus: string, 
    additionalData?: Record<string, any>,
    skipValidation = false
  ) => {
    const lead = leads.find(l => l.id === leadId);
    if (!lead) {
      toast.error("Lead not found");
      return;
    }

    const previousStatus = lead.lead_status || "new";

    // Validate transition unless skipping (for system actions)
    if (!skipValidation) {
      const error = getTransitionError(lead, newStatus);
      if (error) {
        toast.error(error);
        return;
      }
    }

    setActionLoading(true);
    const updateData: Record<string, any> = { lead_status: newStatus, ...additionalData };

    // Set timestamps based on status
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

    if (error) {
      toast.error("Failed to update lead status");
      setActionLoading(false);
      return;
    }

    // Log the activity
    await logActivity(leadId, previousStatus, newStatus, additionalData);

    toast.success(`Lead moved to ${KANBAN_COLUMNS.find(c => c.value === newStatus)?.label || newStatus}`);
    fetchLeads();
    setIsDetailOpen(false);
    setActionLoading(false);
  };

  // Bulk actions with validation
  const handleBulkAction = async (action: string) => {
    if (selectedLeadIds.size === 0) {
      toast.error("No leads selected");
      return;
    }

    // Validate all selected leads
    const selectedLeads = leads.filter(l => selectedLeadIds.has(l.id));
    const invalidLeads = selectedLeads.filter(l => {
      const error = getTransitionError(l, action);
      return error !== null;
    });

    if (invalidLeads.length > 0) {
      toast.error(`${invalidLeads.length} lead(s) cannot be moved to "${action}". Check value requirements and valid transitions.`);
      return;
    }

    setBulkActionLoading(true);
    const updateData: Record<string, any> = { lead_status: action };

    if (action === "approved") {
      updateData.validated_at = new Date().toISOString();
    } else if (action === "published") {
      updateData.published_at = new Date().toISOString();
    } else if (action === "spam") {
      updateData.expired_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from("leads")
      .update(updateData)
      .in("id", Array.from(selectedLeadIds));

    if (error) {
      toast.error("Failed to update leads");
      setBulkActionLoading(false);
      return;
    }

    // Log activities for all updated leads
    for (const lead of selectedLeads) {
      await logActivity(lead.id, lead.lead_status || "new", action);
    }

    toast.success(`${selectedLeadIds.size} leads updated to ${action}`);
    setSelectedLeadIds(new Set());
    fetchLeads();
    setBulkActionLoading(false);
  };

  const toggleLeadSelection = (leadId: string) => {
    const newSelection = new Set(selectedLeadIds);
    if (newSelection.has(leadId)) {
      newSelection.delete(leadId);
    } else {
      newSelection.add(leadId);
    }
    setSelectedLeadIds(newSelection);
  };

  const toggleSelectAll = () => {
    if (selectedLeadIds.size === filteredLeads.length) {
      setSelectedLeadIds(new Set());
    } else {
      setSelectedLeadIds(new Set(filteredLeads.map(l => l.id)));
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

  const handleSendEmail = async (lead: Lead) => {
    toast.info(`Opening email for ${lead.customer_email}`);
    window.open(`mailto:${lead.customer_email}?subject=Regarding your cleaning request`, "_blank");
  };

  const handleSendWhatsApp = async (lead: Lead) => {
    const phone = lead.customer_phone.replace(/\D/g, "");
    const formattedPhone = phone.startsWith("44") ? phone : `44${phone.startsWith("0") ? phone.slice(1) : phone}`;
    toast.info(`Opening WhatsApp for ${lead.customer_phone}`);
    window.open(`https://wa.me/${formattedPhone}?text=Hi ${lead.customer_name}, regarding your cleaning request...`, "_blank");
  };

  // Send confirmation request to customer via WhatsApp/SMS
  const handleSendConfirmation = async (lead: Lead, method: "whatsapp" | "sms" = "whatsapp") => {
    // Allow resending for pending_confirmation and confirmation_failed leads too
    const allowedStatuses = ["pending_confirmation", "confirmation_failed"];
    if (!allowedStatuses.includes(lead.lead_status || "")) {
      toast.error("Can only send confirmation for pending or failed leads");
      return;
    }

    setActionLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("customer-confirmation", {
        body: { 
          leadId: lead.id, 
          method,
          autoPublishHours: 24, // Auto-publish after 24 hours if no response
        },
      });

      if (error) throw error;

      toast.success(`Confirmation ${method} sent to ${lead.customer_phone}`, {
        description: `Will auto-publish in 24 hours if no response`,
      });
      fetchLeads();
    } catch (error: any) {
      console.error("Error sending confirmation:", error);
      toast.error(`Failed to send confirmation: ${error.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  // Resend both WhatsApp and SMS confirmation for failed leads
  const handleResendConfirmation = async (lead: Lead) => {
    setActionLoading(true);
    try {
      // Send both in parallel
      const [whatsappResult, smsResult] = await Promise.all([
        supabase.functions.invoke("customer-confirmation", {
          body: { leadId: lead.id, method: "whatsapp", autoPublishHours: 24 },
        }),
        supabase.functions.invoke("customer-confirmation", {
          body: { leadId: lead.id, method: "sms", autoPublishHours: 24 },
        }),
      ]);

      if (whatsappResult.error && smsResult.error) {
        throw new Error("Both WhatsApp and SMS failed");
      }

      toast.success(`Confirmation resent to ${lead.customer_phone}`, {
        description: `WhatsApp: ${whatsappResult.error ? "failed" : "sent"}, SMS: ${smsResult.error ? "failed" : "sent"}`,
      });
      fetchLeads();
    } catch (error: any) {
      console.error("Error resending confirmation:", error);
      toast.error(`Failed to resend confirmation: ${error.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  // Bulk send confirmations
  const handleBulkSendConfirmation = async (method: "whatsapp" | "sms" = "whatsapp") => {
    const newLeads = leads.filter(l => selectedLeadIds.has(l.id) && (l.lead_status === "new" || !l.lead_status));
    
    if (newLeads.length === 0) {
      toast.error("No new leads selected for confirmation");
      return;
    }

    setBulkActionLoading(true);
    let successCount = 0;

    for (const lead of newLeads) {
      try {
        await supabase.functions.invoke("customer-confirmation", {
          body: { leadId: lead.id, method, autoPublishHours: 24 },
        });
        successCount++;
      } catch (error) {
        console.error(`Failed to send confirmation for lead ${lead.id}:`, error);
      }
    }

    toast.success(`Sent ${successCount} confirmation messages`);
    setSelectedLeadIds(new Set());
    fetchLeads();
    setBulkActionLoading(false);
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = KANBAN_COLUMNS.find((s) => s.value === status);
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

  // Check for potential duplicates
  const checkDuplicate = (lead: Lead) => {
    const duplicates = leads.filter(
      l => l.id !== lead.id && 
      (l.customer_phone === lead.customer_phone || l.customer_email === lead.customer_email) &&
      l.postcode === lead.postcode
    );
    return duplicates.length > 0;
  };

  const filteredLeads = leads.filter(
    (lead) =>
      lead.postcode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.job_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.customer_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const pagination = usePagination(filteredLeads);

  const handleExportCsv = () => {
    exportToCsv(filteredLeads, "leads", [
      { key: "customer_name", label: "Customer Name" },
      { key: "customer_email", label: "Email" },
      { key: "customer_phone", label: "Phone" },
      { key: "postcode", label: "Postcode" },
      { key: "job_type", label: "Job Type" },
      { key: "display_value", label: "Value" },
      { key: "source", label: "Source" },
      { key: "lead_status", label: "Status" },
      { key: "created_at", label: "Created" },
    ]);
  };

  // Drag and drop handlers for Kanban
  const handleDragStart = (e: React.DragEvent, lead: Lead) => {
    setDraggedLead(lead);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = async (e: React.DragEvent, targetStatus: string) => {
    e.preventDefault();
    if (!draggedLead) return;

    const error = getTransitionError(draggedLead, targetStatus);
    if (error) {
      toast.error(error);
      setDraggedLead(null);
      return;
    }

    await updateLeadStatus(draggedLead.id, targetStatus);
    setDraggedLead(null);
  };

  // Get valid action buttons for a lead based on its current status
  const getValidActions = (lead: Lead) => {
    const currentStatus = lead.lead_status || "new";
    const validTargets = VALID_TRANSITIONS[currentStatus] || [];
    
    return validTargets.map(target => {
      const column = KANBAN_COLUMNS.find(c => c.value === target);
      const meetsValue = meetsValueRequirement(lead);
      const disabled = (target === "approved" || target === "published") && !meetsValue;
      
      return {
        status: target,
        label: column?.label || target,
        disabled,
        disabledReason: disabled ? `Requires £${MIN_LEAD_VALUE}+ value` : undefined,
      };
    });
  };

  // Extract postcode prefix
  const getPostcodePrefix = (postcode: string) => {
    const parts = postcode.split(" ");
    return parts[0] || postcode;
  };

  return (
    <AdminLayout title="Lead Pipeline">
      <TooltipProvider>
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
              {KANBAN_COLUMNS.map((status) => (
                <SelectItem key={status.value} value={status.value}>
                  {status.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex gap-2">
            <Button
              variant={viewMode === "kanban" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("kanban")}
            >
              Kanban
            </Button>
            <Button
              variant={viewMode === "table" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("table")}
            >
              Table
            </Button>
          </div>

          <Button variant="outline" size="sm" onClick={handleExportCsv}>
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>

        {/* Status Legend */}
        <div className="flex flex-wrap gap-2 mb-4 p-3 bg-muted/30 rounded-lg">
          <span className="text-sm text-muted-foreground mr-2">Status Guide:</span>
          {KANBAN_COLUMNS.map((col) => (
            <Tooltip key={col.value}>
              <TooltipTrigger asChild>
                <Badge className={`${col.color} cursor-help`}>
                  {col.label}
                  <HelpCircle className="w-3 h-3 ml-1" />
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs">{col.description}</p>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>

        {/* Value Requirement Notice */}
        <div className="flex items-center gap-2 mb-4 p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
          <Info className="w-4 h-4 text-cyan-500 flex-shrink-0" />
          <p className="text-sm text-cyan-600">
            <strong>New flow:</strong> New leads receive a WhatsApp/SMS confirmation request. They auto-publish after 24h if no response, or immediately on positive confirmation.
          </p>
        </div>

        {/* Bulk Actions Bar */}
        {selectedLeadIds.size > 0 && (
          <div className="bg-secondary/10 border border-secondary/30 rounded-lg p-3 mb-4 flex items-center justify-between">
            <span className="text-sm font-medium">
              {selectedLeadIds.size} lead(s) selected
            </span>
            <div className="flex gap-2 flex-wrap">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline" disabled={bulkActionLoading}>
                    {bulkActionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <MessageSquare className="w-4 h-4 mr-1" />}
                    Send Confirmation
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => handleBulkSendConfirmation("whatsapp")}>
                    <MessageSquare className="w-4 h-4 mr-2" />
                    Via WhatsApp
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleBulkSendConfirmation("sms")}>
                    <Mail className="w-4 h-4 mr-2" />
                    Via SMS
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button 
                size="sm" 
                onClick={() => handleBulkAction("published")}
                disabled={bulkActionLoading}
              >
                {bulkActionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Send className="w-4 h-4 mr-1" />}
                Publish Directly
              </Button>
              <Button 
                size="sm" 
                variant="destructive" 
                onClick={() => handleBulkAction("spam")}
                disabled={bulkActionLoading}
              >
                {bulkActionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Ban className="w-4 h-4 mr-1" />}
                Mark Spam
              </Button>
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={() => setSelectedLeadIds(new Set())}
              >
                Clear
              </Button>
            </div>
          </div>
        )}

        {/* Kanban View (Default) */}
        {viewMode === "kanban" && (
          <div className="flex gap-4 overflow-x-auto pb-4">
            {KANBAN_COLUMNS.map((column) => (
              <div
                key={column.value}
                className="flex-shrink-0 w-72 bg-muted/30 rounded-xl p-4"
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, column.value)}
              >
                <div className="flex items-center justify-between mb-4">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <h3 className="font-medium text-foreground flex items-center gap-1 cursor-help">
                        {column.label}
                        <HelpCircle className="w-3 h-3 text-muted-foreground" />
                      </h3>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">{column.description}</p>
                    </TooltipContent>
                  </Tooltip>
                  <Badge variant="secondary">
                    {filteredLeads.filter((l) => (l.lead_status || "new") === column.value).length}
                  </Badge>
                </div>

                <div className="space-y-3 min-h-[200px]">
                  {filteredLeads
                    .filter((lead) => (lead.lead_status || "new") === column.value)
                    .map((lead) => {
                      const validTargets = VALID_TRANSITIONS[column.value] || [];
                      const isDraggable = validTargets.length > 0;
                      const belowMinValue = lead.value < MIN_LEAD_VALUE;

                      return (
                        <div
                          key={lead.id}
                          className={`bg-card rounded-lg border border-border p-3 cursor-pointer hover:border-secondary/50 ${
                            isDraggable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"
                          } ${belowMinValue && column.value === "new" ? "border-amber-500/50" : ""}`}
                          onClick={() => handleViewDetails(lead)}
                          draggable={isDraggable}
                          onDragStart={(e) => isDraggable && handleDragStart(e, lead)}
                        >
                          {/* Lead ID */}
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs text-muted-foreground font-mono">
                              #{lead.id.slice(0, 8)}
                            </span>
                            {isDraggable && (
                              <GripVertical className="w-3 h-3 text-muted-foreground" />
                            )}
                          </div>

                          {/* Service Type */}
                          <p className="font-medium text-foreground text-sm mb-1">
                            {lead.job_type}
                          </p>

                          {/* Value with warning if below minimum */}
                          <div className="flex items-center gap-2 mb-2">
                            <span className={`text-sm font-semibold ${
                              belowMinValue ? "text-amber-500" : "text-secondary"
                            }`}>
                              {lead.display_value}
                            </span>
                            {belowMinValue && (
                              <Tooltip>
                                <TooltipTrigger>
                                  <AlertTriangle className="w-3 h-3 text-amber-500" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Below £{MIN_LEAD_VALUE} minimum for approval</p>
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </div>

                          {/* Postcode and Date */}
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>{getPostcodePrefix(lead.postcode)}</span>
                            <span>{format(new Date(lead.date), "d MMM")}</span>
                          </div>

                          {/* Source */}
                          <div className="mt-2">
                            {getSourceBadge(lead.source)}
                          </div>

                          {/* Warnings */}
                          {checkDuplicate(lead) && (
                            <Badge variant="outline" className="text-amber-500 border-amber-500/30 mt-2 text-xs">
                              <AlertTriangle className="w-3 h-3 mr-1" />
                              Possible Duplicate
                            </Badge>
                          )}

                          {column.value === "pending_confirmation" && lead.confirmation_sent_at && (
                            <Badge className="bg-cyan-500/10 text-cyan-400 mt-2 text-xs">
                              <Clock className="w-3 h-3 mr-1" />
                              Sent: {format(new Date(lead.confirmation_sent_at), "d MMM HH:mm")}
                            </Badge>
                          )}

                          {column.value === "pending_confirmation" && lead.auto_publish_at && (
                            <Badge className="bg-cyan-500/20 text-cyan-500 mt-2 text-xs">
                              <Clock className="w-3 h-3 mr-1" />
                              Auto-publish: {format(new Date(lead.auto_publish_at), "d MMM HH:mm")}
                            </Badge>
                          )}

                          {column.value === "confirmation_failed" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="mt-2 w-full text-xs h-7"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleResendConfirmation(lead);
                              }}
                              disabled={actionLoading}
                            >
                              {actionLoading ? (
                                <Loader2 className="w-3 h-3 animate-spin mr-1" />
                              ) : (
                                <RotateCcw className="w-3 h-3 mr-1" />
                              )}
                              Resend Confirmation
                            </Button>
                          )}

                          {column.value === "purchased" && (
                            <Badge className="bg-purple-500/20 text-purple-500 mt-2 text-xs">
                              <Lock className="w-3 h-3 mr-1" />
                              Locked
                            </Badge>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>
            ))}
          </div>
        )}

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
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="p-4 w-10">
                          <Checkbox
                            checked={selectedLeadIds.size === filteredLeads.length && filteredLeads.length > 0}
                            onCheckedChange={toggleSelectAll}
                          />
                        </th>
                        <th className="text-left p-4 font-medium text-muted-foreground">Lead ID</th>
                        <th className="text-left p-4 font-medium text-muted-foreground">Service</th>
                        <th className="text-left p-4 font-medium text-muted-foreground">Source</th>
                        <th className="text-left p-4 font-medium text-muted-foreground">Location</th>
                        <th className="text-left p-4 font-medium text-muted-foreground">Value</th>
                        <th className="text-left p-4 font-medium text-muted-foreground">Status</th>
                        <th className="text-left p-4 font-medium text-muted-foreground">Date</th>
                        <th className="text-right p-4 font-medium text-muted-foreground">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {pagination.paginatedData.map((lead) => {
                        const belowMinValue = lead.value < MIN_LEAD_VALUE;
                        return (
                          <tr 
                            key={lead.id} 
                            className="hover:bg-muted/30 cursor-pointer"
                          >
                            <td className="p-4" onClick={(e) => e.stopPropagation()}>
                              <Checkbox
                                checked={selectedLeadIds.has(lead.id)}
                                onCheckedChange={() => toggleLeadSelection(lead.id)}
                              />
                            </td>
                            <td className="p-4" onClick={() => handleViewDetails(lead)}>
                              <span className="text-xs font-mono text-muted-foreground">
                                #{lead.id.slice(0, 8)}
                              </span>
                            </td>
                            <td className="p-4" onClick={() => handleViewDetails(lead)}>
                              <div className="flex items-center gap-2">
                                <div>
                                  <p className="font-medium text-foreground">{lead.job_type}</p>
                                  <p className="text-sm text-muted-foreground">{lead.customer_name}</p>
                                </div>
                                {checkDuplicate(lead) && (
                                  <Badge variant="outline" className="text-amber-500 border-amber-500/30">
                                    <AlertTriangle className="w-3 h-3 mr-1" />
                                    Duplicate?
                                  </Badge>
                                )}
                              </div>
                            </td>
                            <td className="p-4">{getSourceBadge(lead.source)}</td>
                            <td className="p-4">
                              <p className="text-foreground">{getPostcodePrefix(lead.postcode)}</p>
                            </td>
                            <td className="p-4">
                              <span className={`font-medium ${belowMinValue ? "text-amber-500" : "text-foreground"}`}>
                                {lead.display_value}
                              </span>
                              {belowMinValue && (
                                <Tooltip>
                                  <TooltipTrigger>
                                    <AlertTriangle className="w-3 h-3 text-amber-500 ml-1 inline" />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Below £{MIN_LEAD_VALUE} minimum</p>
                                  </TooltipContent>
                                </Tooltip>
                              )}
                            </td>
                            <td className="p-4">{getStatusBadge(lead.lead_status || "new")}</td>
                            <td className="p-4 text-muted-foreground">
                              {format(new Date(lead.date), "d MMM yyyy")}
                            </td>
                            <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
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
                                  <DropdownMenuItem onClick={() => handleSendEmail(lead)}>
                                    <Mail className="w-4 h-4 mr-2" />
                                    Send Email
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleSendWhatsApp(lead)}>
                                    <MessageSquare className="w-4 h-4 mr-2" />
                                    Send WhatsApp
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  {lead.lead_status === "new" && (
                                    <DropdownMenuItem onClick={() => handleSendConfirmation(lead, "whatsapp")}>
                                      <MessageSquare className="w-4 h-4 mr-2 text-cyan-500" />
                                      Send Confirmation (WhatsApp)
                                    </DropdownMenuItem>
                                  )}
                                  {getValidActions(lead).map(action => (
                                    <DropdownMenuItem
                                      key={action.status}
                                      onClick={() => !action.disabled && updateLeadStatus(lead.id, action.status)}
                                      disabled={action.disabled}
                                      className={action.disabled ? "opacity-50" : ""}
                                    >
                                      {action.status === "pending_confirmation" && <Clock className="w-4 h-4 mr-2 text-cyan-500" />}
                                      {action.status === "published" && <Send className="w-4 h-4 mr-2 text-secondary" />}
                                      {action.status === "expired" && <Clock className="w-4 h-4 mr-2 text-muted-foreground" />}
                                      {action.status === "refunded" && <RotateCcw className="w-4 h-4 mr-2 text-amber-500" />}
                                      {action.status === "spam" && <Ban className="w-4 h-4 mr-2 text-destructive" />}
                                      {action.status === "purchased" && <Lock className="w-4 h-4 mr-2 text-purple-500" />}
                                      {action.label}
                                      {action.disabled && <span className="ml-2 text-xs text-muted-foreground">({action.disabledReason})</span>}
                                    </DropdownMenuItem>
                                  ))}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </td>
                          </tr>
                        );
                      })}
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
                {/* Lead ID */}
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="font-mono">Lead ID: #{selectedLead.id.slice(0, 8)}</span>
                </div>

                {/* Status and Source */}
                <div className="flex items-center gap-3 flex-wrap">
                  {getStatusBadge(selectedLead.lead_status || "new")}
                  {getSourceBadge(selectedLead.source)}
                  {selectedLead.is_unlocked && (
                    <Badge className="bg-purple-500/20 text-purple-500">
                      <Lock className="w-3 h-3 mr-1" />
                      Purchased
                    </Badge>
                  )}
                  {checkDuplicate(selectedLead) && (
                    <Badge variant="outline" className="text-amber-500 border-amber-500/30">
                      <AlertTriangle className="w-3 h-3 mr-1" />
                      Possible Duplicate
                    </Badge>
                  )}
                  {selectedLead.value < MIN_LEAD_VALUE && (
                    <Badge variant="outline" className="text-amber-500 border-amber-500/30">
                      <AlertTriangle className="w-3 h-3 mr-1" />
                      Below £{MIN_LEAD_VALUE} min
                    </Badge>
                  )}
                </div>

                {/* Quick Contact Actions */}
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleSendEmail(selectedLead)}>
                    <Mail className="w-4 h-4 mr-2" />
                    Email Customer
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleSendWhatsApp(selectedLead)}>
                    <MessageSquare className="w-4 h-4 mr-2" />
                    WhatsApp
                  </Button>
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
                      <p className={`font-medium ${selectedLead.value < MIN_LEAD_VALUE ? "text-amber-500" : "text-secondary"}`}>
                        {selectedLead.display_value}
                        {selectedLead.value < MIN_LEAD_VALUE && (
                          <span className="text-xs text-amber-500 ml-2">(Below minimum)</span>
                        )}
                      </p>
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

                {/* Status Transition Actions */}
                <div className="border-t pt-4">
                  <h4 className="font-semibold mb-3">Actions</h4>
                  <p className="text-xs text-muted-foreground mb-3">
                    Available actions based on current status: {getStatusBadge(selectedLead.lead_status || "new")}
                  </p>
                  <DialogFooter className="flex-wrap gap-2 justify-start">
                    {selectedLead.lead_status === "new" && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" disabled={actionLoading}>
                            {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <MessageSquare className="w-4 h-4 mr-2" />}
                            Send Confirmation
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem onClick={() => handleSendConfirmation(selectedLead, "whatsapp")}>
                            <MessageSquare className="w-4 h-4 mr-2" />
                            Via WhatsApp
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleSendConfirmation(selectedLead, "sms")}>
                            <Mail className="w-4 h-4 mr-2" />
                            Via SMS
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                    {getValidActions(selectedLead).map(action => (
                      <Tooltip key={action.status}>
                        <TooltipTrigger asChild>
                          <span>
                            <Button 
                              variant={action.status === "spam" ? "destructive" : action.status === "published" ? "default" : "outline"}
                              onClick={() => !action.disabled && updateLeadStatus(selectedLead.id, action.status)}
                              disabled={actionLoading || action.disabled}
                              className={action.disabled ? "opacity-50" : ""}
                            >
                              {action.status === "pending_confirmation" && <Clock className="w-4 h-4 mr-2" />}
                              {action.status === "published" && <Send className="w-4 h-4 mr-2" />}
                              {action.status === "expired" && <Clock className="w-4 h-4 mr-2" />}
                              {action.status === "refunded" && <RotateCcw className="w-4 h-4 mr-2" />}
                              {action.status === "spam" && <Ban className="w-4 h-4 mr-2" />}
                              {action.status === "purchased" && <Lock className="w-4 h-4 mr-2" />}
                              {action.label}
                            </Button>
                          </span>
                        </TooltipTrigger>
                        {action.disabled && (
                          <TooltipContent>
                            <p>{action.disabledReason}</p>
                          </TooltipContent>
                        )}
                      </Tooltip>
                    ))}
                    {getValidActions(selectedLead).length === 0 && (
                      <p className="text-sm text-muted-foreground">No actions available for this status.</p>
                    )}
                  </DialogFooter>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </TooltipProvider>
    </AdminLayout>
  );
}
