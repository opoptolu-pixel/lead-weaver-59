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
  AlertTriangle,
  Trash2,
  Mail,
  Phone,
  MapPin,
  Calendar,
  CreditCard,
  FileText,
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
}

interface PurchaseHistory {
  id: string;
  job_type: string;
  postcode: string;
  unlocked_at: string;
}

export default function AdminBusinesses() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [purchaseHistory, setPurchaseHistory] = useState<PurchaseHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    fetchBusinesses();
  }, []);

  const fetchBusinesses = async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching businesses:", error);
      toast.error("Failed to load businesses");
    } else {
      setBusinesses(data || []);
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

  const toggleSuspension = async (business: Business) => {
    const { error } = await supabase
      .from("profiles")
      .update({
        is_suspended: !business.is_suspended,
        suspension_reason: business.is_suspended ? null : "Suspended by admin",
      })
      .eq("id", business.id);

    if (error) {
      toast.error("Failed to update business");
    } else {
      toast.success(
        business.is_suspended ? "Business unsuspended" : "Business suspended"
      );
      fetchBusinesses();
    }
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

  const filteredBusinesses = businesses.filter(
    (b) =>
      (b.business_name?.toLowerCase() || "").includes(searchQuery.toLowerCase()) ||
      (b.contact_name?.toLowerCase() || "").includes(searchQuery.toLowerCase()) ||
      (b.postcode?.toLowerCase() || "").includes(searchQuery.toLowerCase())
  );

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
      {/* Search */}
      <div className="flex gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search businesses..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-sm text-muted-foreground">Total Businesses</p>
          <p className="text-2xl font-bold text-foreground">{businesses.length}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-sm text-muted-foreground">Verified</p>
          <p className="text-2xl font-bold text-green-500">
            {businesses.filter((b) => b.is_verified).length}
          </p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-sm text-muted-foreground">Pending Verification</p>
          <p className="text-2xl font-bold text-amber-500">
            {businesses.filter((b) => !b.is_verified && !b.is_suspended).length}
          </p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-sm text-muted-foreground">Suspended</p>
          <p className="text-2xl font-bold text-destructive">
            {businesses.filter((b) => b.is_suspended).length}
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-secondary" />
          </div>
        ) : filteredBusinesses.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            No businesses found
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-4 font-medium text-muted-foreground">Business</th>
                  <th className="text-left p-4 font-medium text-muted-foreground">Status</th>
                  <th className="text-left p-4 font-medium text-muted-foreground">Risk</th>
                  <th className="text-left p-4 font-medium text-muted-foreground">Leads</th>
                  <th className="text-left p-4 font-medium text-muted-foreground">Joined</th>
                  <th className="text-right p-4 font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredBusinesses.map((business) => (
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

                <div className="flex gap-2 pt-4">
                  {!selectedBusiness.is_verified && (
                    <Button 
                      onClick={() => {
                        verifyBusiness(selectedBusiness);
                        setIsProfileOpen(false);
                      }}
                      className="flex-1"
                    >
                      <Shield className="w-4 h-4 mr-2" />
                      Verify Business
                    </Button>
                  )}
                  <Button
                    variant={selectedBusiness.is_suspended ? "default" : "destructive"}
                    onClick={() => {
                      toggleSuspension(selectedBusiness);
                      setIsProfileOpen(false);
                    }}
                    className="flex-1"
                  >
                    {selectedBusiness.is_suspended ? (
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
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="purchases" className="mt-4">
                {loadingHistory ? (
                  <div className="py-8 text-center">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
                  </div>
                ) : purchaseHistory.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground">
                    No purchases yet
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Lead ID</TableHead>
                        <TableHead>Job Type</TableHead>
                        <TableHead>Postcode</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {purchaseHistory.map((purchase) => (
                        <TableRow key={purchase.id}>
                          <TableCell className="font-mono text-xs">
                            {purchase.id.slice(0, 8)}...
                          </TableCell>
                          <TableCell>{purchase.job_type}</TableCell>
                          <TableCell>{purchase.postcode}</TableCell>
                          <TableCell>£20</TableCell>
                          <TableCell>
                            {purchase.unlocked_at 
                              ? format(new Date(purchase.unlocked_at), "d MMM yyyy HH:mm")
                              : "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}