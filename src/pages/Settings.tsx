import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Sparkles,
  ArrowLeft,
  Loader2,
  Save,
  User,
  Building,
  Phone,
  MapPin,
  MessageSquare,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from "zod";

const profileSchema = z.object({
  contact_name: z.string().max(100, "Name must be less than 100 characters").optional(),
  business_name: z.string().max(100, "Business name must be less than 100 characters").optional(),
  phone: z.string().max(20, "Phone must be less than 20 characters").optional(),
  postcode: z.string().max(10, "Postcode must be less than 10 characters").optional(),
});

export default function Settings() {
  const { user, profile, loading: authLoading, refreshProfile } = useAuth();
  const navigate = useNavigate();
  
  const [contactName, setContactName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [phone, setPhone] = useState("");
  const [postcode, setPostcode] = useState("");
  const [whatsappOptin, setWhatsappOptin] = useState(false);
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
    <div className="min-h-screen bg-background">
      {/* Header */}
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

              {/* WhatsApp opt-in */}
              <div className="flex items-center justify-between rounded-lg border border-border p-4">
                <div className="flex items-start gap-3">
                  <MessageSquare className="w-5 h-5 text-secondary mt-0.5" />
                  <div>
                    <Label htmlFor="whatsapp" className="text-foreground font-medium">
                      WhatsApp Notifications
                    </Label>
                    <p className="text-muted-foreground text-sm">
                      Get instant alerts when new leads match your area
                    </p>
                  </div>
                </div>
                <Switch
                  id="whatsapp"
                  checked={whatsappOptin}
                  onCheckedChange={setWhatsappOptin}
                />
              </div>

              {/* Test WhatsApp button */}
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
                  Send Test WhatsApp Message
                </Button>
              )}

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

          {/* Danger zone */}
          <div className="mt-8 p-6 rounded-2xl border border-destructive/30 bg-destructive/5">
            <h2 className="font-heading text-lg font-semibold text-foreground mb-2">
              Danger Zone
            </h2>
            <p className="text-muted-foreground text-sm mb-4">
              Need to delete your account? Contact our support team and we'll help you.
            </p>
            <a href="mailto:support@deepcleanuk.com">
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
