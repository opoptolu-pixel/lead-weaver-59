import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Loader2,
  AlertTriangle,
  Upload,
  MessageSquare,
  Clock,
  CheckCircle,
  XCircle,
  ArrowLeft,
  Plus,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

interface Dispute {
  id: string;
  lead_id: string;
  reason_code: string;
  description: string | null;
  status: string;
  resolution: string | null;
  evidence_urls: string[] | null;
  created_at: string;
  resolved_at: string | null;
}

interface UnlockedLead {
  id: string;
  job_type: string;
  postcode: string;
  unlocked_at: string | null;
}

const DISPUTE_REASONS = [
  { 
    code: "wrong_contact", 
    label: "Invalid contact details", 
    description: "Phone number disconnected, email bounces, or address doesn't exist",
    requiresEvidence: true 
  },
  { 
    code: "duplicate_lead", 
    label: "Duplicate lead", 
    description: "You've already purchased this exact lead before",
    requiresEvidence: true 
  },
  { 
    code: "fake_spam", 
    label: "Fake or spam lead", 
    description: "Lead appears to be fake, spam, or submitted maliciously",
    requiresEvidence: true 
  },
];

// Time window for submitting disputes (in hours)
const DISPUTE_WINDOW_HOURS = 72;

export default function Disputes() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [leads, setLeads] = useState<UnlockedLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showDialog, setShowDialog] = useState(false);

  // Form state
  const [selectedLead, setSelectedLead] = useState<string>("");
  const [reasonCode, setReasonCode] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [uploadingEvidence, setUploadingEvidence] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;

      // Fetch disputes
      const { data: disputesData, error: disputesError } = await supabase
        .from("disputes")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (!disputesError) setDisputes(disputesData || []);

      // Fetch unlocked leads (for new dispute form) - only leads within dispute window
      const cutoffDate = new Date();
      cutoffDate.setHours(cutoffDate.getHours() - DISPUTE_WINDOW_HOURS);
      
      const { data: leadsData, error: leadsError } = await supabase
        .from("leads")
        .select("id, job_type, postcode, unlocked_at")
        .eq("unlocked_by", user.id)
        .is("refunded_at", null)
        .gte("unlocked_at", cutoffDate.toISOString());

      if (!leadsError) setLeads(leadsData || []);

      setLoading(false);
    };

    if (user) {
      fetchData();
    }
  }, [user]);

  const handleSubmitDispute = async () => {
    if (!selectedLead || !reasonCode) {
      toast.error("Please select a lead and reason");
      return;
    }

    // Evidence is mandatory for all dispute types
    if (!evidenceFile) {
      toast.error("Evidence is required. Please upload a screenshot or document.");
      return;
    }

    setSubmitting(true);
    try {
      let evidenceUrls: string[] = [];

      // Upload evidence file if provided
      if (evidenceFile) {
        setUploadingEvidence(true);
        const fileExt = evidenceFile.name.split(".").pop();
        const filePath = `${user!.id}/dispute-${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("verification-documents")
          .upload(filePath, evidenceFile);

        if (uploadError) {
          console.error("Upload error:", uploadError);
          // Continue without the file
        } else {
          // Store only the file path, not the public URL
          // Signed URLs will be generated when viewing
          evidenceUrls = [filePath];
        }
        setUploadingEvidence(false);
      }

      const { error } = await supabase.from("disputes").insert({
        user_id: user!.id,
        lead_id: selectedLead,
        reason_code: reasonCode,
        description: description || null,
        evidence_urls: evidenceUrls.length > 0 ? evidenceUrls : null,
        status: "open",
      });

      if (error) throw error;

      toast.success("Dispute submitted successfully");
      setShowDialog(false);
      setSelectedLead("");
      setReasonCode("");
      setDescription("");
      setEvidenceFile(null);

      // Refresh disputes
      const { data } = await supabase
        .from("disputes")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });

      setDisputes(data || []);
    } catch (error: any) {
      console.error("Error:", error);
      toast.error(error.message || "Failed to submit dispute");
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "open":
        return <Badge className="bg-amber-500/20 text-amber-500"><Clock className="w-3 h-3 mr-1" />Open</Badge>;
      case "resolved":
        return <Badge className="bg-green-500/20 text-green-500"><CheckCircle className="w-3 h-3 mr-1" />Resolved</Badge>;
      case "rejected":
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-secondary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-primary border-b border-border sticky top-0 z-50">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-20">
            <Logo size="md" variant="white" linkTo={null} />
            <Link to="/dashboard">
              <Button variant="outlineHero" size="sm" className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                Back to Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="font-heading text-3xl font-bold text-foreground mb-2">
                Dispute Centre
              </h1>
              <p className="text-muted-foreground">
                Submit and track disputes for your leads
              </p>
            </div>
            <Dialog open={showDialog} onOpenChange={setShowDialog}>
              <DialogTrigger asChild>
                <Button variant="cta" className="gap-2">
                  <Plus className="w-4 h-4" />
                  New Dispute
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Submit a Dispute</DialogTitle>
                  <DialogDescription>
                    Disputes must be submitted within 72 hours of unlocking a lead. Evidence is required for all disputes.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Select Lead</Label>
                    <Select value={selectedLead} onValueChange={setSelectedLead}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a lead" />
                      </SelectTrigger>
                      <SelectContent>
                        {leads.map((lead) => (
                          <SelectItem key={lead.id} value={lead.id}>
                            {lead.job_type} - {lead.postcode}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Reason for Dispute</Label>
                    <Select value={reasonCode} onValueChange={setReasonCode}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a reason" />
                      </SelectTrigger>
                      <SelectContent>
                        {DISPUTE_REASONS.map((reason) => (
                          <SelectItem key={reason.code} value={reason.code}>
                            {reason.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {reasonCode && (
                      <p className="text-xs text-muted-foreground">
                        {DISPUTE_REASONS.find(r => r.code === reasonCode)?.description}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Additional Details (optional)</Label>
                    <Textarea
                      placeholder="Provide any additional information to support your dispute..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={4}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-1">
                      Upload Evidence
                      <span className="text-destructive">*</span>
                    </Label>
                    <div className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors ${evidenceFile ? 'border-secondary bg-secondary/5' : 'border-border'}`}>
                      <Upload className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
                      <input
                        type="file"
                        id="evidence-file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        className="hidden"
                        onChange={(e) => setEvidenceFile(e.target.files?.[0] || null)}
                      />
                      <label htmlFor="evidence-file" className="cursor-pointer">
                        <span className="text-sm text-secondary hover:underline">
                          {evidenceFile ? evidenceFile.name : "Click to upload screenshot or document"}
                        </span>
                      </label>
                      <p className="text-xs text-muted-foreground mt-1">
                        {reasonCode === 'wrong_contact' && "Upload screenshot of failed call, bounced email, or returned mail"}
                        {reasonCode === 'duplicate_lead' && "Upload screenshot showing the duplicate lead from your account"}
                        {reasonCode === 'fake_spam' && "Upload any evidence showing the lead is fake or spam"}
                        {!reasonCode && "PDF, JPG or PNG up to 10MB"}
                      </p>
                    </div>
                  </div>

                  {/* Info box about dispute policy */}
                  <div className="bg-muted/50 border border-border rounded-lg p-3 text-xs text-muted-foreground">
                    <p className="font-medium text-foreground mb-1">Dispute Policy</p>
                    <ul className="space-y-1 list-disc list-inside">
                      <li>Disputes must be filed within 72 hours of purchase</li>
                      <li>All disputes require supporting evidence</li>
                      <li>False or fraudulent disputes may result in account suspension</li>
                    </ul>
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowDialog(false)}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleSubmitDispute} 
                    disabled={submitting || uploadingEvidence || !evidenceFile || !reasonCode || !selectedLead}
                  >
                    {(submitting || uploadingEvidence) ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Submit Dispute
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-secondary" />
            </div>
          ) : (
            <>
              {/* Stats */}
              <div className="grid grid-cols-3 gap-4 mb-8">
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Open</CardDescription>
                    <CardTitle className="text-2xl text-amber-500">
                      {disputes.filter((d) => d.status === "open").length}
                    </CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Resolved</CardDescription>
                    <CardTitle className="text-2xl text-green-500">
                      {disputes.filter((d) => d.status === "resolved").length}
                    </CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Rejected</CardDescription>
                    <CardTitle className="text-2xl text-destructive">
                      {disputes.filter((d) => d.status === "rejected").length}
                    </CardTitle>
                  </CardHeader>
                </Card>
              </div>

              {/* Disputes List */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-secondary" />
                    Your Disputes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {disputes.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      No disputes submitted yet
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Lead ID</TableHead>
                          <TableHead>Reason</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Submitted</TableHead>
                          <TableHead>Resolution</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {disputes.map((dispute) => (
                          <TableRow key={dispute.id}>
                            <TableCell className="font-mono text-xs">
                              {dispute.lead_id.slice(0, 8)}...
                            </TableCell>
                            <TableCell>
                              {DISPUTE_REASONS.find((r) => r.code === dispute.reason_code)?.label || dispute.reason_code}
                            </TableCell>
                            <TableCell>{getStatusBadge(dispute.status)}</TableCell>
                            <TableCell className="text-muted-foreground">
                              {format(new Date(dispute.created_at), "d MMM yyyy")}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                              {dispute.resolution || "-"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
