import { useState, useEffect } from "react";
import { Check, X, Eye, FileText, Clock, Loader2, Download, Calendar, AlertTriangle } from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { useAdmin } from "@/contexts/AdminContext";
import { usePagination } from "@/hooks/usePagination";
import { PaginationControls } from "@/components/admin/PaginationControls";
import { exportToCsv } from "@/lib/exportCsv";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Common rejection reasons with pre-written guidance
const REJECTION_REASONS = [
  {
    id: "blurry",
    label: "Document is blurry or unreadable",
    message: "The document you submitted is too blurry or low quality to read. Please upload a clearer, higher-resolution image or PDF where all text is legible."
  },
  {
    id: "incomplete",
    label: "Document is incomplete or cropped",
    message: "The document appears to be cropped or incomplete. Please upload the full document showing all corners and edges, including headers and footers."
  },
  {
    id: "expired",
    label: "Document is expired or outdated",
    message: "The document you submitted is too old. Please upload a document dated within the last 3 months."
  },
  {
    id: "wrong_type",
    label: "Wrong document type",
    message: "The document submitted does not match the required document type. Please upload the correct type of document as specified in the verification requirements."
  },
  {
    id: "name_mismatch",
    label: "Business name doesn't match",
    message: "The business name on the document does not match your registered business name. Please upload a document that shows your registered business name."
  },
  {
    id: "address_mismatch",
    label: "Address doesn't match (for address proof)",
    message: "The address on the document does not match your registered business address. Please upload a document showing your correct business address."
  },
  {
    id: "not_official",
    label: "Not an official document",
    message: "The document does not appear to be an official document from a recognised institution. Please upload an official document such as a utility bill, bank statement, or government-issued letter."
  },
  {
    id: "modified",
    label: "Document appears to be modified",
    message: "The document appears to have been digitally altered or modified. Please upload an unaltered, original document."
  },
  {
    id: "custom",
    label: "Other (custom reason)",
    message: ""
  }
];

interface VerificationDoc {
  id: string;
  user_id: string;
  document_type: string;
  file_path: string;
  status: string;
  admin_notes: string | null;
  created_at: string;
  expiry_date: string | null;
  profile?: {
    business_name: string | null;
    contact_name: string | null;
    phone: string | null;
  };
}

export default function AdminVerifications() {
  const { getDateFilter, dateRange } = useAdmin();
  const [documents, setDocuments] = useState<VerificationDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDoc, setSelectedDoc] = useState<VerificationDoc | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [selectedReason, setSelectedReason] = useState<string>("");
  const [processing, setProcessing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [expiryDate, setExpiryDate] = useState<string>("");

  useEffect(() => {
    fetchDocuments();
  }, [dateRange]);

  // Real-time subscription for live updates
  useEffect(() => {
    const channel = supabase
      .channel('admin-verifications-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'verification_documents' },
        (payload) => {
          console.log('Verifications updated in realtime:', payload);
          fetchDocuments();
          toast.info('Verification queue updated', { 
            description: `${payload.eventType === 'INSERT' ? 'New document submitted' : payload.eventType === 'UPDATE' ? 'Document status changed' : 'Document removed'}`,
            duration: 3000 
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [dateRange]);

  const fetchDocuments = async () => {
    const { start, end } = getDateFilter();
    
    const { data, error } = await supabase
      .from("verification_documents")
      .select("*")
      .gte("created_at", start.toISOString())
      .lte("created_at", end.toISOString())
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

  // Helper function to get template and replace variables
  const getTemplateWithVariables = async (templateName: string, variables: Record<string, string>) => {
    const { data: template, error } = await supabase
      .from("email_templates")
      .select("subject, body")
      .eq("name", templateName)
      .eq("is_active", true)
      .maybeSingle();

    if (error || !template) {
      console.error("Template not found:", templateName, error);
      return null;
    }

    let subject = template.subject;
    let body = template.body;

    // Replace all variables
    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, "g");
      subject = subject.replace(regex, value);
      body = body.replace(regex, value);
    });

    return { subject, body };
  };

  const handleApprove = async (doc: VerificationDoc) => {
    setProcessing(true);
    try {
      // Build update object
      const updateData: any = {
        status: "approved",
        admin_notes: adminNotes || null,
      };

      // Add expiry date for insurance documents
      if (doc.document_type === "insurance" && expiryDate) {
        updateData.expiry_date = expiryDate;
      }

      // Update document status
      const { error: docError } = await supabase
        .from("verification_documents")
        .update(updateData)
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

      // Check if all 3 required documents are now approved before sending email
      const { data: allUserDocs } = await supabase
        .from("verification_documents")
        .select("document_type, status")
        .eq("user_id", doc.user_id);

      const requiredDocTypes = ["business_license", "insurance", "address_proof"];
      const approvedDocTypes = (allUserDocs || [])
        .filter(d => d.status === "approved")
        .map(d => d.document_type);
      
      const allDocsApproved = requiredDocTypes.every(type => approvedDocTypes.includes(type));

      // Only send email when all 3 documents are approved
      if (allDocsApproved) {
        try {
          const { data: userEmail } = await supabase.rpc("get_user_email", { user_uuid: doc.user_id });
          if (userEmail) {
            const businessName = doc.profile?.business_name || doc.profile?.contact_name || "Business Owner";
            const contactName = doc.profile?.contact_name || businessName;
            const currentYear = new Date().getFullYear().toString();
            
            // Try to get template from database - use existing "verification_approved" template
            const templateData = await getTemplateWithVariables("verification_approved", {
              business_name: businessName,
              contact_name: contactName,
              dashboard_url: "https://cleanda.co.uk/dashboard",
              leads_url: "https://cleanda.co.uk/leads",
              support_email: "hello@cleanda.co.uk",
              current_year: currentYear,
            });

            if (templateData) {
              await supabase.functions.invoke("send-email", {
                body: {
                  to: userEmail,
                  subject: templateData.subject,
                  html: templateData.body,
                  templateName: "verification_approved",
                },
              });
            } else {
              // Fallback to simple email if template not found
              await supabase.functions.invoke("send-email", {
                body: {
                  to: userEmail,
                  subject: "🎉 Your business is now fully verified!",
                  html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                      <h2 style="color: #10b981;">Congratulations! Your Business is Fully Verified ✓</h2>
                      <p>Dear ${businessName},</p>
                      <p>Great news! All your verification documents have been reviewed and approved:</p>
                      <ul>
                        <li>✅ Business License</li>
                        <li>✅ Insurance Certificate</li>
                        <li>✅ Address Proof</li>
                      </ul>
                      <p>You're now a fully verified business on Cleanda and can access all features, including unlimited lead purchases.</p>
                      <p><a href="https://cleanda.co.uk/leads" style="display: inline-block; background-color: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 16px;">Browse Available Leads</a></p>
                      <p>If you have any questions, please don't hesitate to contact us.</p>
                      <p>Best regards,<br>The Cleanda Team</p>
                    </div>
                  `,
                  templateName: "verification_approved",
                },
              });
            }
          }
        } catch (emailError) {
          console.error("Failed to send approval email:", emailError);
          // Don't fail the approval if email fails
        }
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

      // Send rejection email notification using template
      try {
        const { data: userEmail } = await supabase.rpc("get_user_email", { user_uuid: doc.user_id });
        if (userEmail) {
          const businessName = doc.profile?.business_name || doc.profile?.contact_name || "Business Owner";
          const contactName = doc.profile?.contact_name || businessName;
          const documentType = doc.document_type.replace("_", " ");
          const currentYear = new Date().getFullYear().toString();
          
          // Try to get template from database
          const templateData = await getTemplateWithVariables("document_rejected", {
            business_name: businessName,
            contact_name: contactName,
            document_type: documentType,
            rejection_reason: adminNotes,
            dashboard_url: "https://cleanda.co.uk/dashboard",
            verification_url: "https://cleanda.co.uk/settings/verification",
            support_email: "hello@cleanda.co.uk",
            current_year: currentYear,
          });

          if (templateData) {
            await supabase.functions.invoke("send-email", {
              body: {
                to: userEmail,
                subject: templateData.subject,
                html: templateData.body,
                templateName: "document_rejected",
              },
            });
          } else {
            // Fallback to simple email if template not found
            await supabase.functions.invoke("send-email", {
              body: {
                to: userEmail,
                subject: `Your ${documentType} requires attention`,
                html: `
                  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #ef4444;">Document Not Approved</h2>
                    <p>Dear ${businessName},</p>
                    <p>We've reviewed your <strong>${documentType}</strong> and unfortunately we were unable to approve it at this time.</p>
                    <p><strong>Reason:</strong> ${adminNotes}</p>
                    <p>Please log in to your account and upload a new document that addresses the issue mentioned above.</p>
                    <p><a href="https://cleanda.co.uk/settings/verification" style="display: inline-block; background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 16px;">Upload New Document</a></p>
                    <p>If you have any questions about why your document was rejected, please contact our support team.</p>
                    <p>Best regards,<br>The Cleanda Team</p>
                  </div>
                `,
                templateName: "document_rejected",
              },
            });
          }
        }
      } catch (emailError) {
        console.error("Failed to send rejection email:", emailError);
        // Don't fail the rejection if email fails
      }

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

  const getDocumentTypeLabel = (docType: string) => {
    switch (docType) {
      case "business_license":
        return "Business License";
      case "insurance":
        return "Insurance Certificate";
      case "address_proof":
        return "Address Proof";
      default:
        return docType.replace("_", " ");
    }
  };

  const getDocumentUrl = async (filePath: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("get-signed-url", {
        body: { filePath, bucket: "verification-documents", expiresIn: 300 },
      });
      
      if (error) {
        console.error("Error getting signed URL:", error);
        return null;
      }
      
      return data?.signedUrl;
    } catch (err) {
      console.error("Failed to get signed URL:", err);
      return null;
    }
  };

  const handleViewDocument = async (doc: VerificationDoc) => {
    const url = await getDocumentUrl(doc.file_path);
    if (url) {
      window.open(url, "_blank");
    } else {
      toast.error("Failed to load document");
    }
  };

  // Filter documents by status
  const filteredDocuments = documents.filter(doc => {
    if (statusFilter === "all") return true;
    return doc.status === statusFilter;
  });

  const pagination = usePagination(filteredDocuments);

  const handleExportCsv = () => {
    exportToCsv(filteredDocuments, "verifications", [
      { key: "id", label: "ID" },
      { key: "document_type", label: "Document Type" },
      { key: "status", label: "Status" },
      { key: "created_at", label: "Submitted" },
      { key: "admin_notes", label: "Admin Notes" },
    ]);
  };

  const pendingCount = documents.filter((d) => d.status === "pending").length;
  const approvedCount = documents.filter((d) => d.status === "approved").length;
  const rejectedCount = documents.filter((d) => d.status === "rejected").length;

  return (
    <AdminLayout title="Verification Documents">
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button
                variant={statusFilter === "pending" ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setStatusFilter("pending");
                  pagination.resetPage();
                }}
              >
                Pending ({pendingCount})
              </Button>
              <Button 
                variant={statusFilter === "approved" ? "default" : "outline"} 
                size="sm"
                onClick={() => {
                  setStatusFilter("approved");
                  pagination.resetPage();
                }}
              >
                Approved ({approvedCount})
              </Button>
              <Button 
                variant={statusFilter === "rejected" ? "default" : "outline"} 
                size="sm"
                onClick={() => {
                  setStatusFilter("rejected");
                  pagination.resetPage();
                }}
              >
                Rejected ({rejectedCount})
              </Button>
              <Button 
                variant={statusFilter === "all" ? "default" : "outline"} 
                size="sm"
                onClick={() => {
                  setStatusFilter("all");
                  pagination.resetPage();
                }}
              >
                All ({documents.length})
              </Button>
            </div>
            <Button variant="outline" size="sm" onClick={handleExportCsv}>
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center">
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-secondary" />
          </div>
        ) : filteredDocuments.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No verification documents {statusFilter !== "all" ? `with status "${statusFilter}"` : ""}</p>
          </div>
        ) : (
          <>
          <div className="divide-y divide-border">
            {pagination.paginatedData.map((doc) => (
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
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-muted-foreground">
                        {getDocumentTypeLabel(doc.document_type)} •{" "}
                        {format(new Date(doc.created_at), "d MMM yyyy")}
                      </p>
                      {doc.document_type === "insurance" && doc.expiry_date && (
                        <span className={`text-xs flex items-center gap-1 ${
                          new Date(doc.expiry_date) < new Date() 
                            ? "text-destructive" 
                            : new Date(doc.expiry_date) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                              ? "text-amber-500"
                              : "text-muted-foreground"
                        }`}>
                          <Calendar className="w-3 h-3" />
                          Expires: {format(new Date(doc.expiry_date), "d MMM yyyy")}
                          {new Date(doc.expiry_date) < new Date() && (
                            <AlertTriangle className="w-3 h-3 text-destructive" />
                          )}
                        </span>
                      )}
                    </div>
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

      {/* Review Dialog */}
      <Dialog open={!!selectedDoc} onOpenChange={(open) => {
        if (!open) {
          setSelectedDoc(null);
          setAdminNotes("");
          setSelectedReason("");
          setExpiryDate("");
        }
      }}>
        <DialogContent className="max-w-lg">
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
                {selectedDoc ? getDocumentTypeLabel(selectedDoc.document_type) : ""}
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

            {/* Insurance Expiry Date Field */}
            {selectedDoc?.document_type === "insurance" && (
              <div className="border-t border-border pt-4">
                <Label htmlFor="expiry-date" className="text-sm font-medium text-foreground">
                  Insurance Expiry Date
                </Label>
                <p className="text-xs text-muted-foreground mb-2">
                  Set the expiry date to receive automatic renewal reminders
                </p>
                <Input
                  id="expiry-date"
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full"
                />
              </div>
            )}

            <div className="border-t border-border pt-4">
              <p className="text-sm font-medium text-foreground mb-3">Quick Rejection Reasons</p>
              <Select
                value={selectedReason}
                onValueChange={(value) => {
                  setSelectedReason(value);
                  const reason = REJECTION_REASONS.find(r => r.id === value);
                  if (reason && reason.id !== "custom") {
                    setAdminNotes(reason.message);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a rejection reason..." />
                </SelectTrigger>
                <SelectContent>
                  {REJECTION_REASONS.map((reason) => (
                    <SelectItem key={reason.id} value={reason.id}>
                      {reason.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <p className="text-sm text-muted-foreground mb-2">
                Admin Notes {selectedReason === "custom" && <span className="text-destructive">*</span>}
              </p>
              <Textarea
                placeholder={selectedReason === "custom" 
                  ? "Enter your custom rejection reason..." 
                  : "Add notes (required for rejection, optional for approval)..."}
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                rows={4}
              />
              {selectedReason && selectedReason !== "custom" && (
                <p className="text-xs text-muted-foreground mt-1">
                  You can edit the pre-filled message above if needed.
                </p>
              )}
            </div>

            <div className="flex gap-3 pt-2">
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
                disabled={processing || !adminNotes.trim()}
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
