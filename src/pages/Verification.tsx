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
  expiry_date: string | null;
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
  const [insuranceExpiryDate, setInsuranceExpiryDate] = useState("");
  const [pendingInsuranceFile, setPendingInsuranceFile] = useState<File | null>(null);
  const [pendingInsuranceReupload, setPendingInsuranceReupload] = useState<{ docId: string; oldFilePath: string } | null>(null);
  
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

  const handleDocumentUpload = async (type: string, file: File, expiryDate?: string) => {
    if (!user) return;

    setUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const filePath = `${user.id}/${type}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("verification-documents")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const insertData: any = {
        user_id: user.id,
        document_type: type,
        file_path: filePath,
        status: "pending",
      };

      if (type === "insurance" && expiryDate) {
        insertData.expiry_date = expiryDate;
      }

      const { error: dbError } = await supabase
        .from("verification_documents")
        .insert(insertData);

      if (dbError) throw dbError;

      await fetchDocuments();
      toast.success("Document uploaded successfully!");
      setAddressProof(null);
      setPendingInsuranceFile(null);
      setInsuranceExpiryDate("");
    } catch (error: any) {
      console.error("Error uploading document:", error);
      toast.error(error.message || "Failed to upload document");
    } finally {
      setUploading(false);
    }
  };

  const handleReupload = async (docId: string, docType: string, oldFilePath: string, file: File, expiryDate?: string) => {
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
      const updateData: any = {
        file_path: filePath,
        status: "pending",
        admin_notes: null,
        updated_at: new Date().toISOString(),
      };

      if (docType === "insurance" && expiryDate) {
        updateData.expiry_date = expiryDate;
      }

      const { error: dbError } = await supabase
        .from("verification_documents")
        .update(updateData)
        .eq("id", docId);

      if (dbError) throw dbError;

      // Optionally delete old file (ignore errors if file doesn't exist)
      await supabase.storage
        .from("verification-documents")
        .remove([oldFilePath]);

      await fetchDocuments();
      toast.success("Document re-uploaded successfully!");
      setReuploadingDocId(null);
      setPendingInsuranceReupload(null);
      setPendingInsuranceFile(null);
      setInsuranceExpiryDate("");
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
            <Logo size="md" variant="white" linkTo={null} />
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
                purchasing unlimited leads. Unverified accounts are limited to 3 leads.
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

          {/* Document Upload Progress */}
          <div className="bg-card rounded-2xl border border-border p-6 mb-6">
            <h2 className="font-heading text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-secondary" />
              Document Progress
            </h2>
            
            {/* Progress Overview */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
              {[
                { type: "business_license", label: "Business License", icon: FileText },
                { type: "insurance", label: "Insurance", icon: Shield },
                { type: "address_proof", label: "Address Proof", icon: MapPin },
              ].map(({ type, label, icon: Icon }) => {
                const doc = documents.find(d => d.document_type === type);
                const status = doc?.status || "not_uploaded";
                const isExpired = type === "insurance" && status === "approved" && doc?.expiry_date && new Date(doc.expiry_date) < new Date();
                
                return (
                  <div
                    key={type}
                    className={`p-3 rounded-xl border-2 transition-colors ${
                      isExpired
                        ? "bg-destructive/10 border-destructive/40"
                        : status === "approved"
                        ? "bg-secondary/10 border-secondary/40"
                        : status === "pending"
                        ? "bg-amber-500/10 border-amber-500/40"
                        : status === "rejected"
                        ? "bg-destructive/10 border-destructive/40"
                        : "bg-muted border-border"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className={`w-4 h-4 ${
                        isExpired ? "text-destructive" :
                        status === "approved" ? "text-secondary" :
                        status === "pending" ? "text-amber-500" :
                        status === "rejected" ? "text-destructive" :
                        "text-muted-foreground"
                      }`} />
                      <span className="text-sm font-medium">{label}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {isExpired && (
                        <>
                          <AlertTriangle className="w-3.5 h-3.5 text-destructive" />
                          <span className="text-xs text-destructive font-medium">Expired</span>
                        </>
                      )}
                      {!isExpired && status === "approved" && (
                        <>
                          <CheckCircle className="w-3.5 h-3.5 text-secondary" />
                          <span className="text-xs text-secondary font-medium">Approved</span>
                        </>
                      )}
                      {status === "pending" && (
                        <>
                          <Clock className="w-3.5 h-3.5 text-amber-500" />
                          <span className="text-xs text-amber-500 font-medium">Under Review</span>
                        </>
                      )}
                      {!isExpired && status === "rejected" && (
                        <>
                          <X className="w-3.5 h-3.5 text-destructive" />
                          <span className="text-xs text-destructive font-medium">Rejected</span>
                        </>
                      )}
                      {status === "not_uploaded" && (
                        <>
                          <Upload className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">Not Uploaded</span>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Progress Bar */}
            <div className="mb-6">
            {(() => {
              const insuranceDoc = documents.find(d => d.document_type === "insurance");
              const insuranceExpired = insuranceDoc?.status === "approved" && insuranceDoc?.expiry_date && new Date(insuranceDoc.expiry_date) < new Date();
              const validApproved = documents.filter(d => {
                if (d.status !== "approved") return false;
                if (d.document_type === "insurance" && d.expiry_date && new Date(d.expiry_date) < new Date()) return false;
                return true;
              }).length;

              return (
                <>
                  <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                    <span>Verification Progress</span>
                    <span>
                      {validApproved} of 3 approved
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-500 ${insuranceExpired ? 'bg-destructive' : 'bg-secondary'}`}
                      style={{ 
                        width: `${(validApproved / 3) * 100}%` 
                      }}
                    />
                  </div>
                  {insuranceExpired && (
                    <p className="text-xs text-destructive mt-1.5">
                      Your insurance certificate has expired. Please upload a new one to restore full verification.
                    </p>
                  )}
                </>
              );
            })()}
            </div>
          </div>

          {/* Business Documents */}
          <div className="bg-card rounded-2xl border border-border p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-heading text-lg font-semibold text-foreground flex items-center gap-2">
                <FileText className="w-5 h-5 text-secondary" />
                Business License
              </h2>
              {(() => {
                const doc = documents.find(d => d.document_type === "business_license");
                if (!doc) return null;
                return (
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium flex items-center gap-1 ${
                    doc.status === "approved" ? "bg-secondary/20 text-secondary" :
                    doc.status === "rejected" ? "bg-destructive/20 text-destructive" :
                    "bg-amber-500/20 text-amber-500"
                  }`}>
                    {doc.status === "approved" && <CheckCircle className="w-3 h-3" />}
                    {doc.status === "pending" && <Clock className="w-3 h-3" />}
                    {doc.status === "rejected" && <X className="w-3 h-3" />}
                    {doc.status.charAt(0).toUpperCase() + doc.status.slice(1)}
                  </span>
                );
              })()}
            </div>

            <p className="text-muted-foreground text-sm mb-4">
              Upload your business license, company registration, or similar document proving your business is registered.
            </p>

            <div className="space-y-4">
              {!documents.some(d => d.document_type === "business_license") && (
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
              )}

              {documents.filter(d => d.document_type === "business_license").map((doc) => (
                <div key={doc.id} className={`rounded-xl p-4 border ${
                  doc.status === "approved" ? "bg-secondary/5 border-secondary/30" :
                  doc.status === "rejected" ? "bg-destructive/5 border-destructive/30" :
                  "bg-amber-500/5 border-amber-500/30"
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        doc.status === "approved" ? "bg-secondary/20" :
                        doc.status === "rejected" ? "bg-destructive/20" :
                        "bg-amber-500/20"
                      }`}>
                        <FileText className={`w-5 h-5 ${
                          doc.status === "approved" ? "text-secondary" :
                          doc.status === "rejected" ? "text-destructive" :
                          "text-amber-500"
                        }`} />
                      </div>
                      <div>
                        <p className="text-sm font-medium">Business License</p>
                        <p className="text-xs text-muted-foreground">
                          Uploaded {new Date(doc.created_at).toLocaleDateString()}
                        </p>
                      </div>
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
                    </div>
                  </div>
                  {doc.status === "rejected" && doc.admin_notes && (
                    <div className="mt-3 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-destructive">Rejection Reason</p>
                          <p className="text-sm text-destructive/80">{doc.admin_notes}</p>
                        </div>
                      </div>
                    </div>
                  )}
                  {doc.status === "approved" && (
                    <div className="mt-3 p-3 bg-secondary/10 rounded-lg flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-secondary" />
                      <p className="text-sm text-secondary">Document verified successfully</p>
                    </div>
                  )}
                  {doc.status === "pending" && (
                    <div className="mt-3 p-3 bg-amber-500/10 rounded-lg flex items-center gap-2">
                      <Clock className="w-4 h-4 text-amber-500" />
                      <p className="text-sm text-amber-600">Under review - typically 1-2 business days</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Insurance Document */}
          <div className="bg-card rounded-2xl border border-border p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-heading text-lg font-semibold text-foreground flex items-center gap-2">
                <Shield className="w-5 h-5 text-secondary" />
                Insurance Certificate
              </h2>
              {(() => {
                const doc = documents.find(d => d.document_type === "insurance");
                if (!doc) return null;
                const isExpired = doc.status === "approved" && doc.expiry_date && new Date(doc.expiry_date) < new Date();
                const displayStatus = isExpired ? "expired" : doc.status;
                return (
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium flex items-center gap-1 ${
                    isExpired ? "bg-destructive/20 text-destructive" :
                    doc.status === "approved" ? "bg-secondary/20 text-secondary" :
                    doc.status === "rejected" ? "bg-destructive/20 text-destructive" :
                    "bg-amber-500/20 text-amber-500"
                  }`}>
                    {isExpired && <AlertTriangle className="w-3 h-3" />}
                    {!isExpired && doc.status === "approved" && <CheckCircle className="w-3 h-3" />}
                    {doc.status === "pending" && <Clock className="w-3 h-3" />}
                    {doc.status === "rejected" && <X className="w-3 h-3" />}
                    {isExpired ? "Expired" : doc.status.charAt(0).toUpperCase() + doc.status.slice(1)}
                  </span>
                );
              })()}
            </div>

            <p className="text-muted-foreground text-sm mb-4">
              Upload your public liability insurance certificate. This is required for all cleaning businesses.
            </p>

            <div className="space-y-4">
              {!documents.some(d => d.document_type === "insurance") && (
                <div className="border-2 border-dashed border-border rounded-xl p-6">
                  <div className="text-center">
                    <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground mb-3">
                      PDF, JPG or PNG up to 10MB
                    </p>
                  </div>
                  
                  {/* Expiry date field */}
                  <div className="mb-4 max-w-xs mx-auto">
                    <Label htmlFor="insurance-expiry" className="text-sm font-medium mb-1.5 block">
                      Certificate Expiry Date <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="insurance-expiry"
                      type="date"
                      value={insuranceExpiryDate}
                      onChange={(e) => setInsuranceExpiryDate(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      className="text-sm"
                    />
                  </div>

                  <div className="text-center">
                    <input
                      type="file"
                      id="insurance-doc"
                      accept=".pdf,.jpg,.jpeg,.png"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          if (!insuranceExpiryDate) {
                            toast.error("Please enter the insurance certificate expiry date");
                            e.target.value = "";
                            return;
                          }
                          handleDocumentUpload("insurance", file, insuranceExpiryDate);
                        }
                      }}
                    />
                    <label htmlFor="insurance-doc">
                      <Button variant="outline" asChild disabled={uploading || !insuranceExpiryDate}>
                        <span>
                          {uploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
                          Upload Insurance Certificate
                        </span>
                      </Button>
                    </label>
                  </div>
                </div>
              )}

              {documents.filter(d => d.document_type === "insurance").map((doc) => {
                const isExpired = doc.status === "approved" && doc.expiry_date && new Date(doc.expiry_date) < new Date();
                return (
                <div key={doc.id} className={`rounded-xl p-4 border ${
                  isExpired ? "bg-destructive/5 border-destructive/30" :
                  doc.status === "approved" ? "bg-secondary/5 border-secondary/30" :
                  doc.status === "rejected" ? "bg-destructive/5 border-destructive/30" :
                  "bg-amber-500/5 border-amber-500/30"
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        isExpired ? "bg-destructive/20" :
                        doc.status === "approved" ? "bg-secondary/20" :
                        doc.status === "rejected" ? "bg-destructive/20" :
                        "bg-amber-500/20"
                      }`}>
                        <Shield className={`w-5 h-5 ${
                          isExpired ? "text-destructive" :
                          doc.status === "approved" ? "text-secondary" :
                          doc.status === "rejected" ? "text-destructive" :
                          "text-amber-500"
                        }`} />
                      </div>
                      <div>
                        <p className="text-sm font-medium">Insurance Certificate</p>
                        <p className="text-xs text-muted-foreground">
                          Uploaded {new Date(doc.created_at).toLocaleDateString()}
                        </p>
                      </div>
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
                      {(doc.status === "rejected" || isExpired) && (
                        <Button 
                          variant={isExpired ? "cta" : "outline"} 
                          size="sm" 
                          disabled={uploading}
                          onClick={() => {
                            setPendingInsuranceReupload({ docId: doc.id, oldFilePath: doc.file_path });
                            setPendingInsuranceFile(null);
                            setInsuranceExpiryDate("");
                          }}
                        >
                          <Upload className="w-3 h-3 mr-1" />
                          {isExpired ? "Upload New Certificate" : "Re-upload"}
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Re-upload form with expiry date */}
                  {pendingInsuranceReupload?.docId === doc.id && (
                    <div className="mt-3 p-4 bg-muted rounded-lg space-y-3">
                      <div>
                        <Label htmlFor="reupload-insurance-expiry" className="text-sm font-medium mb-1.5 block">
                          New Certificate Expiry Date <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="reupload-insurance-expiry"
                          type="date"
                          value={insuranceExpiryDate}
                          onChange={(e) => setInsuranceExpiryDate(e.target.value)}
                          min={new Date().toISOString().split('T')[0]}
                          className="text-sm max-w-xs"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="file"
                          id={`reupload-ins-${doc.id}`}
                          accept=".pdf,.jpg,.jpeg,.png"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              if (!insuranceExpiryDate) {
                                toast.error("Please enter the insurance certificate expiry date");
                                e.target.value = "";
                                return;
                              }
                              handleReupload(doc.id, doc.document_type, doc.file_path, file, insuranceExpiryDate);
                            }
                          }}
                        />
                        <label htmlFor={`reupload-ins-${doc.id}`}>
                          <Button variant="cta" size="sm" asChild disabled={uploading || !insuranceExpiryDate}>
                            <span className="cursor-pointer">
                              {uploading ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Upload className="w-3 h-3 mr-1" />}
                              Select & Upload File
                            </span>
                          </Button>
                        </label>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => {
                            setPendingInsuranceReupload(null);
                            setInsuranceExpiryDate("");
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                  {doc.status === "rejected" && doc.admin_notes && (
                    <div className="mt-3 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-destructive">Rejection Reason</p>
                          <p className="text-sm text-destructive/80">{doc.admin_notes}</p>
                        </div>
                      </div>
                    </div>
                  )}
                  {doc.status === "approved" && doc.expiry_date && new Date(doc.expiry_date) < new Date() && (
                    <div className="mt-3 p-3 bg-destructive/10 border border-destructive/20 rounded-lg flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-destructive" />
                      <div>
                        <p className="text-sm font-medium text-destructive">Insurance Expired</p>
                        <p className="text-xs text-destructive/80">
                          Expired on {new Date(doc.expiry_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}. Please upload a new certificate to continue purchasing leads.
                        </p>
                      </div>
                    </div>
                  )}
                  {doc.status === "approved" && (!doc.expiry_date || new Date(doc.expiry_date) >= new Date()) && (
                    <div className="mt-3 p-3 bg-secondary/10 rounded-lg flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-secondary" />
                      <p className="text-sm text-secondary">Document verified successfully</p>
                    </div>
                  )}
                  {doc.status === "pending" && (
                    <div className="mt-3 p-3 bg-amber-500/10 rounded-lg flex items-center gap-2">
                      <Clock className="w-4 h-4 text-amber-500" />
                      <p className="text-sm text-amber-600">Under review - typically 1-2 business days</p>
                    </div>
                  )}
                </div>
                );
              })}
            </div>
          </div>

          {/* Address Verification */}
          <div className="bg-card rounded-2xl border border-border p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-heading text-lg font-semibold text-foreground flex items-center gap-2">
                <MapPin className="w-5 h-5 text-secondary" />
                Address Verification
              </h2>
              {(() => {
                const doc = documents.find(d => d.document_type === "address_proof");
                if (profile?.address_verified) {
                  return (
                    <span className="text-xs px-2.5 py-1 rounded-full font-medium flex items-center gap-1 bg-secondary/20 text-secondary">
                      <CheckCircle className="w-3 h-3" />
                      Verified
                    </span>
                  );
                }
                if (!doc) return null;
                return (
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium flex items-center gap-1 ${
                    doc.status === "approved" ? "bg-secondary/20 text-secondary" :
                    doc.status === "rejected" ? "bg-destructive/20 text-destructive" :
                    "bg-amber-500/20 text-amber-500"
                  }`}>
                    {doc.status === "approved" && <CheckCircle className="w-3 h-3" />}
                    {doc.status === "pending" && <Clock className="w-3 h-3" />}
                    {doc.status === "rejected" && <X className="w-3 h-3" />}
                    {doc.status.charAt(0).toUpperCase() + doc.status.slice(1)}
                  </span>
                );
              })()}
            </div>

            {profile?.address_verified ? (
              <div className="space-y-4">
                <div className="p-3 bg-secondary/10 rounded-lg flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-secondary" />
                  <p className="text-sm text-secondary">Your address has been verified successfully</p>
                </div>
                
                {documents.filter(d => d.document_type === "address_proof").map((doc) => (
                  <div key={doc.id} className="rounded-xl p-4 border bg-secondary/5 border-secondary/30">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-secondary/20">
                          <MapPin className="w-5 h-5 text-secondary" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">Address Proof</p>
                          <p className="text-xs text-muted-foreground">
                            Uploaded {new Date(doc.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handlePreviewDocument(doc)}
                        title="Preview document"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-muted-foreground text-sm">
                  Upload a utility bill or bank statement showing your business address (dated within last 3 months).
                </p>

                {!documents.some(d => d.document_type === "address_proof") && (
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
                )}

                {documents.filter(d => d.document_type === "address_proof").map((doc) => (
                  <div key={doc.id} className={`rounded-xl p-4 border ${
                    doc.status === "approved" ? "bg-secondary/5 border-secondary/30" :
                    doc.status === "rejected" ? "bg-destructive/5 border-destructive/30" :
                    "bg-amber-500/5 border-amber-500/30"
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          doc.status === "approved" ? "bg-secondary/20" :
                          doc.status === "rejected" ? "bg-destructive/20" :
                          "bg-amber-500/20"
                        }`}>
                          <MapPin className={`w-5 h-5 ${
                            doc.status === "approved" ? "text-secondary" :
                            doc.status === "rejected" ? "text-destructive" :
                            "text-amber-500"
                          }`} />
                        </div>
                        <div>
                          <p className="text-sm font-medium">Address Proof</p>
                          <p className="text-xs text-muted-foreground">
                            Uploaded {new Date(doc.created_at).toLocaleDateString()}
                          </p>
                        </div>
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
                      </div>
                    </div>
                    {doc.status === "rejected" && doc.admin_notes && (
                      <div className="mt-3 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm font-medium text-destructive">Rejection Reason</p>
                            <p className="text-sm text-destructive/80">{doc.admin_notes}</p>
                          </div>
                        </div>
                      </div>
                    )}
                    {doc.status === "approved" && (
                      <div className="mt-3 p-3 bg-secondary/10 rounded-lg flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-secondary" />
                        <p className="text-sm text-secondary">Document verified successfully</p>
                      </div>
                    )}
                    {doc.status === "pending" && (
                      <div className="mt-3 p-3 bg-amber-500/10 rounded-lg flex items-center gap-2">
                        <Clock className="w-4 h-4 text-amber-500" />
                        <p className="text-sm text-amber-600">Under review - typically 1-2 business days</p>
                      </div>
                    )}
                  </div>
                ))}
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