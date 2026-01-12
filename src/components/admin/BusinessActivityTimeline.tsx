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
  LogIn,
  Clock,
  User,
  Phone,
  Mail,
  MapPin,
  Building2,
  Shield,
  AlertCircle,
  Sparkles,
  Coins,
  ShoppingCart,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
}

interface BusinessDetails {
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
  is_suspended: boolean;
  created_at: string;
  last_login: string | null;
  email?: string | null;
}

interface BusinessActivityTimelineProps {
  userId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ACTION_ICONS: Record<string, any> = {
  signup: Sparkles,
  login: LogIn,
  profile_update: FileText,
  purchase: ShoppingCart,
  credit_purchase: CreditCard,
  credits_purchased: CreditCard,
  credits_granted: Coins,
  credits_added: Coins, // Legacy support
  verification_submitted: Upload,
  verification_approved: CheckCircle,
  verification_rejected: XCircle,
  suspended: XCircle,
  unsuspended: CheckCircle,
  view: Eye,
  update: FileText,
  phone_unlinked: Phone,
};

const ACTION_LABELS: Record<string, string> = {
  signup: "Business Registered",
  login: "Logged In",
  profile_update: "Profile Updated",
  purchase: "Lead Purchased",
  credit_purchase: "Credits Purchased",
  credits_purchased: "Credits Purchased",
  credits_granted: "Credits Granted",
  credits_added: "Credits Added", // Legacy support
  verification_submitted: "Verification Submitted",
  verification_approved: "Verification Approved",
  verification_rejected: "Verification Rejected",
  suspended: "Account Suspended",
  unsuspended: "Account Reactivated",
  view: "Viewed",
  update: "Updated",
  phone_unlinked: "Phone Unlinked",
};

const ACTION_COLORS: Record<string, string> = {
  signup: "bg-purple-500/20 text-purple-500 border-purple-500/30",
  login: "bg-blue-500/20 text-blue-500 border-blue-500/30",
  profile_update: "bg-cyan-500/20 text-cyan-500 border-cyan-500/30",
  purchase: "bg-green-500/20 text-green-500 border-green-500/30",
  credit_purchase: "bg-amber-500/20 text-amber-500 border-amber-500/30",
  credits_purchased: "bg-amber-500/20 text-amber-500 border-amber-500/30",
  credits_granted: "bg-teal-500/20 text-teal-500 border-teal-500/30",
  credits_added: "bg-teal-500/20 text-teal-500 border-teal-500/30", // Legacy support
  verification_submitted: "bg-blue-500/20 text-blue-500 border-blue-500/30",
  verification_approved: "bg-green-500/20 text-green-500 border-green-500/30",
  verification_rejected: "bg-red-500/20 text-red-500 border-red-500/30",
  suspended: "bg-red-500/20 text-red-500 border-red-500/30",
  unsuspended: "bg-green-500/20 text-green-500 border-green-500/30",
  view: "bg-gray-500/20 text-gray-500 border-gray-500/30",
  update: "bg-blue-500/20 text-blue-500 border-blue-500/30",
  phone_unlinked: "bg-orange-500/20 text-orange-500 border-orange-500/30",
};

export default function BusinessActivityTimeline({ userId, open, onOpenChange }: BusinessActivityTimelineProps) {
  const [loading, setLoading] = useState(true);
  const [business, setBusiness] = useState<BusinessDetails | null>(null);
  const [activities, setActivities] = useState<ActivityLog[]>([]);

  useEffect(() => {
    if (open && userId) {
      fetchBusinessAndActivities();
    }
  }, [open, userId]);

  const fetchBusinessAndActivities = async () => {
    setLoading(true);

    // Fetch business details
    const { data: businessData, error: businessError } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (businessError) {
      console.error("Error fetching business:", businessError);
      setLoading(false);
      return;
    }

    // Fetch email
    if (businessData) {
      const { data: email } = await supabase.rpc("get_user_email", { 
        user_uuid: businessData.user_id 
      });
      setBusiness({ ...businessData, email: email || null });
    }

    // Fetch all activity logs for this business user
    const { data: activityData, error: activityError } = await supabase
      .from("activity_logs")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });

    if (activityError) {
      console.error("Error fetching activities:", activityError);
    }

    const allActivities: ActivityLog[] = activityData || [];

    // Sort by created_at ascending (oldest first for timeline)
    allActivities.sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    setActivities(allActivities);
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
      case "signup":
        return `${details?.business_name || "Business"} registered on Cleanda`;
      case "login":
        const location = [details?.city, details?.country].filter(Boolean).join(", ");
        return location ? `Logged in from ${location}` : "Logged in";
      case "profile_update":
        return "Profile information updated";
      case "purchase":
        const jobType = details?.job_type || "lead";
        const postcode = details?.postcode || "";
        return `Purchased ${jobType} lead${postcode ? ` in ${postcode}` : ""}`;
      case "credit_purchase":
      case "credits_purchased":
        const purchasedAmount = details?.credits_added || details?.amount || 0;
        const totalAfterPurchase = details?.credits_total || "?";
        return `Purchased ${purchasedAmount} credits via Stripe (Total: ${totalAfterPurchase})`;
      case "credits_granted":
        const grantedAmount = details?.credits_added || details?.amount || 0;
        const grantReason = details?.reason || "";
        const totalAfterGrant = details?.credits_total || "?";
        return `${grantedAmount} credits granted by admin${grantReason ? ` - ${grantReason}` : ""} (Total: ${totalAfterGrant})`;
      case "credits_added":
        // Legacy support
        const creditsAdded = details?.amount || 0;
        return `${creditsAdded} credits added by admin`;
      case "verification_submitted":
        return "Submitted verification documents";
      case "verification_approved":
        return "Business verification approved";
      case "verification_rejected":
        const reason = details?.reason || "";
        return `Verification rejected${reason ? `: ${reason}` : ""}`;
      case "suspended":
        const suspendReason = details?.reason || "";
        return `Account suspended${suspendReason ? `: ${suspendReason}` : ""}`;
      case "unsuspended":
        return "Account reactivated";
      default:
        return ACTION_LABELS[activity.action] || activity.action;
    }
  };

  const getStatusBadge = (business: BusinessDetails) => {
    if (business.is_suspended) {
      return <Badge className="bg-red-500/20 text-red-600">Suspended</Badge>;
    }
    if (business.is_verified) {
      return <Badge className="bg-green-500/20 text-green-600">Verified</Badge>;
    }
    if (business.verification_status === "pending") {
      return <Badge className="bg-amber-500/20 text-amber-600">Pending Verification</Badge>;
    }
    return <Badge className="bg-muted text-muted-foreground">Unverified</Badge>;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-primary" />
            Business Activity Timeline
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex-1 flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : !business ? (
          <div className="flex-1 flex flex-col items-center justify-center py-12 text-muted-foreground">
            <AlertCircle className="w-8 h-8 mb-2" />
            <p>Business not found</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-6">
            {/* Business Summary Card */}
            <div className="bg-muted/30 rounded-lg p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-lg">{business.business_name || "Unnamed Business"}</h3>
                  <p className="text-muted-foreground">{business.contact_name || "No contact"}</p>
                </div>
                {getStatusBadge(business)}
              </div>
              
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <span className="font-mono">{business.phone || "Not set"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <span className="truncate">{business.email || "Not set"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  <span>{business.postcode || "Not set"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-muted-foreground" />
                  <span>Joined {format(new Date(business.created_at), "d MMM yyyy")}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-border grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-xl font-bold">{business.leads_purchased}</p>
                  <p className="text-xs text-muted-foreground">Leads Purchased</p>
                </div>
                <div>
                  <p className="text-xl font-bold">{business.credits}</p>
                  <p className="text-xs text-muted-foreground">Credits</p>
                </div>
                <div>
                  <p className="text-xl font-bold">£{business.leads_purchased * 20}</p>
                  <p className="text-xs text-muted-foreground">Total Spend</p>
                </div>
              </div>
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

                        {/* IP Address for logins */}
                        {activity.action === "login" && activity.ip_address && (
                          <div className="mt-2 text-xs text-muted-foreground">
                            IP: {activity.ip_address}
                          </div>
                        )}

                        {/* Additional details for purchases */}
                        {activity.action === "purchase" && (
                          <div className="mt-2">
                            <Badge className="bg-green-500/20 text-green-600">
                              <CreditCard className="w-3 h-3 mr-1" />
                              Lead Unlocked
                            </Badge>
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
                <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No activity recorded yet</p>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
