import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { HelpCircle, Mail, Phone, MapPin } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { trackEnquiry } from "@/lib/analytics";

export const RegistrationForm = () => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    contactName: "",
    phone: "",
    email: "",
    whatsappOptIn: false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Insert into business_inquiries
      const { data: inquiry, error } = await supabase.from("business_inquiries").insert({
        business_name: "Inquiry - Learn More",
        contact_name: formData.contactName,
        postcode: "N/A",
        phone: formData.phone,
        email: formData.email,
        whatsapp_optin: formData.whatsappOptIn,
      }).select('id').single();

      if (error) throw error;

      // Also add to email_subscribers for marketing campaigns
      await supabase.from("email_subscribers").insert({
        email: formData.email,
        name: formData.contactName,
        source: "business_inquiry",
        source_id: inquiry?.id,
      }).select().maybeSingle(); // Ignore if already exists

      // Track as enquiry (not lead)
      trackEnquiry({ source: 'business_enquiry' });
      if (window.fbq) {
        window.fbq('track', 'Contact');
      }

      toast({
        title: "Thanks for your interest!",
        description: "We'll be in touch within 24 hours to tell you more about our service.",
      });
      setFormData({
        contactName: "",
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
    <section id="learn-more" className="py-20 lg:py-28 bg-hero-gradient relative overflow-hidden">
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
                Have Questions?
              </span>
              <h2 className="font-heading text-3xl md:text-4xl font-bold mb-6">
                Want to Learn More About Us?
              </h2>
              <p className="text-primary-foreground/80 text-lg mb-8">
                Not ready to sign up yet? No problem! Fill in your details and we'll get in touch to answer any questions you may have.
              </p>

              {/* Contact info */}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-secondary/20 rounded-lg flex items-center justify-center">
                    <HelpCircle className="w-5 h-5 text-secondary" />
                  </div>
                  <div>
                    <p className="font-semibold">Friendly Support</p>
                    <p className="text-primary-foreground/70 text-sm">We're here to help you succeed</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-secondary/20 rounded-lg flex items-center justify-center">
                    <Mail className="w-5 h-5 text-secondary" />
                  </div>
                  <div>
                    <p className="font-semibold">Quick Response</p>
                    <p className="text-primary-foreground/70 text-sm">We'll get back to you within 24 hours</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-secondary/20 rounded-lg flex items-center justify-center">
                    <MapPin className="w-5 h-5 text-secondary" />
                  </div>
                  <div>
                    <p className="font-semibold">UK Based</p>
                    <p className="text-primary-foreground/70 text-sm">Serving cleaning businesses nationwide</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right form */}
            <div className="bg-card rounded-2xl p-8 shadow-elevated border border-border">
              <h3 className="font-heading text-xl font-bold text-foreground mb-6">
                Get in Touch
              </h3>

              <form onSubmit={handleSubmit} className="space-y-5">
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
                    placeholder="john@example.co.uk"
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
                    I'd prefer to be contacted via WhatsApp
                  </label>
                </div>

                <Button variant="cta" size="lg" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? "Sending..." : "Send Enquiry"}
                </Button>

                <p className="text-xs text-muted-foreground text-center">
                  We respect your privacy and won't share your details
                </p>
              </form>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};