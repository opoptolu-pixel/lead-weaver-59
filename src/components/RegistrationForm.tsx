import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Shield, CheckCircle, MessageCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export const RegistrationForm = () => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    businessName: "",
    contactName: "",
    postcode: "",
    phone: "",
    email: "",
    whatsappOptIn: false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const { error } = await supabase.from("business_inquiries").insert({
        business_name: formData.businessName,
        contact_name: formData.contactName,
        postcode: formData.postcode,
        phone: formData.phone,
        email: formData.email,
        whatsapp_optin: formData.whatsappOptIn,
      });

      if (error) throw error;

      toast({
        title: "Application Received!",
        description: "We'll review your application and get back to you within 24 hours.",
      });
      setFormData({
        businessName: "",
        contactName: "",
        postcode: "",
        phone: "",
        email: "",
        whatsappOptIn: false,
      });
    } catch (error: any) {
      toast({
        title: "Submission Failed",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <section id="registration" className="py-20 lg:py-28 bg-hero-gradient relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0">
        <div className="absolute top-20 right-20 w-72 h-72 bg-secondary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 left-20 w-96 h-96 bg-secondary/5 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 relative">
        <div className="max-w-4xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            {/* Left content */}
            <div className="text-primary-foreground">
              <span className="inline-block text-secondary font-semibold text-sm uppercase tracking-wider mb-4">
                Join the Network
              </span>
              <h2 className="font-heading text-3xl md:text-4xl font-bold mb-6">
                Register Your Cleaning Business
              </h2>
              <p className="text-primary-foreground/80 text-lg mb-8">
                Start receiving exclusive leads in your area. We only work with vetted, professional cleaners.
              </p>

              {/* Trust badges */}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-secondary/20 rounded-lg flex items-center justify-center">
                    <Shield className="w-5 h-5 text-secondary" />
                  </div>
                  <div>
                    <p className="font-semibold">Vetted Cleaners Only</p>
                    <p className="text-primary-foreground/70 text-sm">We protect our client's trust</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-secondary/20 rounded-lg flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-secondary" />
                  </div>
                  <div>
                    <p className="font-semibold">Exclusive Leads</p>
                    <p className="text-primary-foreground/70 text-sm">No competing for the same job</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-secondary/20 rounded-lg flex items-center justify-center">
                    <MessageCircle className="w-5 h-5 text-secondary" />
                  </div>
                  <div>
                    <p className="font-semibold">WhatsApp Delivery</p>
                    <p className="text-primary-foreground/70 text-sm">Get leads straight to your phone</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right form */}
            <div className="bg-card rounded-2xl p-8 shadow-elevated border border-border">
              <h3 className="font-heading text-xl font-bold text-foreground mb-6">
                Apply to Join
              </h3>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label htmlFor="businessName" className="block text-sm font-medium text-foreground mb-2">
                    Business Name
                  </label>
                  <Input
                    id="businessName"
                    name="businessName"
                    value={formData.businessName}
                    onChange={handleChange}
                    placeholder="e.g. Sparkle Clean Ltd"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="contactName" className="block text-sm font-medium text-foreground mb-2">
                    Your Name
                  </label>
                  <Input
                    id="contactName"
                    name="contactName"
                    value={formData.contactName}
                    onChange={handleChange}
                    placeholder="John Smith"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="postcode" className="block text-sm font-medium text-foreground mb-2">
                      Postcode Area
                    </label>
                    <Input
                      id="postcode"
                      name="postcode"
                      value={formData.postcode}
                      onChange={handleChange}
                      placeholder="e.g. M14"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="phone" className="block text-sm font-medium text-foreground mb-2">
                      Phone Number
                    </label>
                    <Input
                      id="phone"
                      name="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={handleChange}
                      placeholder="07700 900000"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-foreground mb-2">
                    Email Address
                  </label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="john@sparkleclean.co.uk"
                    required
                  />
                </div>

                <div className="flex items-start gap-3">
                  <Checkbox
                    id="whatsappOptIn"
                    checked={formData.whatsappOptIn}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, whatsappOptIn: checked as boolean })
                    }
                  />
                  <label htmlFor="whatsappOptIn" className="text-sm text-muted-foreground cursor-pointer">
                    I'd like to receive leads via WhatsApp (recommended)
                  </label>
                </div>

                <Button variant="cta" size="lg" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? "Submitting..." : "Submit Application"}
                </Button>

                <p className="text-xs text-muted-foreground text-center">
                  By submitting, you agree to our Terms of Service and Privacy Policy
                </p>
              </form>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
