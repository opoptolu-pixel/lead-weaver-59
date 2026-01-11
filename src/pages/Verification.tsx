import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Loader2,
  Upload,
  Phone,
  MapPin,
  CheckCircle,
  FileText,
  Shield,
  Clock,
  AlertTriangle,
  RefreshCw,
  Eye,
  X,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useSignedUrl } from "@/hooks/useSignedUrl";

interface VerificationDocument {
  id: string;
  document_type: string;
  status: string;
  created_at: string;
  admin_notes: string | null;
  file_path: string;
}

export default function Verification() {
  const { user, profile, loading: authLoading, refreshProfile } = useAuth();
  const navigate = useNavigate();

  const [documents, setDocuments] = useState<VerificationDocument[]>([]);
  const [uploading, setUploading] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [deliveryMethod, setDeliveryMethod] = useState<string | null>(null);
  const [retryAfter, setRetryAfter] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState<number>(0);
  const [addressProof, setAddressProof] = useState<File | null>(null);
  const [reuploadingDocId, setReuploadingDocId] = useState<string | null>(null);
  const reuploadInputRef = useRef<HTMLInputElement>(null);
  
  // Document preview state
  const [previewDoc, setPreviewDoc] = useState<VerificationDocument | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const { getSignedUrl } = useSignedUrl();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchDocuments();
    }
  }, [user]);

  // Countdown timer effect
  useEffect(() => {
    if (!retryAfter) {
      setCountdown(0);
      return;
    }

    const updateCountdown = () => {
      const remaining = Math.max(0, Math.ceil((retryAfter.getTime() - Date.now()) / 1000));
      setCountdown(remaining);
      if (remaining === 0) {
        setRetryAfter(null);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [retryAfter]);

  const fetchDocuments = async () => {
    const { data, error } = await supabase
      .from("verification_documents")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setDocuments(data);
    }
  };

  const handleSendVerificationCode = async () => {
    if (!profile?.phone) {
      toast.error("Please add your phone number in Settings first");
      return;
    }

    setSendingCode(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-verification-code", {
        body: { phone: profile.phone },
      });

      // Handle rate limit response (429 status returns in data for edge functions)
      if (data?.rateLimited && data?.retryAfter) {
        setRetryAfter(new Date(data.retryAfter));
        toast.error("Too many requests. Please wait before trying again.");
        return;
      }

      if (error) throw error;
      setCodeSent(true);
      setDeliveryMethod(data?.deliveryMethod || null);
      toast.success(`Verification code sent via ${data?.deliveryMethod || "message"}!`);
    } catch (error: any) {
      console.error("Error sending code:", error);
      toast.error(error.message || "Failed to send verification code");
    } finally {
      setSendingCode(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!verificationCode || verificationCode.length !== 8) {
      toast.error("Please enter a valid 8-character code");
      return;
    }

    setVerifyingCode(true);
    try {
      const { error } = await supabase.functions.invoke("verify-phone-code", {
        body: { code: verificationCode },
      });

      if (error) throw error;
      await refreshProfile();
      toast.success("Phone number verified!");
      setCodeSent(false);
      setVerificationCode("");
      setDeliveryMethod(null);
    } catch (error: any) {
      console.error("Error verifying code:", error);
      toast.error(error.message || "Invalid verification code");
    } finally {
      setVerifyingCode(false);
    }
  };

  const handleDocumentUpload = async (type: string, file: File) => {
    if (!user) return;

    setUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const filePath = `${user.id}/${type}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("verification-documents")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase
        .from("verification_documents")
        .insert({
          user_id: user.id,
          document_type: type,
          file_path: filePath,
          status: "pending",
        });

      if (dbError) throw dbError;

      await fetchDocuments();
      toast.success("Document uploaded successfully!");
      setAddressProof(null);
    } catch (error: any) {
      console.error("Error uploading document:", error);
      toast.error(error.message || "Failed to upload document");
    } finally {
      setUploading(false);
    }
  };

  const handleReupload = async (docId: string, docType: string, oldFilePath: string, file: File) => {
    if (!user) return;

    setUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const filePath = `${user.id}/${docType}-${Date.now()}.${fileExt}`;

      // Upload new file
      const { error: uploadError } = await supabase.storage
        .from("verification-documents")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Update the existing document record
      const { error: dbError } = await supabase
        .from("verification_documents")
        .update({
          file_path: filePath,
          status: "pending",
          admin_notes: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", docId);

      if (dbError) throw dbError;

      // Optionally delete old file (ignore errors if file doesn't exist)
      await supabase.storage
        .from("verification-documents")
        .remove([oldFilePath]);

      await fetchDocuments();
      toast.success("Document re-uploaded successfully!");
      setReuploadingDocId(null);
    } catch (error: any) {
      console.error("Error re-uploading document:", error);
      toast.error(error.message || "Failed to re-upload document");
    } finally {
      setUploading(false);
    }
  };

  const handlePreviewDocument = async (doc: VerificationDocument) => {
    setPreviewDoc(doc);
    setLoadingPreview(true);
    setPreviewUrl(null);
    
    try {
      const url = await getSignedUrl(doc.file_path, "verification-documents", 3600);
      if (url) {
        setPreviewUrl(url);
      } else {
        toast.error("Failed to load document preview");
        setPreviewDoc(null);
      }
    } catch (error) {
      console.error("Error loading preview:", error);
      toast.error("Failed to load document preview");
      setPreviewDoc(null);
    } finally {
      setLoadingPreview(false);
    }
  };

  const closePreview = () => {
    setPreviewDoc(null);
    setPreviewUrl(null);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-secondary" />
      </div>
    );
  }

  const hasBusinessDoc = documents.some(d => d.document_type === "business_license");
  const hasInsuranceDoc = documents.some(d => d.document_type === "insurance");
  const hasAddressDoc = documents.some(d => d.document_type === "address_proof");
  
  const getDocStatus = (docType: string) => {
    const doc = documents.find(d => d.document_type === docType);
    if (!doc) return "not_uploaded";
    return doc.status;
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-primary border-b border-border sticky top-0 z-50">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-20">
            <Logo size="md" variant="white" />
            <Link to="/settings">
              <Button variant="outlineHero" size="sm" className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                Back to Settings
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="mb-8">
            <h1 className="font-heading text-3xl font-bold text-foreground mb-2">
              Business Verification
            </h1>
            <p className="text-muted-foreground">
              Verify your business to unlock unlimited lead purchases
            </p>
          </div>

          {/* Restriction Warnings */}
          {profile?.is_suspended && (
            <Alert variant="destructive" className="mb-6">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Account Suspended</AlertTitle>
              <AlertDescription>
                Your account has been suspended. You cannot purchase leads until this is resolved. 
                Please contact support for assistance.
              </AlertDescription>
            </Alert>
          )}

          {!profile?.is_verified && profile?.leads_purchased >= 3 && (
            <Alert className="mb-6 border-amber-500 bg-amber-500/10">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <AlertTitle className="text-amber-500">Verification Required</AlertTitle>
              <AlertDescription>
                You've purchased {profile.leads_purchased} leads. Complete verification to continue 
                purchasing unlimited leads. Unverified accounts are limited to 5 leads.
              </AlertDescription>
            </Alert>
          )}

          {profile?.verification_status === "required" && (
            <Alert className="mb-6 border-destructive bg-destructive/10">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Verification Required by Admin</AlertTitle>
              <AlertDescription>
                An admin has requested that you complete verification before making further purchases.
                Please upload all required documents below.
              </AlertDescription>
            </Alert>
          )}

          {/* Current Status */}
          <div className="bg-card rounded-2xl border border-border p-6 mb-6">
            <h2 className="font-heading text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5 text-secondary" />
              Verification Status
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className={`p-4 rounded-xl text-center ${profile?.phone_verified ? 'bg-secondary/10 border border-secondary/30' : 'bg-muted'}`}>
                {profile?.phone_verified ? (
                  <CheckCircle className="w-6 h-6 mx-auto mb-2 text-secondary" />
                ) : (
                  <Phone className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
                )}
                <p className="text-sm font-medium">{profile?.phone_verified ? 'Verified' : 'Pending'}</p>
                <p className="text-xs text-muted-foreground">Phone</p>
                {!profile?.phone_verified && (
                  <Link to="/settings" className="text-xs text-secondary hover:underline mt-1 block">
                    Verify in Settings
                  </Link>
                )}
              </div>
              <div className={`p-4 rounded-xl text-center ${profile?.is_verified ? 'bg-secondary/10 border border-secondary/30' : 'bg-muted'}`}>
                {profile?.is_verified ? (
                  <CheckCircle className="w-6 h-6 mx-auto mb-2 text-secondary" />
                ) : (
                  <FileText className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
                )}
                <p className="text-sm font-medium">{profile?.is_verified ? 'Verified' : 'Pending'}</p>
                <p className="text-xs text-muted-foreground">Business</p>
              </div>
              <div className={`p-4 rounded-xl text-center ${profile?.address_verified ? 'bg-secondary/10 border border-secondary/30' : 'bg-muted'}`}>
                {profile?.address_verified ? (
                  <CheckCircle className="w-6 h-6 mx-auto mb-2 text-secondary" />
                ) : (
                  <MapPin className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
                )}
                <p className="text-sm font-medium">{profile?.address_verified ? 'Verified' : 'Pending'}</p>
                <p className="text-xs text-muted-foreground">Address</p>
              </div>
            </div>
          </div>

          {/* Document Upload */}
          <div className="bg-card rounded-2xl border border-border p-6 mb-6">
            <h2 className="font-heading text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-secondary" />
              Business Documents
            </h2>

            <p className="text-muted-foreground text-sm mb-4">
              Upload your business license, company registration, or similar document proving your business is registered.
            </p>

            <div className="space-y-4">
              <div className="border-2 border-dashed border-border rounded-xl p-6 text-center">
                <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground mb-3">
                  PDF, JPG or PNG up to 10MB
                </p>
                <input
                  type="file"
                  id="business-doc"
                  accept=".pdf,.jpg,.jpeg,.png"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleDocumentUpload("business_license", file);
                  }}
                />
                <label htmlFor="business-doc">
                  <Button variant="outline" asChild disabled={uploading}>
                    <span>
                      {uploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
                      Upload Business Document
                    </span>
                  </Button>
                </label>
              </div>

              {documents.filter(d => d.document_type === "business_license").length > 0 && (
                <div className="space-y-2">
                  {documents.filter(d => d.document_type === "business_license").map((doc) => (
                    <div key={doc.id} className="bg-muted rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm">{doc.document_type.replace("_", " ")}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handlePreviewDocument(doc)}
                            title="Preview document"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          {doc.status === "rejected" && (
                            <>
                              <input
                                type="file"
                                id={`reupload-${doc.id}`}
                                accept=".pdf,.jpg,.jpeg,.png"
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) handleReupload(doc.id, doc.document_type, doc.file_path, file);
                                }}
                              />
                              <label htmlFor={`reupload-${doc.id}`}>
                                <Button variant="outline" size="sm" asChild disabled={uploading}>
                                  <span className="cursor-pointer">
                                    {uploading ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <RefreshCw className="w-3 h-3 mr-1" />}
                                    Re-upload
                                  </span>
                                </Button>
                              </label>
                            </>
                          )}
                          <span className={`text-xs px-2 py-1 rounded ${
                            doc.status === "approved" ? "bg-secondary/20 text-secondary" :
                            doc.status === "rejected" ? "bg-destructive/20 text-destructive" :
                            "bg-amber-500/20 text-amber-500"
                          }`}>
                            {doc.status === "pending" ? <Clock className="w-3 h-3 inline mr-1" /> : null}
                            {doc.status}
                          </span>
                        </div>
                      </div>
                      {doc.status === "rejected" && (
                        <div className="mt-3 p-4 bg-destructive/10 border border-destructive/30 rounded-lg">
                          <div className="flex items-start gap-3">
                            <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                            <div className="space-y-2">
                              <p className="font-medium text-destructive">Document Rejected</p>
                              {doc.admin_notes && (
                                <p className="text-sm text-destructive/90">
                                  <strong>Reason:</strong> {doc.admin_notes}
                                </p>
                              )}
                              <div className="text-sm text-muted-foreground space-y-1 mt-2">
                                <p className="font-medium">How to fix:</p>
                                <ul className="list-disc list-inside space-y-1 text-xs">
                                  <li>Ensure the document is clearly readable and not blurry</li>
                                  <li>Make sure all corners of the document are visible</li>
                                  <li>Upload a recent document (within last 3 months if applicable)</li>
                                  <li>Verify the document shows your registered business name</li>
                                </ul>
                              </div>
                              <p className="text-xs text-muted-foreground mt-2">
                                Click the "Re-upload" button above to submit a new document.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Insurance Document */}
          <div className="bg-card rounded-2xl border border-border p-6 mb-6">
            <h2 className="font-heading text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5 text-secondary" />
              Insurance Certificate
              {documents.some(d => d.document_type === "insurance" && d.status === "approved") && <CheckCircle className="w-5 h-5 text-secondary ml-auto" />}
            </h2>

            <p className="text-muted-foreground text-sm mb-4">
              Upload your public liability insurance certificate. This is required for all cleaning businesses.
            </p>

            <div className="space-y-4">
              <div className="border-2 border-dashed border-border rounded-xl p-6 text-center">
                <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground mb-3">
                  PDF, JPG or PNG up to 10MB
                </p>
                <input
                  type="file"
                  id="insurance-doc"
                  accept=".pdf,.jpg,.jpeg,.png"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleDocumentUpload("insurance", file);
                  }}
                />
                <label htmlFor="insurance-doc">
                  <Button variant="outline" asChild disabled={uploading}>
                    <span>
                      {uploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
                      Upload Insurance Certificate
                    </span>
                  </Button>
                </label>
              </div>

              {documents.filter(d => d.document_type === "insurance").length > 0 && (
                <div className="space-y-2">
                  {documents.filter(d => d.document_type === "insurance").map((doc) => (
                    <div key={doc.id} className="bg-muted rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Shield className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm">Insurance certificate</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handlePreviewDocument(doc)}
                            title="Preview document"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          {doc.status === "rejected" && (
                            <>
                              <input
                                type="file"
                                id={`reupload-ins-${doc.id}`}
                                accept=".pdf,.jpg,.jpeg,.png"
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) handleReupload(doc.id, doc.document_type, doc.file_path, file);
                                }}
                              />
                              <label htmlFor={`reupload-ins-${doc.id}`}>
                                <Button variant="outline" size="sm" asChild disabled={uploading}>
                                  <span className="cursor-pointer">
                                    {uploading ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <RefreshCw className="w-3 h-3 mr-1" />}
                                    Re-upload
                                  </span>
                                </Button>
                              </label>
                            </>
                          )}
                          <span className={`text-xs px-2 py-1 rounded ${
                            doc.status === "approved" ? "bg-secondary/20 text-secondary" :
                            doc.status === "rejected" ? "bg-destructive/20 text-destructive" :
                            "bg-amber-500/20 text-amber-500"
                          }`}>
                            {doc.status === "pending" ? <Clock className="w-3 h-3 inline mr-1" /> : null}
                            {doc.status}
                          </span>
                        </div>
                      </div>
                      {doc.status === "rejected" && (
                        <div className="mt-3 p-4 bg-destructive/10 border border-destructive/30 rounded-lg">
                          <div className="flex items-start gap-3">
                            <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                            <div className="space-y-2">
                              <p className="font-medium text-destructive">Document Rejected</p>
                              {doc.admin_notes && (
                                <p className="text-sm text-destructive/90">
                                  <strong>Reason:</strong> {doc.admin_notes}
                                </p>
                              )}
                              <div className="text-sm text-muted-foreground space-y-1 mt-2">
                                <p className="font-medium">How to fix:</p>
                                <ul className="list-disc list-inside space-y-1 text-xs">
                                  <li>Ensure the insurance certificate is clearly readable</li>
                                  <li>Certificate must show your business name and coverage details</li>
                                  <li>Make sure the policy is current and not expired</li>
                                  <li>Include the full document showing policy number and dates</li>
                                </ul>
                              </div>
                              <p className="text-xs text-muted-foreground mt-2">
                                Click the "Re-upload" button above to submit a new document.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Address Verification */}
          <div className="bg-card rounded-2xl border border-border p-6">
            <h2 className="font-heading text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-secondary" />
              Address Verification
              {profile?.address_verified && <CheckCircle className="w-5 h-5 text-secondary ml-auto" />}
            </h2>

            {profile?.address_verified ? (
              <div className="space-y-4">
                <p className="text-muted-foreground">Your address has been verified.</p>
                
                {/* Show uploaded documents with preview even after verification */}
                {documents.filter(d => d.document_type === "address_proof").length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-foreground">Uploaded Documents</p>
                    {documents.filter(d => d.document_type === "address_proof").map((doc) => (
                      <div key={doc.id} className="bg-muted rounded-lg p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm">Address proof</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handlePreviewDocument(doc)}
                              title="Preview document"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <span className="text-xs px-2 py-1 rounded bg-secondary/20 text-secondary">
                              approved
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-muted-foreground text-sm">
                  Upload a utility bill or bank statement showing your business address (dated within last 3 months).
                </p>

                <div className="border-2 border-dashed border-border rounded-xl p-6 text-center">
                  <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground mb-3">
                    PDF, JPG or PNG up to 10MB
                  </p>
                  <input
                    type="file"
                    id="address-doc"
                    accept=".pdf,.jpg,.jpeg,.png"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleDocumentUpload("address_proof", file);
                    }}
                  />
                  <label htmlFor="address-doc">
                    <Button variant="outline" asChild disabled={uploading}>
                      <span>
                        {uploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
                        Upload Address Proof
                      </span>
                    </Button>
                  </label>
                </div>

                {documents.filter(d => d.document_type === "address_proof").length > 0 && (
                  <div className="space-y-2">
                    {documents.filter(d => d.document_type === "address_proof").map((doc) => (
                      <div key={doc.id} className="bg-muted rounded-lg p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm">Address proof</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handlePreviewDocument(doc)}
                              title="Preview document"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            {doc.status === "rejected" && (
                              <>
                                <input
                                  type="file"
                                  id={`reupload-addr-${doc.id}`}
                                  accept=".pdf,.jpg,.jpeg,.png"
                                  className="hidden"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) handleReupload(doc.id, doc.document_type, doc.file_path, file);
                                  }}
                                />
                                <label htmlFor={`reupload-addr-${doc.id}`}>
                                  <Button variant="outline" size="sm" asChild disabled={uploading}>
                                    <span className="cursor-pointer">
                                      {uploading ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <RefreshCw className="w-3 h-3 mr-1" />}
                                      Re-upload
                                    </span>
                                  </Button>
                                </label>
                              </>
                            )}
                            <span className={`text-xs px-2 py-1 rounded ${
                              doc.status === "approved" ? "bg-secondary/20 text-secondary" :
                              doc.status === "rejected" ? "bg-destructive/20 text-destructive" :
                              "bg-amber-500/20 text-amber-500"
                            }`}>
                              {doc.status === "pending" ? <Clock className="w-3 h-3 inline mr-1" /> : null}
                              {doc.status}
                            </span>
                          </div>
                        </div>
                        {doc.status === "rejected" && (
                          <div className="mt-3 p-4 bg-destructive/10 border border-destructive/30 rounded-lg">
                            <div className="flex items-start gap-3">
                              <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                              <div className="space-y-2">
                                <p className="font-medium text-destructive">Document Rejected</p>
                                {doc.admin_notes && (
                                  <p className="text-sm text-destructive/90">
                                    <strong>Reason:</strong> {doc.admin_notes}
                                  </p>
                                )}
                                <div className="text-sm text-muted-foreground space-y-1 mt-2">
                                  <p className="font-medium">How to fix:</p>
                                  <ul className="list-disc list-inside space-y-1 text-xs">
                                    <li>Ensure the document is clearly readable and not blurry</li>
                                    <li>Make sure all corners of the document are visible</li>
                                    <li>Document must be dated within the last 3 months</li>
                                    <li>Verify the address matches your business registration</li>
                                  </ul>
                                </div>
                                <p className="text-xs text-muted-foreground mt-2">
                                  Click the "Re-upload" button above to submit a new document.
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Document Preview Dialog */}
      <Dialog open={!!previewDoc} onOpenChange={(open) => !open && closePreview()}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              {previewDoc?.document_type.replace("_", " ").replace(/\b\w/g, l => l.toUpperCase())}
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 overflow-auto min-h-[400px] bg-muted rounded-lg flex items-center justify-center">
            {loadingPreview ? (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-secondary" />
                <p className="text-sm text-muted-foreground">Loading document...</p>
              </div>
            ) : previewUrl ? (
              previewDoc?.file_path.toLowerCase().endsWith('.pdf') ? (
                <iframe
                  src={previewUrl}
                  className="w-full h-full min-h-[500px] rounded-lg"
                  title="Document Preview"
                />
              ) : (
                <img
                  src={previewUrl}
                  alt="Document Preview"
                  className="max-w-full max-h-[70vh] object-contain rounded-lg"
                />
              )
            ) : (
              <p className="text-muted-foreground">Unable to load preview</p>
            )}
          </div>
          
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={closePreview}>
              Close
            </Button>
            {previewUrl && (
              <Button asChild>
                <a href={previewUrl} target="_blank" rel="noopener noreferrer">
                  Open in New Tab
                </a>
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}