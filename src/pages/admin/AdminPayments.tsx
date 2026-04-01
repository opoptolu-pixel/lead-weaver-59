import { useState, useEffect } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CreditCard, MoreHorizontal, Search, AlertTriangle, Eye, Ban, RefreshCw, ShieldCheck, Loader2, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAdmin } from "@/contexts/AdminContext";
import { format } from "date-fns";
import { usePagination } from "@/hooks/usePagination";
import { PaginationControls } from "@/components/admin/PaginationControls";
import { exportToCsv } from "@/lib/exportCsv";
import { toast } from "sonner";

interface Purchase {
  id: string;
  business_name: string | null;
  lead_id: string;
  amount: number;
  status: string;
  unlocked_at: string;
  job_type: string;
  postcode: string;
  credit_type?: string;
}

interface FraudFlag {
  id: string;
  flag_type: string;
  description: string | null;
  user_id: string | null;
  business_name: string | null;
  status: string;
  created_at: string;
}

const getStatusBadge = (status: string) => {
  const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    purchased: "default",
    refunded: "secondary",
    expired: "outline",
  };
  return <Badge variant={variants[status] || "outline"}>{status}</Badge>;
};

const getFraudStatusBadge = (status: string) => {
  if (status === "pending") return <Badge variant="destructive">Pending Review</Badge>;
  if (status === "reviewed") return <Badge variant="secondary">Reviewed</Badge>;
  if (status === "cleared") return <Badge variant="default">Cleared</Badge>;
  return <Badge variant="outline">{status}</Badge>;
};

export default function AdminPayments() {
  const { getDateFilter, dateRange } = useAdmin();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("purchases");
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [fraudFlags, setFraudFlags] = useState<FraudFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingReceipt, setDownloadingReceipt] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [dateRange, getDateFilter]);

  // Real-time subscription for live updates
  useEffect(() => {
    const channel = supabase
      .channel('admin-payments-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'leads' },
        (payload) => {
          console.log('Leads updated - refreshing payments');
          fetchData();
          toast.info('Payment data updated', { 
            description: payload.eventType === 'INSERT' ? 'New purchase detected' : 'Purchase data changed',
            duration: 3000 
          });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'fraud_flags' },
        (payload) => {
          console.log('Fraud flags updated - refreshing');
          fetchData();
          toast.info('Fraud queue updated', { 
            description: payload.eventType === 'INSERT' ? 'New fraud flag detected' : 'Fraud flag status changed',
            duration: 3000 
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [dateRange]);

  const fetchData = async () => {
    setLoading(true);
    const { start, end } = getDateFilter();
    const startISO = start.toISOString();
    const endISO = end.toISOString();

    try {
      // Fetch purchased leads (these are actual purchases)
      const { data: leadsData, error: leadsError } = await supabase
        .from("leads")
        .select("id, unlocked_by, unlocked_at, job_type, postcode, value, lead_status, refunded_at, credit_type, amount_paid")
        .eq("is_unlocked", true)
        .gte("unlocked_at", startISO)
        .lte("unlocked_at", endISO)
        .order("unlocked_at", { ascending: false });

      if (leadsError) throw leadsError;

      // Get unique user IDs and fetch their profiles
      const userIds = [...new Set((leadsData || []).map(l => l.unlocked_by).filter(Boolean))];
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("user_id, business_name")
        .in("user_id", userIds);

      const profileMap = new Map(profilesData?.map(p => [p.user_id, p.business_name]) || []);

      const purchasesData: Purchase[] = (leadsData || []).map(lead => ({
        id: lead.id,
        business_name: profileMap.get(lead.unlocked_by) || "Unknown Business",
        lead_id: lead.id,
        amount: (lead as any).amount_paid || 20,
        status: lead.refunded_at ? "refunded" : "purchased",
        unlocked_at: lead.unlocked_at || "",
        job_type: lead.job_type,
        postcode: lead.postcode,
        credit_type: (lead as any).credit_type || "purchased",
      }));

      setPurchases(purchasesData);

      // Fetch fraud flags
      const { data: fraudData, error: fraudError } = await supabase
        .from("fraud_flags")
        .select("*")
        .gte("created_at", startISO)
        .lte("created_at", endISO)
        .order("created_at", { ascending: false });

      if (fraudError) throw fraudError;

      // Get profiles for fraud flags
      const fraudUserIds = [...new Set((fraudData || []).map(f => f.user_id).filter(Boolean))];
      const { data: fraudProfilesData } = await supabase
        .from("profiles")
        .select("user_id, business_name")
        .in("user_id", fraudUserIds);

      const fraudProfileMap = new Map(fraudProfilesData?.map(p => [p.user_id, p.business_name]) || []);

      const fraudFlagsData: FraudFlag[] = (fraudData || []).map(flag => ({
        ...flag,
        business_name: flag.user_id ? fraudProfileMap.get(flag.user_id) || "Unknown User" : "Unknown User",
      }));

      setFraudFlags(fraudFlagsData);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load payment data");
    } finally {
      setLoading(false);
    }
  };

  const filteredPurchases = purchases.filter(
    (p) =>
      (p.business_name?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
      p.lead_id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredFraud = fraudFlags.filter(
    (f) =>
      (f.business_name?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
      (f.description?.toLowerCase() || "").includes(searchTerm.toLowerCase())
  );

  const purchasesPagination = usePagination(filteredPurchases);
  const fraudPagination = usePagination(filteredFraud);

  const handleExportPurchases = () => {
    exportToCsv(filteredPurchases, "purchases", [
      { key: "business_name", label: "Business" },
      { key: "lead_id", label: "Lead ID" },
      { key: "amount", label: "Amount (£)" },
      { key: "status", label: "Status" },
      { key: "job_type", label: "Job Type" },
      { key: "postcode", label: "Postcode" },
      { key: "unlocked_at", label: "Date" },
    ]);
  };

  const handleExportFraud = () => {
    exportToCsv(filteredFraud, "fraud_flags", [
      { key: "business_name", label: "Business" },
      { key: "flag_type", label: "Type" },
      { key: "description", label: "Description" },
      { key: "status", label: "Status" },
      { key: "created_at", label: "Date" },
    ]);
  };

  const handleDownloadReceipt = async (leadId: string) => {
    setDownloadingReceipt(leadId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("You must be logged in to download receipts");
        return;
      }

      const response = await supabase.functions.invoke("get-receipt", {
        body: { leadId },
      });

      if (response.error) {
        throw new Error(response.error.message || "Failed to get receipt");
      }

      const { receipt } = response.data;

      if (receipt.type === "stripe" && receipt.receiptUrl) {
        window.open(receipt.receiptUrl, "_blank");
      } else if (receipt.type === "pdf" && receipt.pdfData) {
        const link = document.createElement("a");
        link.href = receipt.pdfData;
        link.download = `cleanda-receipt-${receipt.receiptId}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success("Receipt downloaded successfully");
      } else {
        toast.error("No receipt available for this purchase");
      }
    } catch (error) {
      console.error("Error downloading receipt:", error);
      toast.error(error instanceof Error ? error.message : "Failed to download receipt");
    } finally {
      setDownloadingReceipt(null);
    }
  };

  const pendingFraudCount = fraudFlags.filter((f) => f.status === "pending").length;

  // Calculate totals - only count paid credits as revenue (exclude granted)
  const totalRevenue = filteredPurchases.filter(p => p.status === "purchased" && p.credit_type !== "granted").reduce((sum, p) => sum + p.amount, 0);
  const refundedAmount = filteredPurchases.filter(p => p.status === "refunded").reduce((sum, p) => sum + p.amount, 0);

  return (
    <AdminLayout title="Payments & Purchases">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Payments & Purchases</h1>
          <p className="text-muted-foreground">Manage transactions and fraud detection</p>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Purchases</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{filteredPurchases.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">£{totalRevenue.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Refunded</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">£{refundedAmount.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Fraud Flags</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{pendingFraudCount}</div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="purchases" className="flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                Purchases
              </TabsTrigger>
              <TabsTrigger value="fraud" className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Fraud Queue
                {pendingFraudCount > 0 && (
                  <Badge variant="destructive" className="ml-1">
                    {pendingFraudCount}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <div className="flex items-center gap-2">
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={activeTab === "purchases" ? handleExportPurchases : handleExportFraud}
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </div>

          <TabsContent value="purchases" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>All Purchases</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredPurchases.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No purchases found</p>
                ) : (
                  <>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Business</TableHead>
                          <TableHead>Lead ID</TableHead>
                          <TableHead>Job Type</TableHead>
                          <TableHead>Postcode</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {purchasesPagination.paginatedData.map((purchase) => (
                          <TableRow key={purchase.id}>
                            <TableCell className="font-medium">{purchase.business_name}</TableCell>
                            <TableCell className="font-mono text-sm">{purchase.lead_id.slice(0, 8)}...</TableCell>
                            <TableCell>{purchase.job_type}</TableCell>
                            <TableCell>{purchase.postcode}</TableCell>
                            <TableCell>£{purchase.amount}</TableCell>
                            <TableCell>
                              <Badge 
                                variant="outline" 
                                className={purchase.credit_type === "granted" 
                                  ? "border-teal-500/50 text-teal-600 bg-teal-500/10" 
                                  : "border-primary/50 text-primary bg-primary/10"
                                }
                              >
                                {purchase.credit_type === "granted" ? "Granted" : "Paid"}
                              </Badge>
                            </TableCell>
                            <TableCell>{getStatusBadge(purchase.status)}</TableCell>
                            <TableCell className="text-muted-foreground">
                              {purchase.unlocked_at ? format(new Date(purchase.unlocked_at), "d MMM yyyy") : "-"}
                            </TableCell>
                            <TableCell>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => handleDownloadReceipt(purchase.lead_id)}>
                                    {downloadingReceipt === purchase.lead_id ? (
                                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                      <Download className="mr-2 h-4 w-4" />
                                    )}
                                    Download Receipt
                                  </DropdownMenuItem>
                                  <DropdownMenuItem>
                                    <Eye className="mr-2 h-4 w-4" />
                                    View Details
                                  </DropdownMenuItem>
                                  <DropdownMenuItem>
                                    <RefreshCw className="mr-2 h-4 w-4" />
                                    Issue Refund
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <PaginationControls
                      currentPage={purchasesPagination.currentPage}
                      totalPages={purchasesPagination.totalPages}
                      totalItems={purchasesPagination.totalItems}
                      pageSize={purchasesPagination.pageSize}
                      onPageChange={purchasesPagination.goToPage}
                      onPageSizeChange={purchasesPagination.changePageSize}
                      hasNextPage={purchasesPagination.hasNextPage}
                      hasPrevPage={purchasesPagination.hasPrevPage}
                    />
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="fraud" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Fraud Flags</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredFraud.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No fraud flags found</p>
                ) : (
                  <>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Type</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead>User</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {fraudPagination.paginatedData.map((flag) => (
                          <TableRow key={flag.id}>
                            <TableCell>
                              <Badge variant="outline" className="capitalize">
                                {flag.flag_type.replace("_", " ")}
                              </Badge>
                            </TableCell>
                            <TableCell>{flag.description || "-"}</TableCell>
                            <TableCell className="font-medium">{flag.business_name}</TableCell>
                            <TableCell>{getFraudStatusBadge(flag.status)}</TableCell>
                            <TableCell className="text-muted-foreground">
                              {format(new Date(flag.created_at), "d MMM yyyy")}
                            </TableCell>
                            <TableCell>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem>
                                    <ShieldCheck className="mr-2 h-4 w-4" />
                                    Clear Flag
                                  </DropdownMenuItem>
                                  <DropdownMenuItem>
                                    <Ban className="mr-2 h-4 w-4" />
                                    Suspend User
                                  </DropdownMenuItem>
                                  <DropdownMenuItem>
                                    <RefreshCw className="mr-2 h-4 w-4" />
                                    Request Verification
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <PaginationControls
                      currentPage={fraudPagination.currentPage}
                      totalPages={fraudPagination.totalPages}
                      totalItems={fraudPagination.totalItems}
                      pageSize={fraudPagination.pageSize}
                      onPageChange={fraudPagination.goToPage}
                      onPageSizeChange={fraudPagination.changePageSize}
                      hasNextPage={fraudPagination.hasNextPage}
                      hasPrevPage={fraudPagination.hasPrevPage}
                    />
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
