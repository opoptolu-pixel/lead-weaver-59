import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Sparkles,
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
  created_at: string;
  resolved_at: string | null;
}

interface UnlockedLead {
  id: string;
  job_type: string;
  postcode: string;
}

const DISPUTE_REASONS = [
  { code: "wrong_info", label: "Incorrect contact information" },
  { code: "no_response", label: "Customer not responding" },
  { code: "duplicate", label: "Duplicate lead" },
  { code: "cancelled", label: "Customer cancelled before contact" },
  { code: "outside_area", label: "Outside service area" },
  { code: "other", label: "Other" },
];

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

      // Fetch unlocked leads (for new dispute form)
      const { data: leadsData, error: leadsError } = await supabase
        .from("leads")
        .select("id, job_type, postcode")
        .eq("unlocked_by", user.id)
        .is("refunded_at", null);

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

    setSubmitting(true);
    try {
      const { error } = await supabase.from("disputes").insert({
        user_id: user!.id,
        lead_id: selectedLead,
        reason_code: reasonCode,
        description: description || null,
        status: "open",
      });

      if (error) throw error;

      toast.success("Dispute submitted successfully");
      setShowDialog(false);
      setSelectedLead("");
      setReasonCode("");
      setDescription("");

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
            <Link to="/" className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-secondary/20">
                <Sparkles className="w-5 h-5 text-secondary" />
              </div>
              <span className="font-heading text-xl font-bold text-primary-foreground">
                Deep Clean UK
              </span>
            </Link>
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
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Submit a Dispute</DialogTitle>
                  <DialogDescription>
                    If you believe a lead was invalid, submit a dispute for review.
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
                    <Label>Reason</Label>
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
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowDialog(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleSubmitDispute} disabled={submitting}>
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
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
