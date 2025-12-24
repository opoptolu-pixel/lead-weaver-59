import { useState, useEffect } from "react";
import {
  Search,
  Loader2,
  AlertTriangle,
  Shield,
  Ban,
  RefreshCcw,
  CheckCircle,
  XCircle,
  Download,
} from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { useAdmin } from "@/contexts/AdminContext";
import { usePagination } from "@/hooks/usePagination";
import { PaginationControls } from "@/components/admin/PaginationControls";
import { exportToCsv } from "@/lib/exportCsv";

interface FraudFlag {
  id: string;
  user_id: string | null;
  lead_id: string | null;
  flag_type: string;
  description: string | null;
  status: string;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
}

interface RiskyBusiness {
  id: string;
  user_id: string;
  business_name: string | null;
  contact_name: string | null;
  risk_score: number;
  leads_purchased: number;
  is_suspended: boolean;
  refund_count: number;
  dispute_count: number;
}

export default function AdminFraud() {
  const { getDateFilter, dateRange } = useAdmin();
  const [flags, setFlags] = useState<FraudFlag[]>([]);
  const [riskyBusinesses, setRiskyBusinesses] = useState<RiskyBusiness[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [actionDialog, setActionDialog] = useState<{ type: string; business: RiskyBusiness } | null>(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchData();
  }, [dateRange]);

  const fetchData = async () => {
    setLoading(true);
    const { start, end } = getDateFilter();
    
    // Fetch fraud flags within date range
    const { data: flagsData, error: flagsError } = await supabase
      .from("fraud_flags")
      .select("*")
      .gte("created_at", start.toISOString())
      .lte("created_at", end.toISOString())
      .order("created_at", { ascending: false });

    if (!flagsError) setFlags(flagsData || []);

    // Fetch businesses with risk scores (within date range)
    const { data: profilesData, error: profilesError } = await supabase
      .from("profiles")
      .select("id, user_id, business_name, contact_name, risk_score, leads_purchased, is_suspended")
      .gte("created_at", start.toISOString())
      .lte("created_at", end.toISOString())
      .order("risk_score", { ascending: false });

    if (!profilesError && profilesData) {
      // Get refund and dispute counts
      const businessesWithCounts = await Promise.all(
        profilesData.map(async (profile) => {
          const { count: refundCount } = await supabase
            .from("leads")
            .select("*", { count: "exact", head: true })
            .eq("unlocked_by", profile.user_id)
            .not("refunded_at", "is", null);

          const { count: disputeCount } = await supabase
            .from("disputes")
            .select("*", { count: "exact", head: true })
            .eq("user_id", profile.user_id);

          return {
            ...profile,
            refund_count: refundCount || 0,
            dispute_count: disputeCount || 0,
          };
        })
      );
      setRiskyBusinesses(businessesWithCounts);
    }

    setLoading(false);
  };

  const handleAction = async (action: string, business: RiskyBusiness) => {
    setProcessing(true);
    try {
      let updateData: any = {};
      
      switch (action) {
        case "freeze":
          updateData = { is_suspended: true, suspension_reason: "Frozen due to high risk score" };
          break;
        case "unfreeze":
          updateData = { is_suspended: false, suspension_reason: null };
          break;
        case "require_verification":
          updateData = { is_verified: false, verification_status: "required" };
          break;
        case "block_purchases":
          updateData = { is_suspended: true, suspension_reason: "Blocked from purchasing" };
          break;
      }

      const { error } = await supabase
        .from("profiles")
        .update(updateData)
        .eq("id", business.id);

      if (error) throw error;

      toast.success(`Action "${action}" completed successfully`);
      fetchData();
    } catch (error) {
      console.error("Error:", error);
      toast.error("Failed to perform action");
    } finally {
      setProcessing(false);
      setActionDialog(null);
    }
  };

  const resolveFlag = async (flagId: string, status: "resolved" | "dismissed") => {
    const { error } = await supabase
      .from("fraud_flags")
      .update({
        status,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", flagId);

    if (error) {
      toast.error("Failed to update flag");
    } else {
      toast.success(`Flag ${status}`);
      fetchData();
    }
  };

  const getRiskLevel = (score: number) => {
    if (score >= 70) return { label: "High", color: "destructive" };
    if (score >= 40) return { label: "Medium", color: "warning" };
    return { label: "Low", color: "default" };
  };

  const pendingFlags = flags.filter((f) => f.status === "pending");
  const highRiskBusinesses = riskyBusinesses.filter((b) => (b.risk_score || 0) >= 70);

  const filteredBusinesses = riskyBusinesses.filter(
    (b) =>
      (b.business_name?.toLowerCase() || "").includes(searchQuery.toLowerCase()) ||
      (b.contact_name?.toLowerCase() || "").includes(searchQuery.toLowerCase())
  );

  const pagination = usePagination(filteredBusinesses);

  const handleExportFlags = () => {
    exportToCsv(flags, "fraud_flags", [
      { key: "flag_type", label: "Type" },
      { key: "description", label: "Description" },
      { key: "status", label: "Status" },
      { key: "created_at", label: "Date" },
    ]);
    toast.success("Export started");
  };

  const handleExportBusinesses = () => {
    exportToCsv(filteredBusinesses, "risky_businesses", [
      { key: "business_name", label: "Business Name" },
      { key: "contact_name", label: "Contact Name" },
      { key: "risk_score", label: "Risk Score" },
      { key: "leads_purchased", label: "Leads Purchased" },
      { key: "refund_count", label: "Refunds" },
      { key: "dispute_count", label: "Disputes" },
      { key: "is_suspended", label: "Suspended" },
    ]);
    toast.success("Export started");
  };

  return (
    <AdminLayout title="Fraud & Risk">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Fraud & Risk Monitoring</h1>
            <p className="text-muted-foreground">Detect and prevent fraudulent activity</p>
          </div>
          <Button variant="outline" onClick={fetchData} disabled={loading}>
            <RefreshCcw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Pending Flags</CardDescription>
              <CardTitle className="text-2xl text-amber-500">{pendingFlags.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>High Risk Businesses</CardDescription>
              <CardTitle className="text-2xl text-destructive">{highRiskBusinesses.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Suspended Accounts</CardDescription>
              <CardTitle className="text-2xl">{riskyBusinesses.filter((b) => b.is_suspended).length}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Flags (Period)</CardDescription>
              <CardTitle className="text-2xl">{flags.length}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Pending Fraud Flags */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                  Pending Fraud Flags
                </CardTitle>
                <CardDescription>Review and resolve flagged activity</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={handleExportFlags}>
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-8 text-center">
                <Loader2 className="w-6 h-6 animate-spin mx-auto" />
              </div>
            ) : pendingFlags.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No pending flags</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingFlags.slice(0, 10).map((flag) => (
                    <TableRow key={flag.id}>
                      <TableCell>
                        <Badge variant="destructive">{flag.flag_type}</Badge>
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {flag.description || "-"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(flag.created_at), "d MMM yyyy")}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => resolveFlag(flag.id, "resolved")}
                          >
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Resolve
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => resolveFlag(flag.id, "dismissed")}
                          >
                            <XCircle className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Risky Businesses */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  Business Risk Overview
                </CardTitle>
                <CardDescription>Monitor and take action on high-risk accounts</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={handleExportBusinesses}>
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search businesses..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  pagination.resetPage();
                }}
                className="pl-9 max-w-md"
              />
            </div>

            {loading ? (
              <div className="py-8 text-center">
                <Loader2 className="w-6 h-6 animate-spin mx-auto" />
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Business</TableHead>
                      <TableHead>Risk Score</TableHead>
                      <TableHead>Leads</TableHead>
                      <TableHead>Refunds</TableHead>
                      <TableHead>Disputes</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagination.paginatedData.map((business) => {
                      const risk = getRiskLevel(business.risk_score || 0);
                      const refundRate = business.leads_purchased > 0 
                        ? ((business.refund_count / business.leads_purchased) * 100).toFixed(1)
                        : 0;
                      
                      return (
                        <TableRow key={business.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">
                                {business.business_name || business.contact_name || "Unnamed"}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Progress value={business.risk_score || 0} className="w-16 h-2" />
                              <Badge variant={risk.color as any}>{risk.label}</Badge>
                            </div>
                          </TableCell>
                          <TableCell>{business.leads_purchased}</TableCell>
                          <TableCell>
                            <span className={Number(refundRate) > 10 ? "text-destructive font-medium" : ""}>
                              {business.refund_count} ({refundRate}%)
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className={business.dispute_count > 2 ? "text-destructive font-medium" : ""}>
                              {business.dispute_count}
                            </span>
                          </TableCell>
                          <TableCell>
                            {business.is_suspended ? (
                              <Badge variant="destructive">Suspended</Badge>
                            ) : (
                              <Badge variant="secondary">Active</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              {!business.is_suspended ? (
                                <>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setActionDialog({ type: "freeze", business })}
                                  >
                                    <Ban className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setActionDialog({ type: "require_verification", business })}
                                  >
                                    <Shield className="w-4 h-4" />
                                  </Button>
                                </>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleAction("unfreeze", business)}
                                >
                                  Unfreeze
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
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
          </CardContent>
        </Card>

        {/* Action Confirmation Dialog */}
        <Dialog open={!!actionDialog} onOpenChange={() => setActionDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm Action</DialogTitle>
              <DialogDescription>
                Are you sure you want to {actionDialog?.type.replace("_", " ")} {actionDialog?.business.business_name || "this business"}?
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setActionDialog(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => actionDialog && handleAction(actionDialog.type, actionDialog.business)}
                disabled={processing}
              >
                {processing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Confirm
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
