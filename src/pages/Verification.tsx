import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Sparkles,
  ArrowLeft,
  Loader2,
  Upload,
  Phone,
  MapPin,
  CheckCircle,
  FileText,
  Shield,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface VerificationDocument {
  id: string;
  document_type: string;
  status: string;
  created_at: string;
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
  const [addressProof, setAddressProof] = useState<File | null>(null);

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
      const { error } = await supabase.functions.invoke("send-verification-code", {
        body: { phone: profile.phone },
      });

      if (error) throw error;
      setCodeSent(true);
      toast.success("Verification code sent to your phone!");
    } catch (error: any) {
      console.error("Error sending code:", error);
      toast.error(error.message || "Failed to send verification code");
    } finally {
      setSendingCode(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      toast.error("Please enter a valid 6-digit code");
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

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-secondary" />
      </div>
    );
  }

  const hasBusinessDoc = documents.some(d => d.document_type === "business_license" || d.document_type === "insurance");
  const hasAddressDoc = documents.some(d => d.document_type === "address_proof");

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

          {/* Current Status */}
          <div className="bg-card rounded-2xl border border-border p-6 mb-6">
            <h2 className="font-heading text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5 text-secondary" />
              Verification Status
            </h2>
            <div className="grid grid-cols-3 gap-4">
              <div className={`p-4 rounded-xl text-center ${profile?.phone_verified ? 'bg-secondary/10 border border-secondary/30' : 'bg-muted'}`}>
                <Phone className={`w-6 h-6 mx-auto mb-2 ${profile?.phone_verified ? 'text-secondary' : 'text-muted-foreground'}`} />
                <p className="text-sm font-medium">{profile?.phone_verified ? 'Verified' : 'Pending'}</p>
                <p className="text-xs text-muted-foreground">Phone</p>
              </div>
              <div className={`p-4 rounded-xl text-center ${hasBusinessDoc ? 'bg-secondary/10 border border-secondary/30' : 'bg-muted'}`}>
                <FileText className={`w-6 h-6 mx-auto mb-2 ${hasBusinessDoc ? 'text-secondary' : 'text-muted-foreground'}`} />
                <p className="text-sm font-medium">{hasBusinessDoc ? 'Uploaded' : 'Pending'}</p>
                <p className="text-xs text-muted-foreground">Documents</p>
              </div>
              <div className={`p-4 rounded-xl text-center ${profile?.address_verified ? 'bg-secondary/10 border border-secondary/30' : 'bg-muted'}`}>
                <MapPin className={`w-6 h-6 mx-auto mb-2 ${profile?.address_verified ? 'text-secondary' : 'text-muted-foreground'}`} />
                <p className="text-sm font-medium">{profile?.address_verified ? 'Verified' : 'Pending'}</p>
                <p className="text-xs text-muted-foreground">Address</p>
              </div>
            </div>
          </div>

          {/* Phone Verification */}
          <div className="bg-card rounded-2xl border border-border p-6 mb-6">
            <h2 className="font-heading text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <Phone className="w-5 h-5 text-secondary" />
              Phone Verification
              {profile?.phone_verified && <CheckCircle className="w-5 h-5 text-secondary ml-auto" />}
            </h2>

            {profile?.phone_verified ? (
              <p className="text-muted-foreground">Your phone number has been verified.</p>
            ) : (
              <div className="space-y-4">
                <p className="text-muted-foreground text-sm">
                  We'll send a 6-digit code to {profile?.phone || "your phone number"}.
                </p>

                {!profile?.phone && (
                  <Link to="/settings">
                    <Button variant="outline" size="sm">
                      Add Phone Number First
                    </Button>
                  </Link>
                )}

                {profile?.phone && !codeSent && (
                  <Button
                    variant="cta"
                    onClick={handleSendVerificationCode}
                    disabled={sendingCode}
                  >
                    {sendingCode ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : null}
                    Send Verification Code
                  </Button>
                )}

                {codeSent && (
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <Input
                        placeholder="Enter 6-digit code"
                        value={verificationCode}
                        onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        maxLength={6}
                        className="max-w-[150px]"
                      />
                      <Button onClick={handleVerifyCode} disabled={verifyingCode}>
                        {verifyingCode ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verify"}
                      </Button>
                    </div>
                    <button
                      className="text-sm text-secondary hover:underline"
                      onClick={handleSendVerificationCode}
                      disabled={sendingCode}
                    >
                      Resend code
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Document Upload */}
          <div className="bg-card rounded-2xl border border-border p-6 mb-6">
            <h2 className="font-heading text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-secondary" />
              Business Documents
            </h2>

            <p className="text-muted-foreground text-sm mb-4">
              Upload one of the following: Business license, insurance certificate, or company registration.
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

              {documents.filter(d => d.document_type === "business_license" || d.document_type === "insurance").length > 0 && (
                <div className="space-y-2">
                  {documents.filter(d => d.document_type === "business_license" || d.document_type === "insurance").map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between bg-muted rounded-lg p-3">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">{doc.document_type.replace("_", " ")}</span>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded ${
                        doc.status === "approved" ? "bg-secondary/20 text-secondary" :
                        doc.status === "rejected" ? "bg-destructive/20 text-destructive" :
                        "bg-amber-500/20 text-amber-500"
                      }`}>
                        {doc.status === "pending" ? <Clock className="w-3 h-3 inline mr-1" /> : null}
                        {doc.status}
                      </span>
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
              <p className="text-muted-foreground">Your address has been verified.</p>
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
                      <div key={doc.id} className="flex items-center justify-between bg-muted rounded-lg p-3">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm">Address proof</span>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded ${
                          doc.status === "approved" ? "bg-secondary/20 text-secondary" :
                          doc.status === "rejected" ? "bg-destructive/20 text-destructive" :
                          "bg-amber-500/20 text-amber-500"
                        }`}>
                          {doc.status === "pending" ? <Clock className="w-3 h-3 inline mr-1" /> : null}
                          {doc.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}