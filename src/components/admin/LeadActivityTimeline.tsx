import { useState, useEffect } from "react";
import {
  Loader2,
  FileText,
  CreditCard,
  Eye,
  RefreshCcw,
  CheckCircle,
  XCircle,
  Upload,
  Send,
  MessageSquare,
  Clock,
  User,
  Phone,
  Mail,
  MapPin,
  ArrowRight,
  MessageCircle,
  Smartphone,
  Shield,
  X,
  AlertCircle,
  Sparkles,
  Calendar,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { format, formatDistanceToNow } from "date-fns";

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

interface LeadDetails {
  id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  customer_address: string;
  postcode: string;
  job_type: string;
  value: number;
  display_value: string;
  lead_status: string;
  created_at: string;
  unlocked_by: string | null;
  unlocked_at: string | null;
  confirmation_sent_at: string | null;
  confirmation_response: string | null;
  confirmation_method: string | null;
  auto_publish_at: string | null;
}

interface LeadActivityTimelineProps {
  leadId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ACTION_ICONS: Record<string, any> = {
  created: Sparkles,
  confirmation_sent: Send,
  customer_response: MessageSquare,
  auto_published: CheckCircle,
  status_change: RefreshCcw,
  purchase: CreditCard,
  refund: RefreshCcw,
  view: Eye,
  update: FileText,
};

const ACTION_LABELS: Record<string, string> = {
  created: "Lead Created",
  confirmation_sent: "Confirmation Sent",
  customer_response: "Customer Response",
  auto_published: "Auto-Published",
  status_change: "Status Changed",
  purchase: "Lead Purchased",
  refund: "Refund Issued",
  view: "Lead Viewed",
  update: "Lead Updated",
};

const ACTION_COLORS: Record<string, string> = {
  created: "bg-purple-500/20 text-purple-500 border-purple-500/30",
  confirmation_sent: "bg-blue-500/20 text-blue-500 border-blue-500/30",
  customer_response: "bg-emerald-500/20 text-emerald-500 border-emerald-500/30",
  auto_published: "bg-amber-500/20 text-amber-500 border-amber-500/30",
  status_change: "bg-purple-500/20 text-purple-500 border-purple-500/30",
  purchase: "bg-green-500/20 text-green-500 border-green-500/30",
  refund: "bg-red-500/20 text-red-500 border-red-500/30",
  view: "bg-gray-500/20 text-gray-500 border-gray-500/30",
  update: "bg-blue-500/20 text-blue-500 border-blue-500/30",
};

export default function LeadActivityTimeline({ leadId, open, onOpenChange }: LeadActivityTimelineProps) {
  const [loading, setLoading] = useState(true);
  const [lead, setLead] = useState<LeadDetails | null>(null);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [purchaserName, setPurchaserName] = useState<string | null>(null);

  useEffect(() => {
    if (open && leadId) {
      fetchLeadAndActivities();
    }
  }, [open, leadId]);

  const fetchLeadAndActivities = async () => {
    setLoading(true);

    // Fetch lead details
    const { data: leadData, error: leadError } = await supabase
      .from("leads")
      .select("*")
      .eq("id", leadId)
      .maybeSingle();

    if (leadError) {
      console.error("Error fetching lead:", leadError);
      setLoading(false);
      return;
    }

    setLead(leadData);

    // Fetch all activity logs for this lead
    const { data: activityData, error: activityError } = await supabase
      .from("activity_logs")
      .select("*")
      .eq("entity_id", leadId)
      .order("created_at", { ascending: true });

    if (activityError) {
      console.error("Error fetching activities:", activityError);
    }

    // Add a synthetic "created" event at the lead's creation time
    const allActivities: ActivityLog[] = [];
    
    if (leadData) {
      allActivities.push({
        id: "lead-created",
        user_id: "system",
        action: "created",
        entity_type: "lead",
        entity_id: leadId,
        details: {
          job_type: leadData.job_type,
          postcode: leadData.postcode,
          customer_name: leadData.customer_name,
        },
        ip_address: null,
        created_at: leadData.created_at,
      });
    }

    if (activityData) {
      allActivities.push(...activityData);
    }

    // Sort by created_at ascending (oldest first for timeline)
    allActivities.sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    setActivities(allActivities);

    // Fetch purchaser name if lead was unlocked
    if (leadData?.unlocked_by) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("business_name, contact_name")
        .eq("user_id", leadData.unlocked_by)
        .maybeSingle();

      setPurchaserName(profile?.business_name || profile?.contact_name || null);
    }

    setLoading(false);
  };

  const getActionIcon = (action: string) => {
    const Icon = ACTION_ICONS[action] || FileText;
    return <Icon className="w-4 h-4" />;
  };

  const getActivityDescription = (activity: ActivityLog): string => {
    const details = (typeof activity.details === 'object' && activity.details !== null) 
      ? activity.details as Record<string, unknown> 
      : null;

    switch (activity.action) {
      case "created":
        return `New cleaning request received from ${details?.customer_name || "customer"}`;
      case "confirmation_sent":
        const method = details?.method === "whatsapp" ? "WhatsApp" : "SMS";
        return `Confirmation ${method} sent to customer`;
      case "customer_response":
        const response = details?.customer_response || "";
        const isPositive = details?.is_positive;
        return isPositive 
          ? `Customer confirmed request: "${response}"` 
          : `Customer declined request: "${response}"`;
      case "auto_published":
        return "Lead auto-published after no customer response";
      case "status_change":
        return `Status changed: ${details?.previous_status} → ${details?.new_status}`;
      case "purchase":
        return `Lead purchased by ${purchaserName || "a cleaner"}`;
      case "refund":
        return `Lead refunded: ${details?.reason || "No reason provided"}`;
      default:
        return ACTION_LABELS[activity.action] || activity.action;
    }
  };

  const getCommunicationFlow = (activity: ActivityLog) => {
    const details = (typeof activity.details === 'object' && activity.details !== null) 
      ? activity.details as Record<string, unknown> 
      : null;

    if (activity.action === "confirmation_sent") {
      return (
        <div className="flex items-center gap-2 mt-2 text-xs">
          <div className="flex items-center gap-1 bg-background rounded px-2 py-1 border">
            <Shield className="w-3 h-3 text-primary" />
            <span>Deep Clean UK</span>
          </div>
          <ArrowRight className="w-3 h-3 text-muted-foreground" />
          {details?.method === "whatsapp" ? (
            <MessageCircle className="w-3 h-3 text-green-500" />
          ) : (
            <Smartphone className="w-3 h-3 text-blue-500" />
          )}
          <ArrowRight className="w-3 h-3 text-muted-foreground" />
          <div className="flex items-center gap-1 bg-background rounded px-2 py-1 border">
            <User className="w-3 h-3 text-muted-foreground" />
            <span>{lead?.customer_name}</span>
          </div>
        </div>
      );
    }

    if (activity.action === "customer_response") {
      const isPositive = details?.is_positive;
      return (
        <div className="flex items-center gap-2 mt-2 text-xs">
          <div className="flex items-center gap-1 bg-background rounded px-2 py-1 border">
            <User className="w-3 h-3 text-muted-foreground" />
            <span>{lead?.customer_name}</span>
          </div>
          <ArrowRight className="w-3 h-3 text-muted-foreground" />
          <MessageSquare className={`w-3 h-3 ${isPositive ? "text-green-500" : "text-red-500"}`} />
          <ArrowRight className="w-3 h-3 text-muted-foreground" />
          <div className="flex items-center gap-1 bg-background rounded px-2 py-1 border">
            <Shield className="w-3 h-3 text-primary" />
            <span>Deep Clean UK</span>
          </div>
        </div>
      );
    }

    return null;
  };

  const getStatusBadge = (status: string | null) => {
    if (!status) return null;
    
    const statusConfig: Record<string, { color: string; label: string }> = {
      new: { color: "bg-blue-500/20 text-blue-600", label: "New" },
      pending_confirmation: { color: "bg-amber-500/20 text-amber-600", label: "Pending Confirmation" },
      published: { color: "bg-green-500/20 text-green-600", label: "Published" },
      purchased: { color: "bg-purple-500/20 text-purple-600", label: "Purchased" },
      spam: { color: "bg-red-500/20 text-red-600", label: "Spam" },
      expired: { color: "bg-gray-500/20 text-gray-600", label: "Expired" },
      refunded: { color: "bg-orange-500/20 text-orange-600", label: "Refunded" },
    };

    const config = statusConfig[status] || { color: "bg-muted text-muted-foreground", label: status };
    
    return (
      <Badge className={config.color}>
        {config.label}
      </Badge>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-primary" />
            Lead Activity Timeline
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex-1 flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : !lead ? (
          <div className="flex-1 flex flex-col items-center justify-center py-12 text-muted-foreground">
            <AlertCircle className="w-8 h-8 mb-2" />
            <p>Lead not found</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-6">
            {/* Lead Summary Card */}
            <div className="bg-muted/30 rounded-lg p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-lg">{lead.customer_name}</h3>
                  <p className="text-muted-foreground">{lead.job_type}</p>
                </div>
                {getStatusBadge(lead.lead_status)}
              </div>
              
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <span className="font-mono">{lead.customer_phone}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <span className="truncate">{lead.customer_email}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  <span>{lead.postcode}</span>
                </div>
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-muted-foreground" />
                  <span>{lead.display_value}</span>
                </div>
              </div>

              {purchaserName && (
                <div className="pt-2 border-t border-border">
                  <p className="text-sm">
                    <span className="text-muted-foreground">Purchased by:</span>{" "}
                    <span className="font-medium">{purchaserName}</span>
                    {lead.unlocked_at && (
                      <span className="text-muted-foreground">
                        {" "}on {format(new Date(lead.unlocked_at), "d MMM yyyy 'at' HH:mm")}
                      </span>
                    )}
                  </p>
                </div>
              )}
            </div>

            {/* Timeline */}
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-[19px] top-0 bottom-0 w-px bg-border" />

              <div className="space-y-4">
                {activities.map((activity, index) => (
                  <div key={activity.id} className="relative flex gap-4">
                    {/* Icon */}
                    <div className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center border ${ACTION_COLORS[activity.action] || "bg-muted"}`}>
                      {getActionIcon(activity.action)}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 pb-4">
                      <div className="bg-card border border-border rounded-lg p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-medium text-sm">
                              {ACTION_LABELS[activity.action] || activity.action}
                            </p>
                            <p className="text-sm text-muted-foreground mt-0.5">
                              {getActivityDescription(activity)}
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(activity.created_at), "HH:mm")}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(activity.created_at), "d MMM")}
                            </p>
                          </div>
                        </div>

                        {/* Communication flow visualization */}
                        {getCommunicationFlow(activity)}

                        {/* Additional details */}
                        {activity.action === "auto_published" && (
                          <div className="mt-2 flex items-center gap-1 text-xs text-amber-600">
                            <AlertCircle className="w-3 h-3" />
                            <span>No response within timeout period</span>
                          </div>
                        )}

                        {activity.action === "customer_response" && (
                          <div className="mt-2">
                            {(activity.details as any)?.is_positive ? (
                              <Badge className="bg-green-500/20 text-green-600">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Confirmed
                              </Badge>
                            ) : (
                              <Badge className="bg-red-500/20 text-red-600">
                                <XCircle className="w-3 h-3 mr-1" />
                                Declined
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Time since last event */}
                      {index < activities.length - 1 && (
                        <div className="text-xs text-muted-foreground mt-2 ml-1">
                          {formatDistanceToNow(new Date(activity.created_at), { addSuffix: false })} later...
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {activities.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No activity recorded for this lead</p>
              </div>
            )}
          </div>
        )}

        <div className="flex-shrink-0 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
