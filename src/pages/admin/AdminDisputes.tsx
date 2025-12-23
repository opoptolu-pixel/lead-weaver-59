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
import { Search, FileText, MessageSquare, CheckCircle, XCircle, Clock, AlertCircle, Download, Loader2, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useSignedUrl } from "@/hooks/useSignedUrl";
import { useAdmin } from "@/contexts/AdminContext";

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
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Business</TableHead>
                    <TableHead>Lead ID</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Evidence</TableHead>
                    <TableHead>Opened</TableHead>
                    <TableHead className="w-[100px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDisputes.map((dispute) => (
                    <TableRow key={dispute.id}>
                      <TableCell className="font-medium">{dispute.business_name}</TableCell>
                      <TableCell className="font-mono text-sm">{dispute.lead_id.slice(0, 8)}...</TableCell>
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
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedDispute(dispute)}
                        >
                          <MessageSquare className="h-4 w-4 mr-1" />
                          Review
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
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
                      <label className="text-sm font-medium">Resolution</label>
                      <Select value={resolution} onValueChange={setResolution}>
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select resolution..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="refund">Issue Refund</SelectItem>
                          <SelectItem value="credit">Issue Credit</SelectItem>
                          <SelectItem value="partial_refund">Partial Refund</SelectItem>
                          <SelectItem value="rejected">Reject Dispute</SelectItem>
                          <SelectItem value="need_more_info">Request More Info</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="text-sm font-medium">Resolution Notes</label>
                      <Textarea
                        placeholder="Add notes about this resolution..."
                        value={resolutionNotes}
                        onChange={(e) => setResolutionNotes(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                  </>
                )}

                {selectedDispute.resolution && (
                  <div className="border-t pt-4">
                    <label className="text-sm font-medium">Resolution Notes</label>
                    <p className="text-muted-foreground mt-1">{selectedDispute.resolution}</p>
                  </div>
                )}
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedDispute(null)}>
                Cancel
              </Button>
              {selectedDispute?.status !== "resolved" && selectedDispute?.status !== "rejected" && (
                <Button onClick={handleResolve} disabled={!resolution || resolving}>
                  {resolving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                  {resolution === "rejected" ? (
                    <>
                      <XCircle className="h-4 w-4 mr-1" />
                      Reject Dispute
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Resolve Dispute
                    </>
                  )}
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
