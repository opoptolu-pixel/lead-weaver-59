import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Loader2,
  Save,
  User,
  Building,
  Phone,
  MapPin,
  MessageSquare,
  Send,
  Shield,
  CheckCircle,
  AlertCircle,
  Circle,
  Upload,
  FileText,
  Eye,
  X,
  Clock,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from "zod";
import {
  EmailNotificationSettings,
  EmailPreferences,
  defaultEmailPreferences,
} from "@/components/EmailNotificationSettings";
import PhoneVerification from "@/components/PhoneVerification";
import { useSignedUrl } from "@/hooks/useSignedUrl";

const profileSchema = z.object({
  contact_name: z.string().max(100, "Name must be less than 100 characters").optional(),
  business_name: z.string().max(100, "Business name must be less than 100 characters").optional(),
  phone: z.string().max(20, "Phone must be less than 20 characters").optional(),
  postcode: z.string().max(10, "Postcode must be less than 10 characters").optional(),
});

interface VerificationDocument {
  id: string;
  document_type: string;
  status: string;
  created_at: string;
  admin_notes: string | null;
  file_path: string;
}

// Verification status component with document uploads
interface VerificationStatusProps {
  profile: {
    phone_verified?: boolean;
    is_verified?: boolean;
    address_verified?: boolean;
    leads_purchased?: number;
    verification_status?: string | null;
  } | null;
  userId: string | undefined;
  onRefresh: () => void;
}

function VerificationStatusSection({ profile, userId, onRefresh }: VerificationStatusProps) {
  const [documents, setDocuments] = useState<VerificationDocument[]>([]);
  const [uploading, setUploading] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<VerificationDocument | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const { getSignedUrl } = useSignedUrl();
  
  const addressInputRef = useRef<HTMLInputElement>(null);
  const incorporationInputRef = useRef<HTMLInputElement>(null);
  const insuranceInputRef = useRef<HTMLInputElement>(null);

  const isPhoneVerified = profile?.phone_verified || false;
  const isFullyVerified = profile?.is_verified || false;
  const leadsPurchased = profile?.leads_purchased || 0;
  const leadsRemaining = Math.max(0, 3 - leadsPurchased);
  const needsFullVerification = leadsPurchased >= 3 && !isFullyVerified;

  useEffect(() => {
    if (userId) {
      fetchDocuments();
    }
  }, [userId]);

  const fetchDocuments = async () => {
    const { data, error } = await supabase
      .from("verification_documents")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setDocuments(data);
    }
  };

  const handleDocumentUpload = async (type: string, file: File) => {
    if (!userId) return;

    setUploading(type);
    try {
      const fileExt = file.name.split(".").pop();
      const filePath = `${userId}/${type}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("verification-documents")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Check if document of this type already exists
      const existingDoc = documents.find(d => d.document_type === type);
      
      if (existingDoc) {
        // Update existing document
        const { error: dbError } = await supabase
          .from("verification_documents")
          .update({
            file_path: filePath,
            status: "pending",
            admin_notes: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingDoc.id);

        if (dbError) throw dbError;
      } else {
        // Insert new document
        const { error: dbError } = await supabase
          .from("verification_documents")
          .insert({
            user_id: userId,
            document_type: type,
            file_path: filePath,
            status: "pending",
          });

        if (dbError) throw dbError;
      }

      await fetchDocuments();
      toast.success("Document uploaded successfully!");
    } catch (error: any) {
      console.error("Error uploading document:", error);
      toast.error(error.message || "Failed to upload document");
    } finally {
      setUploading(null);
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

  const getDocForType = (type: string) => documents.find(d => d.document_type === type);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <span className="px-2 py-0.5 text-xs font-medium bg-secondary/20 text-secondary rounded-full">Approved</span>;
      case "rejected":
        return <span className="px-2 py-0.5 text-xs font-medium bg-destructive/20 text-destructive rounded-full">Rejected</span>;
      default:
        return <span className="px-2 py-0.5 text-xs font-medium bg-amber-500/20 text-amber-600 rounded-full">Pending Review</span>;
    }
  };

  // Determine overall status
  const getStatusInfo = () => {
    if (isFullyVerified) {
      return {
        icon: <CheckCircle className="w-5 h-5 text-secondary" />,
        title: "Fully Verified",
        color: "text-secondary",
        bgColor: "bg-secondary/10",
        borderColor: "border-secondary/30",
      };
    }
    if (needsFullVerification) {
      return {
        icon: <AlertCircle className="w-5 h-5 text-destructive" />,
        title: "Verification Required",
        color: "text-destructive",
        bgColor: "bg-destructive/10",
        borderColor: "border-destructive/30",
      };
    }
    if (isPhoneVerified) {
      return {
        icon: <CheckCircle className="w-5 h-5 text-secondary" />,
        title: "Phone Verified",
        color: "text-secondary",
        bgColor: "bg-secondary/10",
        borderColor: "border-secondary/30",
      };
    }
    return {
      icon: <AlertCircle className="w-5 h-5 text-amber-500" />,
      title: "Phone Verification Required",
      color: "text-amber-500",
      bgColor: "bg-amber-500/10",
      borderColor: "border-amber-500/30",
    };
  };

  const statusInfo = getStatusInfo();

  const documentTypes = [
    { 
      type: "address_proof", 
      label: "Proof of Address", 
      description: "Utility bill, bank statement, or council tax bill (within 3 months)",
      ref: addressInputRef
    },
    { 
      type: "business_license", 
      label: "Certificate of Incorporation", 
      description: "Companies House certificate or sole trader registration",
      ref: incorporationInputRef
    },
    { 
      type: "insurance", 
      label: "Insurance Certificate", 
      description: "Public liability insurance certificate",
      ref: insuranceInputRef
    },
  ];

  return (
    <>
      <div className="bg-card rounded-2xl border border-border p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-heading text-lg font-semibold text-foreground flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Verification Status
          </h2>
          <span className={`text-sm font-medium ${statusInfo.color}`}>
            {statusInfo.title}
          </span>
        </div>

        {/* Status message */}
        <div className={`flex items-center gap-2 p-3 rounded-lg ${statusInfo.bgColor} border ${statusInfo.borderColor} mb-4`}>
          {statusInfo.icon}
          <p className="text-sm text-foreground">
            {isFullyVerified ? (
              <>You're fully verified! Unlimited lead purchases available.</>
            ) : needsFullVerification ? (
              <>You've purchased 3 leads. Complete business verification to continue buying.</>
            ) : isPhoneVerified ? (
              <>You can purchase <strong>{leadsRemaining}</strong> more lead{leadsRemaining !== 1 ? 's' : ''} before business verification is required.</>
            ) : (
              <>Verify your phone number to start purchasing leads.</>
            )}
          </p>
        </div>

        {/* Requirements checklist */}
        <div className="space-y-3">
          {/* Phone Verification - Required for first 3 leads */}
          <div className={`flex items-center gap-3 p-3 rounded-lg ${isPhoneVerified ? "bg-secondary/10" : "bg-muted"}`}>
            {isPhoneVerified ? (
              <CheckCircle className="w-5 h-5 text-secondary flex-shrink-0" />
            ) : (
              <Circle className="w-5 h-5 text-muted-foreground flex-shrink-0" />
            )}
            <div className="flex-1">
              <p className={`text-sm font-medium ${isPhoneVerified ? "text-secondary" : "text-foreground"}`}>
                Phone Verification
              </p>
              <p className="text-xs text-muted-foreground">Required to purchase your first 3 leads</p>
            </div>
          </div>

          {/* Business Verification - Required after 3 leads */}
          <div className={`flex items-center gap-3 p-3 rounded-lg ${isFullyVerified ? "bg-secondary/10" : "bg-muted"}`}>
            {isFullyVerified ? (
              <CheckCircle className="w-5 h-5 text-secondary flex-shrink-0" />
            ) : (
              <Circle className="w-5 h-5 text-muted-foreground flex-shrink-0" />
            )}
            <div className="flex-1">
              <p className={`text-sm font-medium ${isFullyVerified ? "text-secondary" : "text-foreground"}`}>
                Business Verification
              </p>
              <p className="text-xs text-muted-foreground">
                Required after 3 leads: Proof of address, Certificate of incorporation & Insurance
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Business Documents Upload Section - Always show for non-fully-verified users */}
      {!isFullyVerified && (
        <div className="bg-card rounded-2xl border border-border p-6 mb-6">
          <h2 className="font-heading text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Business Documents
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Upload the following documents to complete business verification and unlock unlimited lead purchases.
          </p>

          <div className="space-y-4">
            {documentTypes.map(({ type, label, description, ref }) => {
              const doc = getDocForType(type);
              const isUploading = uploading === type;
              
              return (
                <div 
                  key={type}
                  className={`p-4 rounded-xl border ${
                    doc?.status === "approved" 
                      ? "border-secondary/30 bg-secondary/5" 
                      : doc?.status === "rejected"
                      ? "border-destructive/30 bg-destructive/5"
                      : doc
                      ? "border-amber-500/30 bg-amber-500/5"
                      : "border-border bg-muted/50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {doc?.status === "approved" ? (
                          <CheckCircle className="w-4 h-4 text-secondary" />
                        ) : doc?.status === "rejected" ? (
                          <AlertCircle className="w-4 h-4 text-destructive" />
                        ) : doc ? (
                          <Clock className="w-4 h-4 text-amber-500" />
                        ) : (
                          <Circle className="w-4 h-4 text-muted-foreground" />
                        )}
                        <span className="font-medium text-foreground">{label}</span>
                        {doc && getStatusBadge(doc.status)}
                      </div>
                      <p className="text-xs text-muted-foreground">{description}</p>
                      {doc?.admin_notes && doc.status === "rejected" && (
                        <p className="text-xs text-destructive mt-2 p-2 bg-destructive/10 rounded">
                          Reason: {doc.admin_notes}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {doc && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handlePreviewDocument(doc)}
                          className="gap-1"
                        >
                          <Eye className="w-4 h-4" />
                          View
                        </Button>
                      )}
                      <input
                        type="file"
                        ref={ref}
                        className="hidden"
                        accept=".pdf,.jpg,.jpeg,.png,.webp"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleDocumentUpload(type, file);
                          e.target.value = "";
                        }}
                      />
                      <Button
                        variant={doc ? "outline" : "cta"}
                        size="sm"
                        onClick={() => ref.current?.click()}
                        disabled={isUploading || doc?.status === "approved"}
                        className="gap-1"
                      >
                        {isUploading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Upload className="w-4 h-4" />
                        )}
                        {doc ? (doc.status === "rejected" ? "Re-upload" : "Replace") : "Upload"}
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <p className="text-xs text-muted-foreground mt-4 text-center">
            Documents are reviewed within 24-48 hours. We'll notify you once approved.
          </p>
        </div>
      )}

      {/* Document Preview Dialog */}
      <Dialog open={!!previewDoc} onOpenChange={() => { setPreviewDoc(null); setPreviewUrl(null); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Document Preview
              <Button
                variant="ghost"
                size="icon"
                onClick={() => { setPreviewDoc(null); setPreviewUrl(null); }}
                className="ml-auto"
              >
                <X className="w-4 h-4" />
              </Button>
            </DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            {loadingPreview ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : previewUrl ? (
              previewDoc?.file_path.toLowerCase().endsWith('.pdf') ? (
                <iframe 
                  src={previewUrl} 
                  className="w-full h-[70vh] border rounded-lg"
                  title="Document Preview"
                />
              ) : (
                <img 
                  src={previewUrl} 
                  alt="Document Preview" 
                  className="w-full h-auto rounded-lg"
                />
              )
            ) : (
              <p className="text-center text-muted-foreground py-12">
                Unable to load document preview
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function Settings() {
  const { user, profile, loading: authLoading, refreshProfile } = useAuth();
  const navigate = useNavigate();
  
  const [contactName, setContactName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [phone, setPhone] = useState("");
  const [postcode, setPostcode] = useState("");
  const [whatsappOptin, setWhatsappOptin] = useState(false);
  const [emailPreferences, setEmailPreferences] = useState<EmailPreferences>(defaultEmailPreferences);
  const [saving, setSaving] = useState(false);
  const [testingWhatsapp, setTestingWhatsapp] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  // Populate form with existing profile data
  useEffect(() => {
    if (profile) {
      setContactName(profile.contact_name || "");
      setBusinessName(profile.business_name || "");
      setPhone(profile.phone || "");
      setPostcode(profile.postcode || "");
      setWhatsappOptin(profile.whatsapp_optin || false);
    }
  }, [profile]);

  const validateForm = () => {
    try {
      profileSchema.parse({
        contact_name: contactName || undefined,
        business_name: businessName || undefined,
        phone: phone || undefined,
        postcode: postcode || undefined,
      });
      setErrors({});
      return true;
    } catch (err) {
      if (err instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        err.errors.forEach((error) => {
          const field = error.path[0] as string;
          fieldErrors[field] = error.message;
        });
        setErrors(fieldErrors);
      }
      return false;
    }
  };

  const handleSave = async () => {
    if (!validateForm()) return;
    if (!user) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          contact_name: contactName || null,
          business_name: businessName || null,
          phone: phone || null,
          postcode: postcode || null,
          whatsapp_optin: whatsappOptin,
        })
        .eq("user_id", user.id);

      if (error) throw error;

      await refreshProfile();
      toast.success("Profile updated successfully!");
    } catch (error) {
      console.error("Error updating profile:", error);
      toast.error("Failed to update profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleTestWhatsapp = async () => {
    if (!phone) {
      toast.error("Please enter your phone number first");
      return;
    }
    if (!whatsappOptin) {
      toast.error("Please enable WhatsApp notifications first");
      return;
    }

    setTestingWhatsapp(true);
    try {
      // First save the profile to ensure phone is stored
      await handleSave();

      // Get a sample lead to test with (or create a test message)
      const { data: leads } = await supabase
        .from("leads")
        .select("id")
        .limit(1);

      if (leads && leads.length > 0) {
        const { error } = await supabase.functions.invoke("send-whatsapp", {
          body: {
            type: "lead_unlocked",
            leadId: leads[0].id,
            userId: user?.id,
          },
        });

        if (error) throw error;
        toast.success("Test message sent! Check your WhatsApp.");
      } else {
        toast.error("No leads available to test with");
      }
    } catch (error: any) {
      console.error("Error sending test WhatsApp:", error);
      toast.error(error.message || "Failed to send test message");
    } finally {
      setTestingWhatsapp(false);
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
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      {/* Header */}
      <header className="bg-primary border-b border-border sticky top-0 z-50">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-20">
            <Logo size="md" variant="white" />

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
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="font-heading text-3xl font-bold text-foreground mb-2">
              Profile Settings
            </h1>
            <p className="text-muted-foreground">
              Update your business details and preferences
            </p>
          </div>

          {/* Verification Status */}
          <VerificationStatusSection profile={profile} userId={user?.id} onRefresh={refreshProfile} />

          {/* Profile form */}
          <div className="bg-card rounded-2xl border border-border p-6 md:p-8">
            <div className="space-y-6">
              {/* Account email (read-only) */}
              <div className="space-y-2">
                <Label className="text-muted-foreground">Account Email</Label>
                <div className="flex items-center gap-3 bg-muted rounded-lg px-4 py-3">
                  <User className="w-5 h-5 text-muted-foreground" />
                  <span className="text-foreground">{user?.email}</span>
                </div>
                <p className="text-muted-foreground text-xs">
                  Contact support to change your email address
                </p>
              </div>

              {/* Contact name */}
              <div className="space-y-2">
                <Label htmlFor="contactName">Your Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    id="contactName"
                    placeholder="John Smith"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    className={`pl-10 ${errors.contact_name ? "border-destructive" : ""}`}
                  />
                </div>
                {errors.contact_name && (
                  <p className="text-destructive text-sm">{errors.contact_name}</p>
                )}
              </div>

              {/* Business name */}
              <div className="space-y-2">
                <Label htmlFor="businessName">Business Name</Label>
                <div className="relative">
                  <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    id="businessName"
                    placeholder="Sparkle Clean Services"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    className={`pl-10 ${errors.business_name ? "border-destructive" : ""}`}
                  />
                </div>
                {errors.business_name && (
                  <p className="text-destructive text-sm">{errors.business_name}</p>
                )}
              </div>

              {/* Phone */}
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number (with country code)</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+447700900000"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className={`pl-10 ${errors.phone ? "border-destructive" : ""}`}
                  />
                </div>
                {errors.phone && (
                  <p className="text-destructive text-sm">{errors.phone}</p>
                )}
                <p className="text-muted-foreground text-xs">
                  Include country code for WhatsApp (e.g., +44 for UK)
                </p>
              </div>

              {/* Postcode */}
              <div className="space-y-2">
                <Label htmlFor="postcode">Service Area Postcode</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    id="postcode"
                    placeholder="SW1A 1AA"
                    value={postcode}
                    onChange={(e) => setPostcode(e.target.value.toUpperCase())}
                    className={`pl-10 ${errors.postcode ? "border-destructive" : ""}`}
                  />
                </div>
                {errors.postcode && (
                  <p className="text-destructive text-sm">{errors.postcode}</p>
                )}
                <p className="text-muted-foreground text-xs">
                  We'll prioritize showing you leads near this postcode
                </p>
              </div>

              {/* Phone Verification - Required before buying leads */}
              <div className="p-4 rounded-xl border-2 border-dashed border-secondary/50 bg-secondary/5">
                <div className="flex items-center gap-2 mb-3">
                  <Shield className="w-5 h-5 text-secondary" />
                  <h3 className="font-semibold text-foreground">Phone Verification</h3>
                  {profile?.phone_verified && (
                    <span className="ml-auto px-2 py-0.5 text-xs font-medium bg-secondary/20 text-secondary rounded-full">
                      Verified
                    </span>
                  )}
                </div>
                <PhoneVerification
                  phone={phone || profile?.phone || null}
                  phoneVerified={profile?.phone_verified || false}
                  onVerified={refreshProfile}
                />
                <p className="text-muted-foreground text-xs mt-3">
                  <strong>Required:</strong> You must verify your phone number before purchasing leads
                </p>
              </div>

              {/* SMS opt-in */}
              <div className="flex items-center justify-between rounded-lg border border-border p-4">
                <div className="flex items-start gap-3">
                  <MessageSquare className="w-5 h-5 text-secondary mt-0.5" />
                  <div>
                    <Label htmlFor="sms" className="text-foreground font-medium">
                      SMS Notifications
                    </Label>
                    <p className="text-muted-foreground text-sm">
                      Get instant SMS alerts when new leads match your area
                    </p>
                  </div>
                </div>
                <Switch
                  id="sms"
                  checked={whatsappOptin}
                  onCheckedChange={setWhatsappOptin}
                />
              </div>

              {/* Test SMS button */}
              {whatsappOptin && phone && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={handleTestWhatsapp}
                  disabled={testingWhatsapp}
                >
                  {testingWhatsapp ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  Send Test SMS
                </Button>
              )}

              {/* Email Notification Settings */}
              <div className="pt-4 border-t border-border">
                <EmailNotificationSettings
                  preferences={emailPreferences}
                  onChange={setEmailPreferences}
                />
              </div>

              {/* Save button */}
              <Button
                variant="cta"
                size="lg"
                className="w-full gap-2"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Save className="w-5 h-5" />
                )}
                Save Changes
              </Button>
            </div>
          </div>

          {/* Quick links */}
          <div className="mt-8 p-6 rounded-2xl border border-border bg-card">
            <h2 className="font-heading text-lg font-semibold text-foreground mb-4">
              Account Management
            </h2>
            <div className="space-y-3">
              <Link to="/billing" className="flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors">
                <span className="text-foreground">Billing & Receipts</span>
                <ArrowLeft className="w-4 h-4 text-muted-foreground rotate-180" />
              </Link>
            </div>
          </div>

          {/* Danger zone */}
          <div className="mt-8 p-6 rounded-2xl border border-destructive/30 bg-destructive/5">
            <h2 className="font-heading text-lg font-semibold text-foreground mb-2">
              Danger Zone
            </h2>
            <p className="text-muted-foreground text-sm mb-4">
              Need to delete your account? Contact our support team and we'll help you.
            </p>
            <a href="mailto:hello@cleanda.co.uk">
              <Button variant="outline" size="sm">
                Contact Support
              </Button>
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
