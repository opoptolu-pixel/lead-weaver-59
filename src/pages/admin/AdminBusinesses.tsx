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
  created_at: string;
  last_login: string | null;
  email?: string | null;
}

interface PurchaseHistory {
  id: string;
  job_type: string;
  postcode: string;
  unlocked_at: string;
}

export default function AdminBusinesses() {
  const { getDateFilter, dateRange } = useAdmin();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [purchaseHistory, setPurchaseHistory] = useState<PurchaseHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  
  // Add credits dialog
  const [isAddCreditsOpen, setIsAddCreditsOpen] = useState(false);
  const [creditsToAdd, setCreditsToAdd] = useState("");
  const [addingCredits, setAddingCredits] = useState(false);
  
  // Send email dialog
  const [isSendEmailOpen, setIsSendEmailOpen] = useState(false);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);

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

  const viewProfile = async (business: Business) => {
    setSelectedBusiness(business);
    setIsProfileOpen(true);
    setLoadingHistory(true);

    const { data, error } = await supabase
      .from("leads")
      .select("id, job_type, postcode, unlocked_at")
      .eq("unlocked_by", business.user_id)
      .order("unlocked_at", { ascending: false });

    if (!error && data) {
      setPurchaseHistory(data);
    }
    setLoadingHistory(false);
  };

  const toggleSuspension = async (business: Business, reason?: string) => {
    const suspensionReason = reason || "Suspended by admin";
    const isSuspending = !business.is_suspended;
    
    const { error } = await supabase
      .from("profiles")
      .update({
        is_suspended: isSuspending,
        suspension_reason: isSuspending ? suspensionReason : null,
      })
      .eq("id", business.id);

    if (error) {
      toast.error("Failed to update business");
      return;
    }
    
    // Send suspension notification email if suspending
    if (isSuspending && business.email) {
      try {
        // Fetch the email template
        const { data: template } = await supabase
          .from("email_templates")
          .select("subject, body")
          .eq("name", "account_suspended")
          .eq("is_active", true)
          .maybeSingle();

        if (template) {
          const variables: Record<string, string> = {
            business_name: business.business_name || business.contact_name || "Partner",
            suspension_reason: suspensionReason,
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
              templateName: "account_suspended",
            },
          });
          
          toast.success("Suspension email sent to business");
        }
      } catch (emailError) {
        console.error("Failed to send suspension email:", emailError);
        // Don't block the suspension if email fails
      }
    }
    
    toast.success(
      isSuspending ? "Business suspended" : "Business unsuspended"
    );
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
    } else {
      toast.success("Business verified");
      fetchBusinesses();
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

      // Log the action
      await supabase.from("activity_logs").insert({
        user_id: selectedBusiness.user_id,
        action: "credits_added",
        entity_type: "profile",
        entity_id: selectedBusiness.id,
        details: { amount, added_by: "admin" },
      });

      toast.success(`Added ${amount} credits successfully`);
      setIsAddCreditsOpen(false);
      setCreditsToAdd("");
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

  const filteredBusinesses = businesses.filter(
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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-sm text-muted-foreground">Total Businesses</p>
          <p className="text-2xl font-bold text-foreground">{filteredBusinesses.length}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-sm text-muted-foreground">Verified</p>
          <p className="text-2xl font-bold text-green-500">
            {filteredBusinesses.filter((b) => b.is_verified).length}
          </p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-sm text-muted-foreground">Pending Verification</p>
          <p className="text-2xl font-bold text-amber-500">
            {filteredBusinesses.filter((b) => !b.is_verified && !b.is_suspended).length}
          </p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-sm text-muted-foreground">Suspended</p>
          <p className="text-2xl font-bold text-destructive">
            {filteredBusinesses.filter((b) => b.is_suspended).length}
          </p>
        </div>
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
                    <th className="text-left p-4 font-medium text-muted-foreground">Leads</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Joined</th>
                    <th className="text-right p-4 font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {pagination.paginatedData.map((business) => (
                    <tr 
                      key={business.id} 
                      className="hover:bg-muted/30 cursor-pointer"
                      onClick={() => viewProfile(business)}
                    >
                      <td className="p-4">
                        <div>
                          <p className="font-medium text-foreground">
                            {business.business_name || business.contact_name || "Unnamed"}
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
                            <DropdownMenuItem
                              onClick={() => toggleSuspension(business)}
                              className={business.is_suspended ? "text-green-500" : "text-destructive"}
                            >
                              {business.is_suspended ? (
                                <>
                                  <CheckCircle className="w-4 h-4 mr-2" />
                                  Unsuspend
                                </>
                              ) : (
                                <>
                                  <Ban className="w-4 h-4 mr-2" />
                                  Suspend
                                </>
                              )}
                            </DropdownMenuItem>
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
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedBusiness?.business_name || selectedBusiness?.contact_name || "Business Profile"}
              {selectedBusiness && getVerificationBadge(selectedBusiness)}
            </DialogTitle>
            <DialogDescription>
              Business details and purchase history
            </DialogDescription>
          </DialogHeader>

          {selectedBusiness && (
            <Tabs defaultValue="details" className="mt-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="purchases">Purchase History</TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-muted-foreground text-xs">Business Name</Label>
                    <p className="font-medium">{selectedBusiness.business_name || "Not set"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-muted-foreground text-xs">Contact Name</Label>
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
                    <p className="font-medium">{selectedBusiness.phone || "Not set"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-muted-foreground text-xs flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> Postcode
                    </Label>
                    <p className="font-medium">{selectedBusiness.postcode || "Not set"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-muted-foreground text-xs flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> Joined
                    </Label>
                    <p className="font-medium">{format(new Date(selectedBusiness.created_at), "d MMM yyyy")}</p>
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
                    <div className="bg-muted/50 rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold text-foreground">{selectedBusiness.credits}</p>
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
                  </div>
                </div>
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
                        className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                      >
                        <div>
                          <p className="font-medium">{purchase.job_type}</p>
                          <p className="text-sm text-muted-foreground">
                            {purchase.postcode}
                          </p>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {purchase.unlocked_at
                            ? format(new Date(purchase.unlocked_at), "d MMM yyyy")
                            : "N/A"}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Credits Dialog */}
      <Dialog open={isAddCreditsOpen} onOpenChange={setIsAddCreditsOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              Add Credits
            </DialogTitle>
            <DialogDescription>
              Add credits to {selectedBusiness?.business_name || selectedBusiness?.contact_name}'s account
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Current Balance</Label>
              <p className="text-2xl font-bold">{selectedBusiness?.credits || 0} credits</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="credits-amount">Credits to Add</Label>
              <Input
                id="credits-amount"
                type="number"
                min="1"
                placeholder="Enter amount..."
                value={creditsToAdd}
                onChange={(e) => setCreditsToAdd(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddCreditsOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddCredits} disabled={addingCredits || !creditsToAdd}>
              {addingCredits && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Add Credits
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
              <textarea
                id="email-body"
                className="w-full min-h-[150px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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
    </AdminLayout>
  );
}
