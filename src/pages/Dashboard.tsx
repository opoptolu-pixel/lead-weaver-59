import { useState, useEffect } from "react";
import { trackInitiateCheckout } from "@/lib/analytics";
import { Link, useNavigate } from "react-router-dom";
import {
  Phone,
  Mail,
  MapPin,
  Copy,
  Check,
  Loader2,
  User,
  LogOut,
  Search,
  Calendar,
  Coins,
  Plus,
  Settings,
  CheckCircle2,
  XCircle,
  Clock,
  MessageSquareX,
  Lock,
  AlertTriangle,
  Menu,
  BarChart3,
  CreditCard,
  FileWarning,
  Home,
  BedDouble,
  Headphones,
  PhoneOutgoing,
  CalendarCheck,
  FileText,
} from "lucide-react";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import VerificationStatus from "@/components/VerificationStatus";
import { Logo } from "@/components/Logo";
import { DashboardSkeleton } from "@/components/skeletons/DashboardSkeleton";
import { useRateLimit, RATE_LIMIT_PRESETS } from "@/hooks/useRateLimit";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface UnlockedLead {
  id: string;
  postcode: string;
  job_type: string;
  display_value: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  customer_address: string;
  date: string;
  unlocked_at: string;
  job_status: string | null;
  job_notes: string | null;
  job_completed_at: string | null;
  access_expires_at: string | null;
  is_access_expired: boolean;
  property_type: string | null;
  bedrooms: string | null;
  frequency: string | null;
  booked_date?: string | null;
}

export default function Dashboard() {
  const { user, profile, signOut, loading: authLoading, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [leads, setLeads] = useState<UnlockedLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [buyingCredits, setBuyingCredits] = useState<string | null>(null);
  const [showCreditDialog, setShowCreditDialog] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [bookingLeadId, setBookingLeadId] = useState<string | null>(null);
  const [bookingDate, setBookingDate] = useState<Date | undefined>(undefined);
  const [bookingDialogOpen, setBookingDialogOpen] = useState(false);
  // Redirect if not logged in or profile incomplete
  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    } else if (!authLoading && user && profile) {
      const isProfileComplete =
        profile.contact_name &&
        profile.business_name &&
        profile.phone &&
        profile.postcode;
      if (!isProfileComplete) {
        navigate("/onboarding");
      }
    }
  }, [user, authLoading, profile, navigate]);

  // Fetch unlocked leads using secure function with time-limited access
  useEffect(() => {
    const fetchLeads = async () => {
      if (!user) return;

      try {
        // Use secure function that masks customer data after 30 days
        const { data, error } = await supabase
          .rpc("get_user_leads_with_access_control", {
            p_user_id: user.id,
          });

        if (error) throw error;
        setLeads(data || []);
      } catch (error) {
        console.error("Error fetching leads:", error);
        toast.error("Failed to load your leads");
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchLeads();
    }
  }, [user]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/for-cleaners");
    toast.success("Signed out successfully");
  };

  const copyToClipboard = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleBuyCredits = async (packSize: string) => {
    setBuyingCredits(packSize);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Please sign in to purchase credits");
        return;
      }

      const { data, error } = await supabase.functions.invoke("buy-credits", {
        body: { packSize },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      if (data.url) {
        trackInitiateCheckout({ contentName: `credit_pack_${packSize}`, contentCategory: 'credits', value: packSize === '5' ? 50 : 90 });
        if (window.fbq) {
          window.fbq('track', 'InitiateCheckout', {
            content_name: `credit_pack_${packSize}`,
            content_category: 'credits',
            value: packSize === '5' ? 50 : 90,
            currency: 'GBP',
          });
        }
        window.location.href = data.url;
      }
    } catch (err) {
      console.error("Error buying credits:", err);
      toast.error(err instanceof Error ? err.message : "Failed to start checkout");
    } finally {
      setBuyingCredits(null);
    }
  };

  const handleStatusUpdate = async (leadId: string, newStatus: string, notes?: string, bookedDate?: Date) => {
    if (!user) return;

    // Intercept "booked" — require a date
    if (newStatus === 'booked' && !bookedDate) {
      setBookingLeadId(leadId);
      setBookingDate(undefined);
      setBookingDialogOpen(true);
      return;
    }
    
    const lead = leads.find(l => l.id === leadId);
    const previousStatus = lead?.job_status || 'pending';
    
    setUpdatingStatus(leadId);
    try {
      const updateData: any = {
        job_status: newStatus,
      };
      
      if (newStatus === 'completed') {
        updateData.job_completed_at = new Date().toISOString();
      }

      if (newStatus === 'booked' && bookedDate) {
        updateData.booked_date = format(bookedDate, 'yyyy-MM-dd');
      }
      
      if (notes !== undefined) {
        updateData.job_notes = notes;
      }

      const { error } = await supabase
        .from("leads")
        .update(updateData)
        .eq("id", leadId);

      if (error) throw error;

      // Fetch fresh business name to ensure accurate logging
      const { data: freshProfile } = await supabase
        .from("profiles")
        .select("business_name, contact_name")
        .eq("user_id", user.id)
        .maybeSingle();

      // Log the job status change activity
      await supabase.from("activity_logs").insert({
        user_id: user.id,
        entity_type: "lead",
        entity_id: leadId,
        action: "job_status_change",
        details: {
          previous_status: previousStatus,
          new_status: newStatus,
          business_name: freshProfile?.business_name || profile?.business_name || "Unknown Business",
          contact_name: freshProfile?.contact_name || profile?.contact_name || user.email,
          notes: notes || null,
          booked_date: newStatus === 'booked' && bookedDate ? format(bookedDate, 'yyyy-MM-dd') : null,
        },
      });

      // Update local state
      setLeads(prev => prev.map(lead => 
        lead.id === leadId 
          ? { ...lead, ...updateData }
          : lead
      ));

      toast.success(newStatus === 'booked' ? `Job booked for ${format(bookedDate!, 'd MMM yyyy')}!` : "Job status updated!");
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Failed to update status");
    } finally {
      setUpdatingStatus(null);
    }
  };

  const handleConfirmBooking = () => {
    if (!bookingLeadId || !bookingDate) return;
    setBookingDialogOpen(false);
    handleStatusUpdate(bookingLeadId, 'booked', undefined, bookingDate);
    setBookingLeadId(null);
  };

  const getStatusIcon = (status: string | null) => {
    switch (status) {
      case 'contacted':
        return <PhoneOutgoing className="w-4 h-4 text-blue-500" />;
      case 'booked':
        return <CalendarCheck className="w-4 h-4 text-purple-500" />;
      case 'completed':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'lost':
        return <XCircle className="w-4 h-4 text-destructive" />;
      case 'no_response':
        return <MessageSquareX className="w-4 h-4 text-muted-foreground" />;
      default:
        return <Clock className="w-4 h-4 text-secondary" />;
    }
  };

  const getStatusLabel = (status: string | null) => {
    switch (status) {
      case 'contacted':
        return 'Contacted';
      case 'booked':
        return 'Booked';
      case 'completed':
        return 'Completed';
      case 'lost':
        return 'Lost';
      case 'no_response':
        return 'No Response';
      default:
        return 'Pending';
    }
  };

  const filteredLeads = leads.filter(
    (lead) =>
      lead.postcode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.job_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.customer_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Separate leads by status
  const pendingLeads = filteredLeads.filter(
    (lead) => !lead.job_status || lead.job_status === 'pending'
  );
  const contactedLeads = filteredLeads.filter(
    (lead) => lead.job_status === 'contacted'
  );
  const bookedLeads = filteredLeads.filter(
    (lead) => lead.job_status === 'booked'
  );
  const completedLeads = filteredLeads.filter(
    (lead) => lead.job_status === 'completed'
  );
  const lostLeads = filteredLeads.filter(
    (lead) => lead.job_status === 'lost'
  );
  const noResponseLeads = filteredLeads.filter(
    (lead) => lead.job_status === 'no_response'
  );

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "d MMM yyyy");
    } catch {
      return dateString;
    }
  };

  if (authLoading || loading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="cleaner-dashboard min-h-screen pb-20 md:pb-0">
      {/* Header */}
      <header className="bg-primary border-b border-border sticky top-0 z-50">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-20">
            <Logo size="md" variant="white" linkTo={null} />

            <div className="flex items-center gap-4">
              {/* Desktop navigation */}
              <div className="hidden sm:flex items-center gap-2">
                <Link to="/leads">
                  <Button variant="outlineHero" size="sm">
                    Browse Leads
                  </Button>
                </Link>
                <Link to="/performance">
                  <Button variant="ghost" size="sm" className="text-primary-foreground hover:bg-primary-foreground/10">
                    Performance
                  </Button>
                </Link>
                <Link to="/billing">
                  <Button variant="ghost" size="sm" className="text-primary-foreground hover:bg-primary-foreground/10">
                    Billing
                  </Button>
                </Link>
                <Link to="/disputes">
                  <Button variant="ghost" size="sm" className="text-primary-foreground hover:bg-primary-foreground/10">
                    Disputes
                  </Button>
                </Link>
                <Link to="/support">
                  <Button variant="ghost" size="sm" className="text-primary-foreground hover:bg-primary-foreground/10">
                    Support
                  </Button>
                </Link>
              </div>

              {/* Mobile navigation menu */}
              <div className="sm:hidden">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="text-primary-foreground hover:bg-primary-foreground/10">
                      <Menu className="w-5 h-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem asChild>
                      <Link to="/leads" className="flex items-center gap-2">
                        <Search className="w-4 h-4" />
                        Browse Leads
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/performance" className="flex items-center gap-2">
                        <BarChart3 className="w-4 h-4" />
                        Performance
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/billing" className="flex items-center gap-2">
                        <CreditCard className="w-4 h-4" />
                        Billing
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/disputes" className="flex items-center gap-2">
                        <FileWarning className="w-4 h-4" />
                        Disputes
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/support" className="flex items-center gap-2">
                        <Headphones className="w-4 h-4" />
                        Support
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link to="/settings" className="flex items-center gap-2">
                        <Settings className="w-4 h-4" />
                        Settings
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleSignOut} className="flex items-center gap-2 text-destructive">
                      <LogOut className="w-4 h-4" />
                      Sign Out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="hidden sm:flex items-center gap-3">
                <div className="text-right">
                  <p className="text-primary-foreground text-sm font-medium">
                    {profile?.business_name || user?.email}
                  </p>
                  <p className="text-primary-foreground/70 text-xs">
                    {profile?.credits || 0} credits
                  </p>
                </div>
                <Link to="/settings">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-primary-foreground hover:bg-primary-foreground/10"
                  >
                    <Settings className="w-4 h-4" />
                  </Button>
                </Link>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSignOut}
                  className="text-primary-foreground hover:bg-primary-foreground/10"
                >
                  <LogOut className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 md:px-6 py-6 md:py-10 max-w-6xl">
        {/* Suspension Banner */}
        {profile?.is_suspended && (
          <div className="mb-6 bg-destructive/10 border border-destructive rounded-xl p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-destructive flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-heading font-bold text-destructive text-lg">
                  Account Suspended
                </h3>
                <p className="text-destructive/90 mb-2">
                  Your account has been suspended{profile.suspension_reason ? ` due to: ${profile.suspension_reason}` : ""}.
                  You cannot unlock or purchase new leads until this is resolved.
                </p>
                <p className="text-muted-foreground text-sm">
                  If you believe this was made in error or would like to discuss reinstatement, please contact our support team at{" "}
                  <a href="mailto:hello@cleanda.co.uk" className="text-secondary hover:underline font-medium">
                    hello@cleanda.co.uk
                  </a>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Welcome section */}
        <div className="mb-10">
          <h1 className="text-foreground mb-1">
            Your Dashboard
          </h1>
          <p className="text-muted-foreground text-[0.9375rem]">
            Manage your unlocked leads and account
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5 mb-10">
          <div className="stat-card">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-secondary/10 flex items-center justify-center flex-shrink-0">
                <User className="w-6 h-6 text-secondary" />
              </div>
              <div>
                <p className="stat-label">Unlocked Leads</p>
                <p className="stat-value text-foreground">{leads.length}</p>
              </div>
            </div>
          </div>

          <div className="stat-card">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-secondary/10 flex items-center justify-center flex-shrink-0">
                  <Coins className="w-6 h-6 text-secondary" />
                </div>
                <div>
                  <p className="stat-label">Credits Available</p>
                  <p className="stat-value text-foreground">{profile?.credits || 0}</p>
                </div>
              </div>
              <Dialog open={showCreditDialog} onOpenChange={setShowCreditDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1 rounded-lg h-10 px-4">
                    <Plus className="w-4 h-4" />
                    Buy
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Buy Credit Pack</DialogTitle>
                    <DialogDescription>
                      Save money by buying credits in bulk. Use credits to unlock leads instantly.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <button
                      onClick={() => handleBuyCredits("5")}
                      disabled={buyingCredits !== null}
                      className="w-full p-5 rounded-2xl border border-border/60 hover:border-secondary transition-all text-left bg-card hover:bg-muted/30 disabled:opacity-50 hover:shadow-md"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-lg text-foreground">5 Credits</span>
                        <span className="text-secondary font-bold text-xl">£90</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground text-sm">£18 per lead</span>
                        <span className="text-secondary text-sm font-medium">Save £10</span>
                      </div>
                      {buyingCredits === "5" && (
                        <div className="flex items-center justify-center mt-3">
                          <Loader2 className="w-5 h-5 animate-spin text-secondary" />
                        </div>
                      )}
                    </button>

                    <button
                      onClick={() => handleBuyCredits("10")}
                      disabled={buyingCredits !== null}
                      className="w-full p-5 rounded-2xl border-2 border-secondary bg-secondary/5 hover:bg-secondary/10 transition-all text-left disabled:opacity-50 relative overflow-hidden hover:shadow-md"
                    >
                      <div className="absolute top-0 right-0 bg-secondary text-secondary-foreground text-xs font-bold px-3 py-1 rounded-bl-xl">
                        BEST VALUE
                      </div>
                      <div className="flex items-center justify-between mb-2 pt-1">
                        <span className="font-semibold text-lg text-foreground">10 Credits</span>
                        <span className="text-secondary font-bold text-xl mr-1">£170</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground text-sm">£17 per lead</span>
                        <span className="text-secondary text-sm font-medium">Save £30</span>
                      </div>
                      {buyingCredits === "10" && (
                        <div className="flex items-center justify-center mt-3">
                          <Loader2 className="w-5 h-5 animate-spin text-secondary" />
                        </div>
                      )}
                    </button>
                  </div>
                  <p className="text-muted-foreground text-xs text-center mt-4">
                    Or pay £20 per lead without credits
                  </p>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <div className="stat-card">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-secondary/10 flex items-center justify-center flex-shrink-0">
                <Calendar className="w-6 h-6 text-secondary" />
              </div>
              <div>
                <p className="stat-label">Member Since</p>
                <p className="stat-value text-foreground">
                  {user?.created_at ? formatDate(user.created_at) : "N/A"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Verification Status */}
        {profile && !profile.is_verified && (
          <div className="mb-8">
            <VerificationStatus
              isVerified={profile.is_verified}
              verificationStatus={profile.verification_status || "pending"}
              leadsPurchased={profile.leads_purchased}
              phoneVerified={profile.phone_verified}
              addressVerified={profile.address_verified}
            />
          </div>
        )}

        {/* Pending Leads section */}
        <div className="dash-card overflow-hidden mb-6">
          <div className="section-header">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <h2 className="text-foreground">
                Pending Leads
              </h2>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search leads..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-secondary" />
            </div>
          ) : pendingLeads.length === 0 ? (
            <div className="text-center py-12 px-4">
              {leads.length === 0 ? (
                <>
                  <p className="text-muted-foreground text-lg mb-4">
                    You haven't unlocked any leads yet
                  </p>
                  <Link to="/leads">
                    <Button variant="cta">Browse Available Leads</Button>
                  </Link>
                </>
              ) : pendingLeads.length === 0 && (contactedLeads.length > 0 || bookedLeads.length > 0 || completedLeads.length > 0 || lostLeads.length > 0 || noResponseLeads.length > 0) ? (
                <p className="text-muted-foreground text-lg">
                  No pending leads right now
                </p>
              ) : (
                <p className="text-muted-foreground text-lg">
                  No pending leads match your search
                </p>
              )}
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {pendingLeads.map((lead) => (
                <div key={lead.id} className={`lead-card ${lead.is_access_expired ? 'bg-muted/10' : ''}`}>
                  {/* Access expiration warning */}
                  {lead.is_access_expired ? (
                    <div className="flex items-center gap-2 bg-destructive/8 border border-destructive/15 rounded-xl px-4 py-2.5 mb-4">
                      <Lock className="w-4 h-4 text-destructive" />
                      <span className="text-destructive text-sm font-medium">
                        Contact access expired - Customer data is no longer available
                      </span>
                    </div>
                  ) : lead.access_expires_at && (
                    <div className="flex items-center gap-2 bg-secondary/8 border border-secondary/15 rounded-xl px-4 py-2.5 mb-4">
                      <AlertTriangle className="w-4 h-4 text-secondary" />
                      <span className="text-secondary text-sm">
                        Contact access expires: {formatDate(lead.access_expires_at)}
                      </span>
                    </div>
                  )}
                  
                  <div className="flex flex-col lg:flex-row lg:items-start gap-6">
                    {/* Lead info */}
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <span className="postcode-tag mb-2">
                            {lead.postcode}
                          </span>
                          <h3 className="text-foreground">
                            {lead.job_type}
                          </h3>
                        </div>
                        <div className="text-right">
                          <p className="text-secondary font-bold text-xl tracking-tight">
                            {lead.display_value}
                          </p>
                          <p className="text-muted-foreground text-sm">
                            {formatDate(lead.date)}
                          </p>
                        </div>
                      </div>

                      <p className={`font-medium mb-3 text-[0.9375rem] ${lead.is_access_expired ? 'text-muted-foreground' : 'text-foreground'}`}>
                        {lead.customer_name}
                      </p>

                      {/* Property details */}
                      {(lead.property_type || lead.bedrooms || lead.frequency) && (
                        <div className="flex flex-wrap gap-2 mb-4">
                          {lead.property_type && (
                            <span className="property-badge bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400">
                              <Home className="w-3 h-3" />
                              {lead.property_type}
                            </span>
                          )}
                          {lead.bedrooms && (
                            <span className="property-badge bg-purple-50 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400">
                              <BedDouble className="w-3 h-3" />
                              {lead.bedrooms}{/^\d/.test(lead.bedrooms) ? " bed" : ""}
                            </span>
                          )}
                          {lead.frequency && (
                            <span className="property-badge bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400">
                              <Clock className="w-3 h-3" />
                              {lead.frequency}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Customer notes */}
                      {lead.job_notes && !lead.is_access_expired && (
                        <div className="mb-4 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-800/30 rounded-xl p-3">
                          <div className="flex items-start gap-2">
                            <FileText className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="text-xs font-medium text-amber-700 dark:text-amber-400 mb-1">Customer Notes</p>
                              <p className="text-sm text-foreground whitespace-pre-line">{lead.job_notes}</p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Contact details */}
                      <div className="grid md:grid-cols-2 gap-3">
                        <div className={`contact-row flex items-center gap-2 ${lead.is_access_expired ? 'opacity-60' : ''}`}>
                          <Phone className={`w-4 h-4 ${lead.is_access_expired ? 'text-muted-foreground' : 'text-secondary'}`} />
                          {lead.is_access_expired ? (
                            <span className="text-muted-foreground flex-1">{lead.customer_phone}</span>
                          ) : (
                            <>
                              <a
                                href={`tel:${lead.customer_phone}`}
                                className="text-foreground hover:text-secondary transition-colors flex-1"
                              >
                                {lead.customer_phone}
                              </a>
                              <button
                                onClick={() => copyToClipboard(lead.customer_phone, `phone-${lead.id}`)}
                                className="text-muted-foreground hover:text-foreground"
                              >
                                {copiedField === `phone-${lead.id}` ? (
                                  <Check className="w-4 h-4" />
                                ) : (
                                  <Copy className="w-4 h-4" />
                                )}
                              </button>
                            </>
                          )}
                        </div>

                        <div className={`contact-row flex items-center gap-2 ${lead.is_access_expired ? 'opacity-60' : ''}`}>
                          <Mail className={`w-4 h-4 ${lead.is_access_expired ? 'text-muted-foreground' : 'text-secondary'}`} />
                          {lead.is_access_expired ? (
                            <span className="text-muted-foreground flex-1 truncate">{lead.customer_email}</span>
                          ) : (
                            <>
                              <a
                                href={`mailto:${lead.customer_email}`}
                                className="text-foreground hover:text-secondary transition-colors flex-1 truncate"
                              >
                                {lead.customer_email}
                              </a>
                              <button
                                onClick={() => copyToClipboard(lead.customer_email, `email-${lead.id}`)}
                                className="text-muted-foreground hover:text-foreground"
                              >
                                {copiedField === `email-${lead.id}` ? (
                                  <Check className="w-4 h-4" />
                                ) : (
                                  <Copy className="w-4 h-4" />
                                )}
                              </button>
                            </>
                          )}
                        </div>

                        <div className={`contact-row md:col-span-2 flex items-start gap-2 ${lead.is_access_expired ? 'opacity-60' : ''}`}>
                          <MapPin className={`w-4 h-4 mt-0.5 ${lead.is_access_expired ? 'text-muted-foreground' : 'text-secondary'}`} />
                          <span className={`flex-1 ${lead.is_access_expired ? 'text-muted-foreground' : 'text-foreground'}`}>
                            {lead.customer_address}
                          </span>
                          {!lead.is_access_expired && (
                            <button
                              onClick={() => copyToClipboard(lead.customer_address, `address-${lead.id}`)}
                              className="text-muted-foreground hover:text-foreground"
                            >
                              {copiedField === `address-${lead.id}` ? (
                                <Check className="w-4 h-4" />
                              ) : (
                                <Copy className="w-4 h-4" />
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-3 min-w-[160px]">
                      {/* Job Status */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                          {getStatusIcon(lead.job_status)}
                          <span className="font-medium text-foreground">
                            {getStatusLabel(lead.job_status)}
                          </span>
                        </div>
                        <Select
                          value={lead.job_status || 'pending'}
                          onValueChange={(value) => handleStatusUpdate(lead.id, value)}
                          disabled={updatingStatus === lead.id}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Update status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">
                              <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4" />
                                Pending
                              </div>
                            </SelectItem>
                            <SelectItem value="contacted">
                              <div className="flex items-center gap-2">
                                <PhoneOutgoing className="w-4 h-4 text-blue-500" />
                                Contacted
                              </div>
                            </SelectItem>
                            <SelectItem value="booked">
                              <div className="flex items-center gap-2">
                                <CalendarCheck className="w-4 h-4 text-purple-500" />
                                Booked
                              </div>
                            </SelectItem>
                            <SelectItem value="completed">
                              <div className="flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4 text-green-500" />
                                Completed
                              </div>
                            </SelectItem>
                            <SelectItem value="lost">
                              <div className="flex items-center gap-2">
                                <XCircle className="w-4 h-4 text-destructive" />
                                Lost to competitor
                              </div>
                            </SelectItem>
                            <SelectItem value="no_response">
                              <div className="flex items-center gap-2">
                                <MessageSquareX className="w-4 h-4" />
                                No response
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Call/Email buttons */}
                      {lead.is_access_expired ? (
                        <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm py-2">
                          <Lock className="w-4 h-4" />
                          <span>Access expired</span>
                        </div>
                      ) : (
                        <div className="flex gap-3">
                          <a href={`tel:${lead.customer_phone}`} className="flex-1">
                            <Button variant="cta" size="sm" className="w-full gap-1.5 h-11 rounded-xl text-[0.8125rem] font-semibold">
                              <Phone className="w-4 h-4" />
                              Call
                            </Button>
                          </a>
                          <a href={`mailto:${lead.customer_email}`} className="flex-1">
                            <Button variant="outline" size="sm" className="w-full gap-1.5 h-11 rounded-xl text-[0.8125rem] font-semibold">
                              <Mail className="w-4 h-4" />
                              Email
                            </Button>
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Contacted Leads section */}
        {contactedLeads.length > 0 && (
          <div className="dash-card overflow-hidden mb-6">
            <div className="section-header">
              <div className="flex items-center gap-2">
                <PhoneOutgoing className="w-5 h-5 text-blue-500" />
                <h2 className="text-foreground">
                  Contacted ({contactedLeads.length})
                </h2>
              </div>
            </div>
            <div className="divide-y divide-border/50">
              {contactedLeads.map((lead) => (
                <div key={lead.id} className={`lead-card bg-blue-50/20 dark:bg-blue-950/10 ${lead.is_access_expired ? 'bg-muted/10' : ''}`}>
                  {/* Access expiration warning */}
                  {lead.is_access_expired ? (
                    <div className="flex items-center gap-2 bg-destructive/8 border border-destructive/15 rounded-xl px-4 py-2.5 mb-4">
                      <Lock className="w-4 h-4 text-destructive" />
                      <span className="text-destructive text-sm font-medium">Contact access expired - Customer data is no longer available</span>
                    </div>
                  ) : lead.access_expires_at && (
                    <div className="flex items-center gap-2 bg-secondary/8 border border-secondary/15 rounded-xl px-4 py-2.5 mb-4">
                      <AlertTriangle className="w-4 h-4 text-secondary" />
                      <span className="text-secondary text-sm">Contact access expires: {formatDate(lead.access_expires_at)}</span>
                    </div>
                  )}
                  <div className="flex flex-col lg:flex-row lg:items-start gap-6">
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <span className="postcode-tag mb-2">{lead.postcode}</span>
                          <h3 className="text-foreground">{lead.job_type}</h3>
                        </div>
                        <div className="text-right">
                          <p className="text-secondary font-bold text-xl">{lead.display_value}</p>
                          <p className="text-muted-foreground text-sm">{formatDate(lead.date)}</p>
                        </div>
                      </div>
                      <p className={`font-medium mb-3 text-[0.9375rem] ${lead.is_access_expired ? 'text-muted-foreground' : 'text-foreground'}`}>{lead.customer_name}</p>
                      {(lead.property_type || lead.bedrooms || lead.frequency) && (
                        <div className="flex flex-wrap gap-2 mb-4">
                          {lead.property_type && <span className="property-badge bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400"><Home className="w-3 h-3" />{lead.property_type}</span>}
                          {lead.bedrooms && <span className="property-badge bg-purple-50 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400"><BedDouble className="w-3 h-3" />{lead.bedrooms}{/^\d/.test(lead.bedrooms) ? " bed" : ""}</span>}
                          {lead.frequency && <span className="property-badge bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400"><Clock className="w-3 h-3" />{lead.frequency}</span>}
                        </div>
                      )}
                      {lead.job_notes && !lead.is_access_expired && (
                        <div className="mb-4 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-800/30 rounded-xl p-3">
                          <div className="flex items-start gap-2">
                            <FileText className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="text-xs font-medium text-amber-700 dark:text-amber-400 mb-1">Customer Notes</p>
                              <p className="text-sm text-foreground whitespace-pre-line">{lead.job_notes}</p>
                            </div>
                          </div>
                        </div>
                      )}
                      <div className="grid md:grid-cols-2 gap-3">
                        <div className={`contact-row flex items-center gap-2 ${lead.is_access_expired ? 'opacity-60' : ''}`}>
                          <Phone className={`w-4 h-4 ${lead.is_access_expired ? 'text-muted-foreground' : 'text-secondary'}`} />
                          {lead.is_access_expired ? (
                            <span className="text-muted-foreground flex-1">{lead.customer_phone}</span>
                          ) : (
                            <><a href={`tel:${lead.customer_phone}`} className="text-foreground hover:text-secondary transition-colors flex-1">{lead.customer_phone}</a>
                            <button onClick={() => copyToClipboard(lead.customer_phone, `phone-${lead.id}`)} className="text-muted-foreground hover:text-foreground">{copiedField === `phone-${lead.id}` ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}</button></>
                          )}
                        </div>
                        <div className={`contact-row flex items-center gap-2 ${lead.is_access_expired ? 'opacity-60' : ''}`}>
                          <Mail className={`w-4 h-4 ${lead.is_access_expired ? 'text-muted-foreground' : 'text-secondary'}`} />
                          {lead.is_access_expired ? (
                            <span className="text-muted-foreground flex-1 truncate">{lead.customer_email}</span>
                          ) : (
                            <><a href={`mailto:${lead.customer_email}`} className="text-foreground hover:text-secondary transition-colors flex-1 truncate">{lead.customer_email}</a>
                            <button onClick={() => copyToClipboard(lead.customer_email, `email-${lead.id}`)} className="text-muted-foreground hover:text-foreground">{copiedField === `email-${lead.id}` ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}</button></>
                          )}
                        </div>
                        <div className={`contact-row md:col-span-2 flex items-start gap-2 ${lead.is_access_expired ? 'opacity-60' : ''}`}>
                          <MapPin className={`w-4 h-4 mt-0.5 ${lead.is_access_expired ? 'text-muted-foreground' : 'text-secondary'}`} />
                          <span className={`flex-1 ${lead.is_access_expired ? 'text-muted-foreground' : 'text-foreground'}`}>{lead.customer_address}</span>
                          {!lead.is_access_expired && (
                            <button onClick={() => copyToClipboard(lead.customer_address, `address-${lead.id}`)} className="text-muted-foreground hover:text-foreground">{copiedField === `address-${lead.id}` ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}</button>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col gap-3 min-w-[160px]">
                      <div className="flex items-center gap-2 text-sm">
                        <PhoneOutgoing className="w-4 h-4 text-blue-500" />
                        <span className="font-medium text-blue-600">Contacted</span>
                      </div>
                      <Select value={lead.job_status || 'pending'} onValueChange={(value) => handleStatusUpdate(lead.id, value)} disabled={updatingStatus === lead.id}>
                        <SelectTrigger className="w-full"><SelectValue placeholder="Update status" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending"><div className="flex items-center gap-2"><Clock className="w-4 h-4" /> Pending</div></SelectItem>
                          <SelectItem value="contacted"><div className="flex items-center gap-2"><PhoneOutgoing className="w-4 h-4 text-blue-500" /> Contacted</div></SelectItem>
                          <SelectItem value="booked"><div className="flex items-center gap-2"><CalendarCheck className="w-4 h-4 text-purple-500" /> Booked</div></SelectItem>
                          <SelectItem value="completed"><div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-500" /> Completed</div></SelectItem>
                          <SelectItem value="lost"><div className="flex items-center gap-2"><XCircle className="w-4 h-4 text-destructive" /> Lost to competitor</div></SelectItem>
                          <SelectItem value="no_response"><div className="flex items-center gap-2"><MessageSquareX className="w-4 h-4" /> No response</div></SelectItem>
                        </SelectContent>
                      </Select>
                      {lead.is_access_expired ? (
                        <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm py-2"><Lock className="w-4 h-4" /><span>Access expired</span></div>
                      ) : (
                        <div className="flex gap-3">
                          <a href={`tel:${lead.customer_phone}`} className="flex-1"><Button variant="cta" size="sm" className="w-full gap-1.5 h-11 rounded-xl text-[0.8125rem] font-semibold"><Phone className="w-4 h-4" />Call</Button></a>
                          <a href={`mailto:${lead.customer_email}`} className="flex-1"><Button variant="outline" size="sm" className="w-full gap-1.5 h-11 rounded-xl text-[0.8125rem] font-semibold"><Mail className="w-4 h-4" />Email</Button></a>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Booked Leads section */}
        {bookedLeads.length > 0 && (
          <div className="dash-card overflow-hidden mb-6">
            <div className="section-header">
              <div className="flex items-center gap-2">
                <CalendarCheck className="w-5 h-5 text-purple-500" />
                <h2 className="text-foreground">
                  Booked ({bookedLeads.length})
                </h2>
              </div>
            </div>
            <div className="divide-y divide-border/50">
              {bookedLeads.map((lead) => (
                <div key={lead.id} className={`lead-card bg-purple-50/20 dark:bg-purple-950/10 ${lead.is_access_expired ? 'bg-muted/10' : ''}`}>
                  {/* Access expiration warning */}
                  {lead.is_access_expired ? (
                    <div className="flex items-center gap-2 bg-destructive/8 border border-destructive/15 rounded-xl px-4 py-2.5 mb-4">
                      <Lock className="w-4 h-4 text-destructive" />
                      <span className="text-destructive text-sm font-medium">Contact access expired - Customer data is no longer available</span>
                    </div>
                  ) : lead.access_expires_at && (
                    <div className="flex items-center gap-2 bg-secondary/8 border border-secondary/15 rounded-xl px-4 py-2.5 mb-4">
                      <AlertTriangle className="w-4 h-4 text-secondary" />
                      <span className="text-secondary text-sm">Contact access expires: {formatDate(lead.access_expires_at)}</span>
                    </div>
                  )}
                  <div className="flex flex-col lg:flex-row lg:items-start gap-6">
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <span className="postcode-tag mb-2">{lead.postcode}</span>
                          <h3 className="text-foreground">{lead.job_type}</h3>
                        </div>
                        <div className="text-right">
                          <p className="text-secondary font-bold text-xl tracking-tight">{lead.display_value}</p>
                          <p className="text-muted-foreground text-sm">{formatDate(lead.date)}</p>
                        </div>
                      </div>
                      <p className={`font-medium mb-3 text-[0.9375rem] ${lead.is_access_expired ? 'text-muted-foreground' : 'text-foreground'}`}>{lead.customer_name}</p>
                      {(lead.property_type || lead.bedrooms || lead.frequency) && (
                        <div className="flex flex-wrap gap-2 mb-4">
                          {lead.property_type && <span className="property-badge bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400"><Home className="w-3 h-3" />{lead.property_type}</span>}
                          {lead.bedrooms && <span className="property-badge bg-purple-50 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400"><BedDouble className="w-3 h-3" />{lead.bedrooms}{/^\d/.test(lead.bedrooms) ? " bed" : ""}</span>}
                          {lead.frequency && <span className="property-badge bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400"><Clock className="w-3 h-3" />{lead.frequency}</span>}
                        </div>
                      )}
                      {lead.job_notes && !lead.is_access_expired && (
                        <div className="mb-4 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-800/30 rounded-xl p-3">
                          <div className="flex items-start gap-2">
                            <FileText className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="text-xs font-medium text-amber-700 dark:text-amber-400 mb-1">Customer Notes</p>
                              <p className="text-sm text-foreground whitespace-pre-line">{lead.job_notes}</p>
                            </div>
                          </div>
                        </div>
                      )}
                      <div className="grid md:grid-cols-2 gap-3 mb-3">
                        <div className={`contact-row flex items-center gap-2 ${lead.is_access_expired ? 'opacity-60' : ''}`}>
                          <Phone className={`w-4 h-4 ${lead.is_access_expired ? 'text-muted-foreground' : 'text-secondary'}`} />
                          {lead.is_access_expired ? (
                            <span className="text-muted-foreground flex-1">{lead.customer_phone}</span>
                          ) : (
                            <><a href={`tel:${lead.customer_phone}`} className="text-foreground hover:text-secondary transition-colors flex-1">{lead.customer_phone}</a>
                            <button onClick={() => copyToClipboard(lead.customer_phone, `phone-${lead.id}`)} className="text-muted-foreground hover:text-foreground">{copiedField === `phone-${lead.id}` ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}</button></>
                          )}
                        </div>
                        <div className={`contact-row flex items-center gap-2 ${lead.is_access_expired ? 'opacity-60' : ''}`}>
                          <Mail className={`w-4 h-4 ${lead.is_access_expired ? 'text-muted-foreground' : 'text-secondary'}`} />
                          {lead.is_access_expired ? (
                            <span className="text-muted-foreground flex-1 truncate">{lead.customer_email}</span>
                          ) : (
                            <><a href={`mailto:${lead.customer_email}`} className="text-foreground hover:text-secondary transition-colors flex-1 truncate">{lead.customer_email}</a>
                            <button onClick={() => copyToClipboard(lead.customer_email, `email-${lead.id}`)} className="text-muted-foreground hover:text-foreground">{copiedField === `email-${lead.id}` ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}</button></>
                          )}
                        </div>
                        <div className={`contact-row md:col-span-2 flex items-start gap-2 ${lead.is_access_expired ? 'opacity-60' : ''}`}>
                          <MapPin className={`w-4 h-4 mt-0.5 ${lead.is_access_expired ? 'text-muted-foreground' : 'text-secondary'}`} />
                          <span className={`flex-1 ${lead.is_access_expired ? 'text-muted-foreground' : 'text-foreground'}`}>{lead.customer_address}</span>
                          {!lead.is_access_expired && (
                            <button onClick={() => copyToClipboard(lead.customer_address, `address-${lead.id}`)} className="text-muted-foreground hover:text-foreground">{copiedField === `address-${lead.id}` ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}</button>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-purple-600">
                        <CalendarCheck className="w-4 h-4" />
                        <span>Job booked{lead.booked_date ? ` for ${formatDate(lead.booked_date)}` : ''}</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-3 min-w-[160px]">
                      <div className="flex items-center gap-2 text-sm">
                        <CalendarCheck className="w-4 h-4 text-purple-500" />
                        <span className="font-medium text-purple-600">Booked</span>
                      </div>
                      <Select value={lead.job_status || 'pending'} onValueChange={(value) => handleStatusUpdate(lead.id, value)} disabled={updatingStatus === lead.id}>
                        <SelectTrigger className="w-full"><SelectValue placeholder="Update status" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending"><div className="flex items-center gap-2"><Clock className="w-4 h-4" /> Pending</div></SelectItem>
                          <SelectItem value="contacted"><div className="flex items-center gap-2"><PhoneOutgoing className="w-4 h-4 text-blue-500" /> Contacted</div></SelectItem>
                          <SelectItem value="booked"><div className="flex items-center gap-2"><CalendarCheck className="w-4 h-4 text-purple-500" /> Booked</div></SelectItem>
                          <SelectItem value="completed"><div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-500" /> Completed</div></SelectItem>
                          <SelectItem value="lost"><div className="flex items-center gap-2"><XCircle className="w-4 h-4 text-destructive" /> Lost to competitor</div></SelectItem>
                          <SelectItem value="no_response"><div className="flex items-center gap-2"><MessageSquareX className="w-4 h-4" /> No response</div></SelectItem>
                        </SelectContent>
                      </Select>
                      {lead.is_access_expired ? (
                        <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm py-2"><Lock className="w-4 h-4" /><span>Access expired</span></div>
                      ) : (
                        <div className="flex gap-3">
                          <a href={`tel:${lead.customer_phone}`} className="flex-1"><Button variant="cta" size="sm" className="w-full gap-1.5 h-11 rounded-xl text-[0.8125rem] font-semibold"><Phone className="w-4 h-4" />Call</Button></a>
                          <a href={`mailto:${lead.customer_email}`} className="flex-1"><Button variant="outline" size="sm" className="w-full gap-1.5 h-11 rounded-xl text-[0.8125rem] font-semibold"><Mail className="w-4 h-4" />Email</Button></a>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Completed Leads section */}
        {completedLeads.length > 0 && (
          <div className="dash-card overflow-hidden mb-6">
            <div className="section-header">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-500" />
                <h2 className="text-foreground">
                  Completed ({completedLeads.length})
                </h2>
              </div>
            </div>
            <div className="divide-y divide-border/50">
              {completedLeads.map((lead) => (
                <div key={lead.id} className="lead-card bg-green-50/20 dark:bg-green-950/10">
                  <div className="flex flex-col lg:flex-row lg:items-start gap-6">
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <span className="postcode-tag mb-2">{lead.postcode}</span>
                          <h3 className="text-foreground">{lead.job_type}</h3>
                        </div>
                        <div className="text-right">
                          <p className="text-secondary font-bold text-xl tracking-tight">{lead.display_value}</p>
                          <p className="text-muted-foreground text-sm">{formatDate(lead.date)}</p>
                        </div>
                      </div>
                      <p className="font-medium text-foreground mb-2 text-[0.9375rem]">{lead.customer_name}</p>
                      <div className="flex items-center gap-2 text-sm text-green-600">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Completed {lead.job_completed_at ? `on ${formatDate(lead.job_completed_at)}` : ''}</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-3 min-w-[160px]">
                      <div className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                        <span className="font-medium text-green-600">Completed</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Lost Leads section */}
        {lostLeads.length > 0 && (
          <div className="dash-card overflow-hidden mb-6">
            <div className="section-header">
              <div className="flex items-center gap-2">
                <XCircle className="w-5 h-5 text-destructive" />
                <h2 className="text-foreground">
                  Lost ({lostLeads.length})
                </h2>
              </div>
            </div>
            <div className="divide-y divide-border/50">
              {lostLeads.map((lead) => (
                <div key={lead.id} className="lead-card bg-red-50/20 dark:bg-red-950/10">
                  <div className="flex flex-col lg:flex-row lg:items-start gap-6">
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <span className="postcode-tag mb-2">{lead.postcode}</span>
                          <h3 className="text-foreground">{lead.job_type}</h3>
                        </div>
                        <div className="text-right">
                          <p className="text-secondary font-bold text-xl tracking-tight">{lead.display_value}</p>
                          <p className="text-muted-foreground text-sm">{formatDate(lead.date)}</p>
                        </div>
                      </div>
                      <p className="font-medium text-foreground mb-2 text-[0.9375rem]">{lead.customer_name}</p>
                      <div className="flex items-center gap-2 text-sm text-destructive">
                        <XCircle className="w-4 h-4" />
                        <span>Lost to competitor</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-3 min-w-[160px]">
                      <div className="flex items-center gap-2 text-sm">
                        <XCircle className="w-4 h-4 text-destructive" />
                        <span className="font-medium text-destructive">Lost</span>
                      </div>
                      <Select value={lead.job_status || 'pending'} onValueChange={(value) => handleStatusUpdate(lead.id, value)} disabled={updatingStatus === lead.id}>
                        <SelectTrigger className="w-full"><SelectValue placeholder="Update status" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending"><div className="flex items-center gap-2"><Clock className="w-4 h-4" /> Pending</div></SelectItem>
                          <SelectItem value="contacted"><div className="flex items-center gap-2"><PhoneOutgoing className="w-4 h-4 text-blue-500" /> Contacted</div></SelectItem>
                          <SelectItem value="booked"><div className="flex items-center gap-2"><CalendarCheck className="w-4 h-4 text-purple-500" /> Booked</div></SelectItem>
                          <SelectItem value="completed"><div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-500" /> Completed</div></SelectItem>
                          <SelectItem value="lost"><div className="flex items-center gap-2"><XCircle className="w-4 h-4 text-destructive" /> Lost to competitor</div></SelectItem>
                          <SelectItem value="no_response"><div className="flex items-center gap-2"><MessageSquareX className="w-4 h-4" /> No response</div></SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* No Response Leads section */}
        {noResponseLeads.length > 0 && (
          <div className="dash-card overflow-hidden mb-6">
            <div className="section-header">
              <div className="flex items-center gap-2">
                <MessageSquareX className="w-5 h-5 text-muted-foreground" />
                <h2 className="text-foreground">
                  No Response ({noResponseLeads.length})
                </h2>
              </div>
            </div>
            <div className="divide-y divide-border/50">
              {noResponseLeads.map((lead) => (
                <div key={lead.id} className="lead-card">
                  <div className="flex flex-col lg:flex-row lg:items-start gap-6">
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <span className="postcode-tag mb-2">{lead.postcode}</span>
                          <h3 className="text-foreground">{lead.job_type}</h3>
                        </div>
                        <div className="text-right">
                          <p className="text-secondary font-bold text-xl tracking-tight">{lead.display_value}</p>
                          <p className="text-muted-foreground text-sm">{formatDate(lead.date)}</p>
                        </div>
                      </div>
                      <p className="font-medium text-foreground mb-2 text-[0.9375rem]">{lead.customer_name}</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MessageSquareX className="w-4 h-4" />
                        <span>Customer did not respond</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-3 min-w-[160px]">
                      <div className="flex items-center gap-2 text-sm">
                        <MessageSquareX className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium text-muted-foreground">No Response</span>
                      </div>
                      <Select value={lead.job_status || 'pending'} onValueChange={(value) => handleStatusUpdate(lead.id, value)} disabled={updatingStatus === lead.id}>
                        <SelectTrigger className="w-full"><SelectValue placeholder="Update status" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending"><div className="flex items-center gap-2"><Clock className="w-4 h-4" /> Pending</div></SelectItem>
                          <SelectItem value="contacted"><div className="flex items-center gap-2"><PhoneOutgoing className="w-4 h-4 text-blue-500" /> Contacted</div></SelectItem>
                          <SelectItem value="booked"><div className="flex items-center gap-2"><CalendarCheck className="w-4 h-4 text-purple-500" /> Booked</div></SelectItem>
                          <SelectItem value="completed"><div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-500" /> Completed</div></SelectItem>
                          <SelectItem value="lost"><div className="flex items-center gap-2"><XCircle className="w-4 h-4 text-destructive" /> Lost to competitor</div></SelectItem>
                          <SelectItem value="no_response"><div className="flex items-center gap-2"><MessageSquareX className="w-4 h-4" /> No response</div></SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {/* Booking Date Dialog */}
        <Dialog open={bookingDialogOpen} onOpenChange={(open) => {
          setBookingDialogOpen(open);
          if (!open) {
            setBookingLeadId(null);
            setBookingDate(undefined);
          }
        }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Select Service Date</DialogTitle>
              <DialogDescription>
                Choose the date the cleaning service is scheduled. We'll send SMS reminders 3 days before, 2 days before, and on the morning of the job.
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-center py-4">
              <CalendarComponent
                mode="single"
                selected={bookingDate}
                onSelect={setBookingDate}
                disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                className="rounded-md border"
              />
            </div>
            {bookingDate && (
              <p className="text-center text-sm text-muted-foreground">
                Selected: <span className="font-medium text-foreground">{format(bookingDate, "EEEE, d MMMM yyyy")}</span>
              </p>
            )}
            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setBookingDialogOpen(false);
                  setBookingLeadId(null);
                  setBookingDate(undefined);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="cta"
                className="flex-1 gap-2"
                disabled={!bookingDate}
                onClick={handleConfirmBooking}
              >
                <CalendarCheck className="w-4 h-4" />
                Confirm Booking
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
