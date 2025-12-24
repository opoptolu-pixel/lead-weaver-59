import { useState, useEffect } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, FileText, MessageSquare, CheckCircle, XCircle, Clock, AlertCircle, Download, Loader2, ExternalLink, Eye, CreditCard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useSignedUrl } from "@/hooks/useSignedUrl";
import { useAdmin } from "@/contexts/AdminContext";
import { usePagination } from "@/hooks/usePagination";
import { PaginationControls } from "@/components/admin/PaginationControls";
import { exportToCsv } from "@/lib/exportCsv";
import { format } from "date-fns";

interface Dispute {
  id: string;
  lead_id: string;
  user_id: string;
  reason_code: string;
  description: string | null;
  status: string;
  resolution: string | null;
  evidence_urls: string[] | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
}

interface DisputeWithProfile extends Dispute {
  business_name: string | null;
}

interface LeadDetails {
  id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  customer_address: string;
  job_type: string;
  postcode: string;
  date: string;
  value: number;
}

const reasonCodes: Record<string, string> = {
  wrong_info: "Wrong Contact Info",
  no_response: "No Response",
  duplicate: "Duplicate Lead",
  cancelled: "Customer Cancelled",
  outside_area: "Outside Service Area",
  other: "Other",
};

const getStatusBadge = (status: string) => {
  const config: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode }> = {
    open: { variant: "destructive", icon: <AlertCircle className="h-3 w-3 mr-1" /> },
    under_review: { variant: "outline", icon: <Clock className="h-3 w-3 mr-1" /> },
    resolved: { variant: "default", icon: <CheckCircle className="h-3 w-3 mr-1" /> },
    rejected: { variant: "secondary", icon: <XCircle className="h-3 w-3 mr-1" /> },
  };
  const { variant, icon } = config[status] || { variant: "outline", icon: null };
  return (
    <Badge variant={variant} className="flex items-center w-fit">
      {icon}
      {status.replace("_", " ")}
    </Badge>
  );
};

export default function AdminDisputes() {
  const { getDateFilter, dateRange } = useAdmin();
  const [disputes, setDisputes] = useState<DisputeWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedDispute, setSelectedDispute] = useState<DisputeWithProfile | null>(null);
  const [resolution, setResolution] = useState("");
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [resolving, setResolving] = useState(false);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [loadingUrls, setLoadingUrls] = useState(false);
  
  // Lead details dialog
  const [leadDetails, setLeadDetails] = useState<LeadDetails | null>(null);
  const [isLeadDialogOpen, setIsLeadDialogOpen] = useState(false);
  const [loadingLead, setLoadingLead] = useState(false);
  
  const { getSignedUrl, extractFilePath } = useSignedUrl();

  useEffect(() => {
    fetchDisputes();
  }, [dateRange]);

  const fetchDisputes = async () => {
    setLoading(true);
    const { start, end } = getDateFilter();
    
    try {
      // Fetch disputes
      const { data: disputesData, error: disputesError } = await supabase
        .from("disputes")
        .select("*")
        .gte("created_at", start.toISOString())
        .lte("created_at", end.toISOString())
        .order("created_at", { ascending: false });

      if (disputesError) throw disputesError;

      // Fetch profiles for business names
      const userIds = [...new Set(disputesData?.map(d => d.user_id) || [])];
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("user_id, business_name")
        .in("user_id", userIds);

      const profileMap = new Map(profilesData?.map(p => [p.user_id, p.business_name]) || []);

      const disputesWithProfiles: DisputeWithProfile[] = (disputesData || []).map(d => ({
        ...d,
        business_name: profileMap.get(d.user_id) || "Unknown Business",
      }));

      setDisputes(disputesWithProfiles);
    } catch (error) {
      console.error("Error fetching disputes:", error);
      toast.error("Failed to load disputes");
    } finally {
      setLoading(false);
    }
  };

  // Load signed URLs when a dispute is selected
  useEffect(() => {
    const loadSignedUrls = async () => {
      if (!selectedDispute?.evidence_urls?.length) {
        setSignedUrls({});
        return;
      }

      setLoadingUrls(true);
      const urls: Record<string, string> = {};

      for (const url of selectedDispute.evidence_urls) {
        const filePath = extractFilePath(url);
        const signedUrl = await getSignedUrl(filePath);
        if (signedUrl) {
          urls[url] = signedUrl;
        }
      }

      setSignedUrls(urls);
      setLoadingUrls(false);
    };

    loadSignedUrls();
  }, [selectedDispute, getSignedUrl, extractFilePath]);

  const filteredDisputes = disputes.filter((d) => {
    const matchesSearch =
      (d.business_name?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
      d.lead_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || d.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const pagination = usePagination(filteredDisputes);

  const handleExportCsv = () => {
    exportToCsv(filteredDisputes, "disputes", [
      { key: "id", label: "ID" },
      { key: "business_name", label: "Business" },
      { key: "lead_id", label: "Lead ID" },
      { key: "reason_code", label: "Reason" },
      { key: "status", label: "Status" },
      { key: "description", label: "Description" },
      { key: "resolution", label: "Resolution" },
      { key: "created_at", label: "Opened" },
      { key: "resolved_at", label: "Resolved" },
    ]);
  };

  const handleViewLead = async (leadId: string) => {
    setLoadingLead(true);
    setIsLeadDialogOpen(true);
    
    try {
      const { data, error } = await supabase
        .from("leads")
        .select("id, customer_name, customer_email, customer_phone, customer_address, job_type, postcode, date, value")
        .eq("id", leadId)
        .single();

      if (error) throw error;
      setLeadDetails(data);
    } catch (error) {
      console.error("Error fetching lead:", error);
      toast.error("Failed to load lead details");
      setIsLeadDialogOpen(false);
    } finally {
      setLoadingLead(false);
    }
  };

  const processRefund = async (dispute: DisputeWithProfile) => {
    setResolving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // 1. Add credit back to user's account
      const { data: profile } = await supabase
        .from("profiles")
        .select("credits")
        .eq("user_id", dispute.user_id)
        .single();

      if (profile) {
        await supabase
          .from("profiles")
          .update({ credits: profile.credits + 1 })
          .eq("user_id", dispute.user_id);
      }

      // 2. Mark lead as refunded
      await supabase
        .from("leads")
        .update({ 
          refunded_at: new Date().toISOString(),
          refund_reason: resolutionNotes || "Dispute resolved - refund issued"
        })
        .eq("id", dispute.lead_id);

      // 3. Update dispute status
      await supabase
        .from("disputes")
        .update({
          status: "resolved",
          resolution: "Refund issued - 1 credit returned",
          resolved_at: new Date().toISOString(),
          resolved_by: user?.id,
        })
        .eq("id", dispute.id);

      // 4. Log the refund activity
      await supabase.from("activity_logs").insert({
        user_id: dispute.user_id,
        action: "refund",
        entity_type: "dispute",
        entity_id: dispute.id,
        details: { lead_id: dispute.lead_id, credits_refunded: 1 },
      });

      // 5. Send email notification (optional - will fail silently if not configured)
      try {
        const { data: email } = await supabase.rpc("get_user_email", { 
          user_uuid: dispute.user_id 
        });
        
        if (email) {
          await supabase.functions.invoke("send-email", {
            body: {
              to: email,
              subject: "Your dispute has been resolved - Credit refunded",
              html: `<p>Hi,</p><p>Your dispute for lead ${dispute.lead_id.slice(0, 8)}... has been resolved. 1 credit has been returned to your account.</p><p>Thank you for your patience.</p>`,
            },
          });
        }
      } catch (emailError) {
        console.log("Email notification skipped:", emailError);
      }

      toast.success("Refund processed successfully - 1 credit returned");
      setSelectedDispute(null);
      setResolutionNotes("");
      fetchDisputes();
    } catch (error) {
      console.error("Error processing refund:", error);
      toast.error("Failed to process refund");
    } finally {
      setResolving(false);
    }
  };

  const handleResolve = async () => {
    if (!selectedDispute || !resolution) return;

    setResolving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const updateData: Record<string, unknown> = {
        status: resolution === "rejected" ? "rejected" : "resolved",
        resolution: resolutionNotes || resolution,
        resolved_at: new Date().toISOString(),
        resolved_by: user?.id,
      };

      const { error } = await supabase
        .from("disputes")
        .update(updateData)
        .eq("id", selectedDispute.id);

      if (error) throw error;

      // Send email notification
      try {
        const { data: email } = await supabase.rpc("get_user_email", { 
          user_uuid: selectedDispute.user_id 
        });
        
        if (email) {
          await supabase.functions.invoke("send-email", {
            body: {
              to: email,
              subject: `Your dispute has been ${resolution === "rejected" ? "rejected" : "resolved"}`,
              html: `<p>Hi,</p><p>Your dispute for lead ${selectedDispute.lead_id.slice(0, 8)}... has been ${resolution === "rejected" ? "rejected" : "resolved"}.</p>${resolutionNotes ? `<p>Notes: ${resolutionNotes}</p>` : ""}<p>Thank you.</p>`,
            },
          });
        }
      } catch (emailError) {
        console.log("Email notification skipped:", emailError);
      }

      toast.success(`Dispute ${resolution === "rejected" ? "rejected" : "resolved"} successfully`);
      setSelectedDispute(null);
      setResolution("");
      setResolutionNotes("");
      fetchDisputes();
    } catch (error) {
      console.error("Error resolving dispute:", error);
      toast.error("Failed to resolve dispute");
    } finally {
      setResolving(false);
    }
  };

  const stats = {
    open: disputes.filter((d) => d.status === "open").length,
    under_review: disputes.filter((d) => d.status === "under_review").length,
    resolved: disputes.filter((d) => d.status === "resolved").length,
    rejected: disputes.filter((d) => d.status === "rejected").length,
  };

  const getFileName = (path: string) => {
    const parts = path.split("/");
    return parts[parts.length - 1];
  };

  return (
    <AdminLayout title="Disputes & Refunds">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Disputes & Refunds</h1>
          <p className="text-muted-foreground">Manage dispute workflow and issue refunds</p>
        </div>

        {/* Status Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="cursor-pointer hover:border-primary" onClick={() => setStatusFilter("open")}>
            <CardHeader className="pb-2">
              <CardDescription>Open</CardDescription>
              <CardTitle className="text-2xl text-destructive">{stats.open}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="cursor-pointer hover:border-primary" onClick={() => setStatusFilter("under_review")}>
            <CardHeader className="pb-2">
              <CardDescription>Under Review</CardDescription>
              <CardTitle className="text-2xl">{stats.under_review}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="cursor-pointer hover:border-primary" onClick={() => setStatusFilter("resolved")}>
            <CardHeader className="pb-2">
              <CardDescription>Resolved</CardDescription>
              <CardTitle className="text-2xl text-green-600">{stats.resolved}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="cursor-pointer hover:border-primary" onClick={() => setStatusFilter("rejected")}>
            <CardHeader className="pb-2">
              <CardDescription>Rejected</CardDescription>
              <CardTitle className="text-2xl">{stats.rejected}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by business or lead ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="under_review">Under Review</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={handleExportCsv}>
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>

        {/* Disputes Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Disputes</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredDisputes.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No disputes found</p>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Business</TableHead>
                      <TableHead>Lead ID</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Evidence</TableHead>
                      <TableHead>Opened</TableHead>
                      <TableHead className="w-[150px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagination.paginatedData.map((dispute) => (
                      <TableRow key={dispute.id}>
                        <TableCell className="font-medium">{dispute.business_name}</TableCell>
                        <TableCell>
                          <Button
                            variant="link"
                            className="font-mono text-sm p-0 h-auto"
                            onClick={() => handleViewLead(dispute.lead_id)}
                          >
                            {dispute.lead_id.slice(0, 8)}...
                            <Eye className="w-3 h-3 ml-1" />
                          </Button>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{reasonCodes[dispute.reason_code] || dispute.reason_code}</Badge>
                        </TableCell>
                        <TableCell>{getStatusBadge(dispute.status)}</TableCell>
                        <TableCell>
                          {dispute.evidence_urls && dispute.evidence_urls.length > 0 ? (
                            <Badge variant="secondary" className="flex items-center w-fit">
                              <FileText className="h-3 w-3 mr-1" />
                              {dispute.evidence_urls.length} file(s)
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">None</span>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(dispute.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedDispute(dispute)}
                            >
                              <MessageSquare className="h-4 w-4 mr-1" />
                              Review
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
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

        {/* Review Dialog */}
        <Dialog open={!!selectedDispute} onOpenChange={() => setSelectedDispute(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Review Dispute</DialogTitle>
              <DialogDescription>
                {selectedDispute?.business_name} - {selectedDispute?.lead_id.slice(0, 8)}...
              </DialogDescription>
            </DialogHeader>

            {selectedDispute && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Reason Code</label>
                    <p className="text-muted-foreground">
                      {reasonCodes[selectedDispute.reason_code] || selectedDispute.reason_code}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Current Status</label>
                    <div className="mt-1">{getStatusBadge(selectedDispute.status)}</div>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium">Description</label>
                  <p className="text-muted-foreground mt-1">{selectedDispute.description || "No description provided"}</p>
                </div>

                {/* View Lead Button */}
                <div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleViewLead(selectedDispute.lead_id)}
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    View Disputed Lead Details
                  </Button>
                </div>

                {selectedDispute.evidence_urls && selectedDispute.evidence_urls.length > 0 && (
                  <div>
                    <label className="text-sm font-medium">Evidence Files (Secured with signed URLs)</label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {loadingUrls ? (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Loading secure links...
                        </div>
                      ) : (
                        selectedDispute.evidence_urls.map((url, i) => (
                          <Button
                            key={i}
                            variant="outline"
                            size="sm"
                            asChild
                            disabled={!signedUrls[url]}
                          >
                            <a
                              href={signedUrls[url] || "#"}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1"
                            >
                              <Download className="h-3 w-3" />
                              {getFileName(url)}
                              <ExternalLink className="h-3 w-3 ml-1" />
                            </a>
                          </Button>
                        ))
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Links expire after 1 hour for security
                    </p>
                  </div>
                )}

                {selectedDispute.status !== "resolved" && selectedDispute.status !== "rejected" && (
                  <>
                    <div className="border-t pt-4">
                      <label className="text-sm font-medium">Resolution Notes</label>
                      <Textarea
                        value={resolutionNotes}
                        onChange={(e) => setResolutionNotes(e.target.value)}
                        placeholder="Add notes about the resolution..."
                        className="mt-2"
                      />
                    </div>

                    <div className="border-t pt-4">
                      <label className="text-sm font-medium">Resolution Action</label>
                      <Select value={resolution} onValueChange={setResolution}>
                        <SelectTrigger className="mt-2">
                          <SelectValue placeholder="Select resolution" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="approved">Approve (No Refund)</SelectItem>
                          <SelectItem value="rejected">Reject Dispute</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <DialogFooter className="flex-col sm:flex-row gap-2">
                      <Button
                        variant="default"
                        className="bg-green-600 hover:bg-green-700"
                        onClick={() => processRefund(selectedDispute)}
                        disabled={resolving}
                      >
                        {resolving ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <CreditCard className="h-4 w-4 mr-2" />
                        )}
                        Process Refund (1 Credit)
                      </Button>
                      <Button onClick={handleResolve} disabled={resolving || !resolution}>
                        {resolving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                        {resolution === "rejected" ? "Reject Dispute" : "Resolve Without Refund"}
                      </Button>
                    </DialogFooter>
                  </>
                )}

                {(selectedDispute.status === "resolved" || selectedDispute.status === "rejected") && (
                  <div className="border-t pt-4">
                    <label className="text-sm font-medium">Resolution</label>
                    <p className="text-muted-foreground mt-1">{selectedDispute.resolution || "No notes"}</p>
                    {selectedDispute.resolved_at && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Resolved on {format(new Date(selectedDispute.resolved_at), "d MMM yyyy HH:mm")}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Lead Details Dialog */}
        <Dialog open={isLeadDialogOpen} onOpenChange={setIsLeadDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Lead Details</DialogTitle>
              <DialogDescription>
                Disputed lead information
              </DialogDescription>
            </DialogHeader>
            
            {loadingLead ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : leadDetails ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Customer Name</label>
                    <p className="font-medium">{leadDetails.customer_name}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Job Type</label>
                    <p className="font-medium">{leadDetails.job_type}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Email</label>
                    <p className="font-medium">{leadDetails.customer_email}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Phone</label>
                    <p className="font-medium">{leadDetails.customer_phone}</p>
                  </div>
                  <div className="col-span-2">
                    <label className="text-sm font-medium text-muted-foreground">Address</label>
                    <p className="font-medium">{leadDetails.customer_address}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Postcode</label>
                    <p className="font-medium">{leadDetails.postcode}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Date</label>
                    <p className="font-medium">{leadDetails.date}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Value</label>
                    <p className="font-medium">£{leadDetails.value}</p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-4">Lead not found</p>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
