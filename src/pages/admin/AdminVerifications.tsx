import { useState, useEffect } from "react";
import { Check, X, Eye, FileText, Clock, Loader2 } from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

interface VerificationDoc {
  id: string;
  user_id: string;
  document_type: string;
  file_path: string;
  status: string;
  admin_notes: string | null;
  created_at: string;
  profile?: {
    business_name: string | null;
    contact_name: string | null;
    phone: string | null;
  };
}

export default function AdminVerifications() {
  const [documents, setDocuments] = useState<VerificationDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDoc, setSelectedDoc] = useState<VerificationDoc | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    const { data, error } = await supabase
      .from("verification_documents")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching documents:", error);
      toast.error("Failed to load verification documents");
    } else {
      // Fetch profile info for each document
      const docsWithProfiles = await Promise.all(
        (data || []).map(async (doc) => {
          const { data: profile } = await supabase
            .from("profiles")
            .select("business_name, contact_name, phone")
            .eq("user_id", doc.user_id)
            .maybeSingle();
          return { ...doc, profile };
        })
      );
      setDocuments(docsWithProfiles);
    }
    setLoading(false);
  };

  const handleApprove = async (doc: VerificationDoc) => {
    setProcessing(true);
    try {
      // Update document status
      const { error: docError } = await supabase
        .from("verification_documents")
        .update({
          status: "approved",
          admin_notes: adminNotes || null,
        })
        .eq("id", doc.id);

      if (docError) throw docError;

      // If address proof, mark address as verified
      if (doc.document_type === "address_proof") {
        await supabase
          .from("profiles")
          .update({ address_verified: true })
          .eq("user_id", doc.user_id);
      }

      // Check if user should be fully verified
      const { data: profile } = await supabase
        .from("profiles")
        .select("phone_verified, address_verified")
        .eq("user_id", doc.user_id)
        .single();

      const { data: approvedDocs } = await supabase
        .from("verification_documents")
        .select("id")
        .eq("user_id", doc.user_id)
        .eq("status", "approved");

      if (
        profile?.phone_verified &&
        profile?.address_verified &&
        (approvedDocs?.length || 0) > 0
      ) {
        await supabase
          .from("profiles")
          .update({
            is_verified: true,
            verification_status: "approved",
          })
          .eq("user_id", doc.user_id);
      }

      toast.success("Document approved");
      setSelectedDoc(null);
      setAdminNotes("");
      fetchDocuments();
    } catch (error) {
      console.error("Error approving document:", error);
      toast.error("Failed to approve document");
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async (doc: VerificationDoc) => {
    if (!adminNotes.trim()) {
      toast.error("Please provide a reason for rejection");
      return;
    }

    setProcessing(true);
    try {
      const { error } = await supabase
        .from("verification_documents")
        .update({
          status: "rejected",
          admin_notes: adminNotes,
        })
        .eq("id", doc.id);

      if (error) throw error;

      toast.success("Document rejected");
      setSelectedDoc(null);
      setAdminNotes("");
      fetchDocuments();
    } catch (error) {
      console.error("Error rejecting document:", error);
      toast.error("Failed to reject document");
    } finally {
      setProcessing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-green-500/20 text-green-500">Approved</Badge>;
      case "rejected":
        return <Badge variant="destructive">Rejected</Badge>;
      default:
        return <Badge variant="secondary">Pending</Badge>;
    }
  };

  const getDocumentUrl = async (filePath: string) => {
    const { data } = await supabase.storage
      .from("verification-documents")
      .createSignedUrl(filePath, 60);
    return data?.signedUrl;
  };

  const handleViewDocument = async (doc: VerificationDoc) => {
    const url = await getDocumentUrl(doc.file_path);
    if (url) {
      window.open(url, "_blank");
    } else {
      toast.error("Failed to load document");
    }
  };

  return (
    <AdminLayout title="Verification Documents">
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-4">
            <Button
              variant={documents.some(d => d.status === "pending") ? "default" : "outline"}
              size="sm"
            >
              Pending ({documents.filter((d) => d.status === "pending").length})
            </Button>
            <Button variant="outline" size="sm">
              Approved ({documents.filter((d) => d.status === "approved").length})
            </Button>
            <Button variant="outline" size="sm">
              Rejected ({documents.filter((d) => d.status === "rejected").length})
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center">
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-secondary" />
          </div>
        ) : documents.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No verification documents yet</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="p-4 flex items-center justify-between hover:bg-muted/50"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-secondary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">
                      {doc.profile?.business_name || doc.profile?.contact_name || "Unknown User"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {doc.document_type.replace("_", " ")} •{" "}
                      {format(new Date(doc.created_at), "d MMM yyyy")}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {getStatusBadge(doc.status)}

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleViewDocument(doc)}
                  >
                    <Eye className="w-4 h-4" />
                  </Button>

                  {doc.status === "pending" && (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-green-500 hover:text-green-600 hover:bg-green-500/10"
                        onClick={() => setSelectedDoc(doc)}
                      >
                        <Check className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setSelectedDoc(doc)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Review Dialog */}
      <Dialog open={!!selectedDoc} onOpenChange={() => setSelectedDoc(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review Document</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Business</p>
              <p className="font-medium">
                {selectedDoc?.profile?.business_name ||
                  selectedDoc?.profile?.contact_name ||
                  "Unknown"}
              </p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">Document Type</p>
              <p className="font-medium">
                {selectedDoc?.document_type.replace("_", " ")}
              </p>
            </div>

            <Button
              variant="outline"
              className="w-full"
              onClick={() => selectedDoc && handleViewDocument(selectedDoc)}
            >
              <Eye className="w-4 h-4 mr-2" />
              View Document
            </Button>

            <div>
              <p className="text-sm text-muted-foreground mb-2">Admin Notes</p>
              <Textarea
                placeholder="Add notes (required for rejection)..."
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
              />
            </div>

            <div className="flex gap-3">
              <Button
                className="flex-1 bg-green-600 hover:bg-green-700"
                onClick={() => selectedDoc && handleApprove(selectedDoc)}
                disabled={processing}
              >
                {processing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4 mr-2" />
                )}
                Approve
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={() => selectedDoc && handleReject(selectedDoc)}
                disabled={processing}
              >
                {processing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <X className="w-4 h-4 mr-2" />
                )}
                Reject
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}