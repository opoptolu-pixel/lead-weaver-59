import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Building,
  Phone,
  MapPin,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  ShieldCheck,
  Users,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Logo } from "@/components/Logo";
import { cn } from "@/lib/utils";
import {
  EmailNotificationSettings,
  EmailPreferences,
  defaultEmailPreferences,
} from "@/components/EmailNotificationSettings";

const TOTAL_STEPS = 4;

interface OnboardingData {
  contactName: string;
  businessName: string;
  phone: string;
  postcode: string;
  whatsappOptin: boolean;
  emailPreferences: EmailPreferences;
}

export default function Onboarding() {
  const { user, profile, refreshProfile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<OnboardingData>({
    contactName: "",
    businessName: "",
    phone: "",
    postcode: "",
    whatsappOptin: false,
    emailPreferences: defaultEmailPreferences,
  });

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  // Redirect if already onboarded
  useEffect(() => {
    if (profile?.business_name && profile?.phone && profile?.postcode) {
      navigate("/dashboard");
    }
  }, [profile, navigate]);

  // Populate with existing data
  useEffect(() => {
    if (profile) {
      setData({
        contactName: profile.contact_name || "",
        businessName: profile.business_name || "",
        phone: profile.phone || "",
        postcode: profile.postcode || "",
        whatsappOptin: profile.whatsapp_optin || false,
        emailPreferences: defaultEmailPreferences,
      });
    }
  }, [profile]);

  const progress = (currentStep / TOTAL_STEPS) * 100;

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return data.contactName.trim().length >= 2;
      case 2:
        return data.businessName.trim().length >= 2;
      case 3:
        return data.phone.trim().length >= 10 && data.postcode.trim().length >= 5;
      case 4:
        return true; // Preferences step is optional
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (currentStep < TOTAL_STEPS) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = async () => {
    if (!user) return;
    
    setSaving(true);
    try {
      const isNewBusiness = !profile?.business_name;
      
      const { error } = await supabase
        .from("profiles")
        .update({
          contact_name: data.contactName.trim(),
          business_name: data.businessName.trim(),
          phone: data.phone.trim(),
          postcode: data.postcode.trim().toUpperCase(),
          whatsapp_optin: data.whatsappOptin,
        })
        .eq("user_id", user.id);

      if (error) throw error;

      // Log business signup/onboarding activity
      await supabase.from("activity_logs").insert({
        user_id: user.id,
        entity_type: "business",
        entity_id: user.id,
        action: isNewBusiness ? "signup" : "profile_update",
        details: {
          business_name: data.businessName.trim(),
          contact_name: data.contactName.trim(),
          postcode: data.postcode.trim().toUpperCase(),
          whatsapp_optin: data.whatsappOptin,
        },
      });

      // Add to email_subscribers if new business signup
      if (isNewBusiness && user.email) {
        await supabase.from("email_subscribers").insert({
          email: user.email,
          name: data.contactName.trim() || data.businessName.trim(),
          source: "business_signup",
          source_id: user.id,
        }).select().maybeSingle(); // Ignore if already exists
      }

      await refreshProfile();
      toast.success("Welcome to Cleanda! Your profile is set up.");
      navigate("/dashboard");
    } catch (error) {
      console.error("Error saving profile:", error);
      toast.error("Failed to save profile. Please try again.");
    } finally {
      setSaving(false);
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
    <div className="min-h-screen bg-gradient-to-b from-primary to-primary/90 flex flex-col">
      {/* Header */}
      <header className="container mx-auto px-4 py-6">
        <Logo size="md" variant="white" />
      </header>

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-lg">
          {/* Progress indicator */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <span className="text-primary-foreground/80 text-sm">
                Step {currentStep} of {TOTAL_STEPS}
              </span>
              <span className="text-primary-foreground/80 text-sm">
                {Math.round(progress)}% complete
              </span>
            </div>
            <Progress value={progress} className="h-2 bg-primary-foreground/20" />
          </div>

          {/* Step card */}
          <div className="bg-white rounded-3xl shadow-2xl p-8 md:p-10">
            {/* Step 1: Your Name */}
            {currentStep === 1 && (
              <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="w-14 h-14 rounded-2xl bg-secondary/10 flex items-center justify-center mb-6">
                  <Users className="w-7 h-7 text-secondary" />
                </div>
                <h1 className="font-heading text-2xl md:text-3xl font-bold text-gray-900 mb-2">
                  Welcome! What's your name?
                </h1>
                <p className="text-gray-500 mb-8">
                  We'll use this to personalize your experience
                </p>

                <div className="space-y-2">
                  <Label htmlFor="contactName" className="text-gray-700">Your full name</Label>
                  <Input
                    id="contactName"
                    placeholder="e.g., John Smith"
                    value={data.contactName}
                    onChange={(e) => setData({ ...data, contactName: e.target.value })}
                    className="h-12 text-lg border-2 border-gray-200 focus:border-primary rounded-xl"
                    autoFocus
                  />
                </div>
              </div>
            )}

            {/* Step 2: Business Name */}
            {currentStep === 2 && (
              <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="w-14 h-14 rounded-2xl bg-secondary/10 flex items-center justify-center mb-6">
                  <Building className="w-7 h-7 text-secondary" />
                </div>
                <h1 className="font-heading text-2xl md:text-3xl font-bold text-gray-900 mb-2">
                  What's your business called?
                </h1>
                <p className="text-gray-500 mb-8">
                  This will appear on your profile and communications
                </p>

                <div className="space-y-2">
                  <Label htmlFor="businessName" className="text-gray-700">Business name</Label>
                  <Input
                    id="businessName"
                    placeholder="e.g., Sparkle Clean Services"
                    value={data.businessName}
                    onChange={(e) => setData({ ...data, businessName: e.target.value })}
                    className="h-12 text-lg border-2 border-gray-200 focus:border-primary rounded-xl"
                    autoFocus
                  />
                </div>
              </div>
            )}

            {/* Step 3: Contact & Location */}
            {currentStep === 3 && (
              <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="w-14 h-14 rounded-2xl bg-secondary/10 flex items-center justify-center mb-6">
                  <MapPin className="w-7 h-7 text-secondary" />
                </div>
                <h1 className="font-heading text-2xl md:text-3xl font-bold text-gray-900 mb-2">
                  Where are you based?
                </h1>
                <p className="text-gray-500 mb-8">
                  We'll show you leads in your service area
                </p>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone" className="text-gray-700">Phone number (with country code)</Label>
                    <div className="relative">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <Input
                        id="phone"
                        type="tel"
                        placeholder="+447700900000"
                        value={data.phone}
                        onChange={(e) => setData({ ...data, phone: e.target.value })}
                        className="pl-12 h-12 text-lg border-2 border-gray-200 focus:border-primary rounded-xl"
                        autoFocus
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="postcode" className="text-gray-700">Service area postcode</Label>
                    <div className="relative">
                      <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <Input
                        id="postcode"
                        placeholder="SW1A 1AA"
                        value={data.postcode}
                        onChange={(e) => setData({ ...data, postcode: e.target.value.toUpperCase() })}
                        className="pl-12 h-12 text-lg border-2 border-gray-200 focus:border-primary rounded-xl uppercase"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 4: Preferences */}
            {currentStep === 4 && (
              <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="w-14 h-14 rounded-2xl bg-secondary/10 flex items-center justify-center mb-6">
                  <Sparkles className="w-7 h-7 text-secondary" />
                </div>
                <h1 className="font-heading text-2xl md:text-3xl font-bold text-gray-900 mb-2">
                  Almost done!
                </h1>
                <p className="text-gray-500 mb-8">
                  Set up your notification preferences
                </p>

                <div className="space-y-6">
                  <div className="flex items-center justify-between p-4 rounded-xl border-2 border-gray-200 hover:border-secondary/50 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
                        <Phone className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <Label className="text-gray-900 font-medium cursor-pointer">
                          WhatsApp Notifications
                        </Label>
                        <p className="text-gray-500 text-sm">
                          Get instant alerts for new leads
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={data.whatsappOptin}
                      onCheckedChange={(checked) => setData({ ...data, whatsappOptin: checked })}
                    />
                  </div>

                  {/* Email Notification Settings */}
                  <EmailNotificationSettings
                    preferences={data.emailPreferences}
                    onChange={(prefs) => setData({ ...data, emailPreferences: prefs })}
                    compact
                  />

                  {/* Benefits summary */}
                  <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                    <p className="text-gray-700 font-medium text-sm">You're all set to:</p>
                    <div className="space-y-2">
                      {[
                        "Browse exclusive cleaning leads",
                        "Unlock customer contact details",
                        "Track job status and performance",
                      ].map((benefit, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                          <span className="text-gray-600 text-sm">{benefit}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-100">
              {currentStep > 1 ? (
                <Button
                  variant="ghost"
                  onClick={handleBack}
                  className="gap-2 text-gray-600"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </Button>
              ) : (
                <div />
              )}

              <Button
                variant="cta"
                size="lg"
                onClick={handleNext}
                disabled={!canProceed() || saving}
                className="gap-2 min-w-[140px]"
              >
                {saving ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : currentStep === TOTAL_STEPS ? (
                  <>
                    Get Started
                    <CheckCircle2 className="w-5 h-5" />
                  </>
                ) : (
                  <>
                    Continue
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Skip link */}
          {currentStep < TOTAL_STEPS && (
            <p className="text-center mt-6">
              <button
                onClick={() => navigate("/dashboard")}
                className="text-primary-foreground/60 hover:text-primary-foreground text-sm underline"
              >
                Skip for now, I'll complete later
              </button>
            </p>
          )}
        </div>
      </main>

      {/* Trust badges */}
      <footer className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-center gap-6 text-primary-foreground/60 text-sm">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4" />
            <span>Secure & Private</span>
          </div>
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            <span>500+ Businesses</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
