import { useState } from "react";
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
import { Search, FileText, MessageSquare, CheckCircle, XCircle, Clock, AlertCircle } from "lucide-react";

// Mock data
const mockDisputes = [
  { 
    id: "disp_001", 
    lead_id: "lead_123", 
    business: "CleanPro Services", 
    reason_code: "wrong_contact",
    description: "Phone number was incorrect, customer never answered",
    status: "open", 
    evidence_urls: [],
    created_at: "2024-01-15T10:30:00Z",
    updated_at: "2024-01-15T10:30:00Z"
  },
  { 
    id: "disp_002", 
    lead_id: "lead_124", 
    business: "Sparkle Clean Ltd", 
    reason_code: "duplicate",
    description: "This lead was already purchased by us last week",
    status: "evidence", 
    evidence_urls: ["screenshot1.png"],
    created_at: "2024-01-14T15:20:00Z",
    updated_at: "2024-01-15T09:00:00Z"
  },
  { 
    id: "disp_003", 
    lead_id: "lead_125", 
    business: "Fresh & Tidy", 
    reason_code: "fake_lead",
    description: "Customer confirmed they never requested cleaning services",
    status: "under_review", 
    evidence_urls: ["call_recording.mp3", "email_confirmation.pdf"],
    created_at: "2024-01-13T11:00:00Z",
    updated_at: "2024-01-14T16:30:00Z"
  },
  { 
    id: "disp_004", 
    lead_id: "lead_126", 
    business: "Deep Clean Experts", 
    reason_code: "outside_area",
    description: "Customer address is 50 miles outside our service area",
    status: "resolved", 
    evidence_urls: [],
    resolution: "refunded",
    created_at: "2024-01-12T09:45:00Z",
    updated_at: "2024-01-13T14:00:00Z"
  },
];

const reasonCodes: Record<string, string> = {
  wrong_contact: "Wrong Contact Info",
  duplicate: "Duplicate Lead",
  fake_lead: "Fake/Spam Lead",
  outside_area: "Outside Service Area",
  cancelled: "Customer Cancelled",
  other: "Other",
};

const getStatusBadge = (status: string) => {
  const config: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode }> = {
    open: { variant: "destructive", icon: <AlertCircle className="h-3 w-3 mr-1" /> },
    evidence: { variant: "secondary", icon: <FileText className="h-3 w-3 mr-1" /> },
    under_review: { variant: "outline", icon: <Clock className="h-3 w-3 mr-1" /> },
    resolved: { variant: "default", icon: <CheckCircle className="h-3 w-3 mr-1" /> },
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
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedDispute, setSelectedDispute] = useState<typeof mockDisputes[0] | null>(null);
  const [resolution, setResolution] = useState("");
  const [resolutionNotes, setResolutionNotes] = useState("");

  const filteredDisputes = mockDisputes.filter((d) => {
    const matchesSearch =
      d.business.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.lead_id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || d.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleResolve = () => {
    // In real app, this would update the dispute
    console.log("Resolving dispute:", selectedDispute?.id, resolution, resolutionNotes);
    setSelectedDispute(null);
    setResolution("");
    setResolutionNotes("");
  };

  const stats = {
    open: mockDisputes.filter((d) => d.status === "open").length,
    evidence: mockDisputes.filter((d) => d.status === "evidence").length,
    under_review: mockDisputes.filter((d) => d.status === "under_review").length,
    resolved: mockDisputes.filter((d) => d.status === "resolved").length,
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
          <Card className="cursor-pointer hover:border-primary" onClick={() => setStatusFilter("evidence")}>
            <CardHeader className="pb-2">
              <CardDescription>Awaiting Evidence</CardDescription>
              <CardTitle className="text-2xl">{stats.evidence}</CardTitle>
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
              <SelectItem value="evidence">Awaiting Evidence</SelectItem>
              <SelectItem value="under_review">Under Review</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Disputes Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Disputes</CardTitle>
          </CardHeader>
          <CardContent>
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
                    <TableCell className="font-medium">{dispute.business}</TableCell>
                    <TableCell className="font-mono text-sm">{dispute.lead_id}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{reasonCodes[dispute.reason_code]}</Badge>
                    </TableCell>
                    <TableCell>{getStatusBadge(dispute.status)}</TableCell>
                    <TableCell>
                      {dispute.evidence_urls.length > 0 ? (
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
          </CardContent>
        </Card>

        {/* Review Dialog */}
        <Dialog open={!!selectedDispute} onOpenChange={() => setSelectedDispute(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Review Dispute</DialogTitle>
              <DialogDescription>
                {selectedDispute?.business} - {selectedDispute?.lead_id}
              </DialogDescription>
            </DialogHeader>

            {selectedDispute && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Reason Code</label>
                    <p className="text-muted-foreground">
                      {reasonCodes[selectedDispute.reason_code]}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Current Status</label>
                    <div className="mt-1">{getStatusBadge(selectedDispute.status)}</div>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium">Description</label>
                  <p className="text-muted-foreground mt-1">{selectedDispute.description}</p>
                </div>

                {selectedDispute.evidence_urls.length > 0 && (
                  <div>
                    <label className="text-sm font-medium">Evidence Files</label>
                    <div className="flex gap-2 mt-1">
                      {selectedDispute.evidence_urls.map((url, i) => (
                        <Badge key={i} variant="secondary">
                          <FileText className="h-3 w-3 mr-1" />
                          {url}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <div className="border-t pt-4">
                  <label className="text-sm font-medium">Resolution</label>
                  <Select value={resolution} onValueChange={setResolution}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select resolution..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="refund">Issue Refund (£20)</SelectItem>
                      <SelectItem value="credit">Issue Credit (£20)</SelectItem>
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
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedDispute(null)}>
                Cancel
              </Button>
              <Button onClick={handleResolve} disabled={!resolution}>
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
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
