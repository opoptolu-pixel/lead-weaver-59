import { useState, useEffect } from "react";
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
  ChevronRight,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

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
const profileSchema = z.object({
  contact_name: z.string().max(100, "Name must be less than 100 characters").optional(),
  business_name: z.string().max(100, "Business name must be less than 100 characters").optional(),
  phone: z.string().max(20, "Phone must be less than 20 characters").optional(),
  postcode: z.string().max(10, "Postcode must be less than 10 characters").optional(),
});

// Verification status component
interface VerificationStatusProps {
  profile: {
    phone_verified?: boolean;
    is_verified?: boolean;
    address_verified?: boolean;
    leads_purchased?: number;
    verification_status?: string | null;
  } | null;
}

function VerificationStatusSection({ profile }: VerificationStatusProps) {
  const isPhoneVerified = profile?.phone_verified || false;
  const isFullyVerified = profile?.is_verified || false;
  const leadsPurchased = profile?.leads_purchased || 0;
  const leadsRemaining = Math.max(0, 3 - leadsPurchased);
  const needsFullVerification = leadsPurchased >= 3 && !isFullyVerified;

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

  return (
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
        <Link 
          to="/settings/verification"
          className={`flex items-center gap-3 p-3 rounded-lg transition-colors hover:bg-accent ${isFullyVerified ? "bg-secondary/10" : "bg-muted"}`}
        >
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
          {!isFullyVerified && (
            <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
          )}
        </Link>
      </div>
    </div>
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
        const { error } = await supabase.functions.invoke("send-sms-notification", {
          body: {
            type: "lead_unlocked",
            leadId: leads[0].id,
            userId: user?.id,
          },
        });

        if (error) throw error;
        toast.success("Test SMS sent! Check your phone.");
      } else {
        toast.error("No leads available to test with");
      }
    } catch (error: any) {
      console.error("Error sending test SMS:", error);
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
          <VerificationStatusSection profile={profile} />

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
                  onSavePhone={async () => {
                    // Save the phone number to profile before verification
                    if (!user || !phone) return;
                    const { error } = await supabase
                      .from("profiles")
                      .update({ phone: phone })
                      .eq("user_id", user.id);
                    if (error) throw error;
                  }}
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
