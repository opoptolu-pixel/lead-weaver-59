import { useState } from "react";
import { Link } from "react-router-dom";
import { 
  Sparkles, 
  CheckCircle2, 
  Clock, 
  Shield, 
  Star,
  Loader2,
  ArrowRight,
  Phone,
  Mail,
  MapPin
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Logo } from "@/components/Logo";
import { Footer } from "@/components/Footer";

const jobTypes = [
  "End of Tenancy",
  "Deep Clean",
  "Regular Clean",
  "Carpet Cleaning",
  "Oven Cleaning",
  "Window Cleaning",
  "Office Clean",
  "Move-In Clean",
  "Post-Construction",
  "One-Off Clean",
];

export default function RequestCleaning() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [referenceId, setReferenceId] = useState("");
  const [formData, setFormData] = useState({
    customerName: "",
    customerEmail: "",
    customerPhone: "",
    customerAddress: "",
    postcode: "",
    jobType: "",
    preferredDate: "",
    jobDescription: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const { data, error } = await supabase.functions.invoke("submit-cleaning-request", {
        body: formData,
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setReferenceId(data.referenceId);
      setIsSubmitted(true);
      toast.success("Your cleaning request has been submitted!");
    } catch (error: any) {
      console.error("Error submitting request:", error);
      toast.error(error.message || "Failed to submit request. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // Get tomorrow's date as minimum date
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().split("T")[0];

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="bg-primary border-b border-border">
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-between h-20">
              <Link to="/">
                <Logo size="md" />
              </Link>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 py-20">
          <div className="max-w-lg mx-auto text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-10 h-10 text-green-600" />
            </div>
            <h1 className="font-heading text-3xl font-bold text-foreground mb-4">
              Request Submitted!
            </h1>
            <p className="text-muted-foreground text-lg mb-6">
              Your cleaning request has been received. A verified cleaning professional will contact you within 24 hours.
            </p>
            <div className="bg-muted rounded-xl p-6 mb-8">
              <p className="text-sm text-muted-foreground mb-2">Your Reference Number</p>
              <p className="font-heading text-2xl font-bold text-foreground">{referenceId}</p>
            </div>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">What happens next?</p>
              <div className="text-left space-y-3">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-secondary flex-shrink-0 mt-0.5" />
                  <p className="text-foreground">Your request is matched with local cleaners</p>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-secondary flex-shrink-0 mt-0.5" />
                  <p className="text-foreground">A verified professional will call you</p>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-secondary flex-shrink-0 mt-0.5" />
                  <p className="text-foreground">Compare quotes and book your clean</p>
                </div>
              </div>
            </div>
            <Link to="/" className="block mt-8">
              <Button variant="outline">Return to Home</Button>
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-primary border-b border-border">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-20">
            <Link to="/">
              <Logo size="md" />
            </Link>
            <div className="flex items-center gap-3">
              <Link to="/auth">
                <Button variant="outlineHero" size="sm">
                  I'm a Cleaner
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-hero-gradient py-16 lg:py-24">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 bg-secondary/20 backdrop-blur-sm border border-secondary/30 rounded-full px-4 py-2 mb-6">
              <Sparkles className="w-4 h-4 text-secondary" />
              <span className="text-secondary-foreground text-sm font-medium">
                Free Quote Request
              </span>
            </div>
            <h1 className="font-heading text-4xl md:text-5xl font-bold text-primary-foreground mb-6">
              Get Your Home <span className="text-secondary">Sparkling Clean</span>
            </h1>
            <p className="text-lg text-primary-foreground/80 mb-8 max-w-xl mx-auto">
              Connect with verified local cleaning professionals. Get free quotes within 24 hours.
            </p>
          </div>
        </div>
      </section>

      {/* Form Section */}
      <section className="py-16 lg:py-24 -mt-12">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-5 gap-12 max-w-6xl mx-auto">
            {/* Form */}
            <div className="lg:col-span-3">
              <div className="bg-card rounded-2xl shadow-elevated border border-border p-8">
                <h2 className="font-heading text-2xl font-bold text-foreground mb-6">
                  Tell Us About Your Cleaning Needs
                </h2>

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Your Name *
                      </label>
                      <Input
                        name="customerName"
                        value={formData.customerName}
                        onChange={handleChange}
                        placeholder="John Smith"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Phone Number *
                      </label>
                      <Input
                        name="customerPhone"
                        type="tel"
                        value={formData.customerPhone}
                        onChange={handleChange}
                        placeholder="07700 900000"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Email Address *
                    </label>
                    <Input
                      name="customerEmail"
                      type="email"
                      value={formData.customerEmail}
                      onChange={handleChange}
                      placeholder="john@example.co.uk"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Property Address *
                    </label>
                    <Input
                      name="customerAddress"
                      value={formData.customerAddress}
                      onChange={handleChange}
                      placeholder="123 High Street, Flat 2"
                      required
                    />
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Postcode *
                      </label>
                      <Input
                        name="postcode"
                        value={formData.postcode}
                        onChange={handleChange}
                        placeholder="SW1A 1AA"
                        required
                        className="uppercase"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Preferred Date *
                      </label>
                      <Input
                        name="preferredDate"
                        type="date"
                        value={formData.preferredDate}
                        onChange={handleChange}
                        min={minDate}
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Type of Clean *
                    </label>
                    <Select
                      value={formData.jobType}
                      onValueChange={(value) => setFormData({ ...formData, jobType: value })}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a cleaning type" />
                      </SelectTrigger>
                      <SelectContent>
                        {jobTypes.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Additional Details (Optional)
                    </label>
                    <Textarea
                      name="jobDescription"
                      value={formData.jobDescription}
                      onChange={handleChange}
                      placeholder="E.g., Number of bedrooms, specific areas to focus on, any access instructions..."
                      rows={4}
                    />
                  </div>

                  <Button
                    type="submit"
                    variant="cta"
                    size="lg"
                    className="w-full gap-2"
                    disabled={isSubmitting || !formData.jobType}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        Get Free Quotes
                        <ArrowRight className="w-5 h-5" />
                      </>
                    )}
                  </Button>

                  <p className="text-xs text-muted-foreground text-center">
                    By submitting, you agree to our{" "}
                    <Link to="/terms-of-use" className="text-secondary hover:underline">
                      Terms of Use
                    </Link>{" "}
                    and{" "}
                    <Link to="/privacy-policy" className="text-secondary hover:underline">
                      Privacy Policy
                    </Link>
                  </p>
                </form>
              </div>
            </div>

            {/* Benefits Sidebar */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-card rounded-2xl border border-border p-6">
                <h3 className="font-heading text-lg font-bold text-foreground mb-4">
                  Why Choose Deep Clean UK?
                </h3>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-secondary/20 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Shield className="w-5 h-5 text-secondary" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Verified Professionals</p>
                      <p className="text-sm text-muted-foreground">
                        All cleaners are vetted and background-checked
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-secondary/20 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Clock className="w-5 h-5 text-secondary" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Quick Response</p>
                      <p className="text-sm text-muted-foreground">
                        Get quotes within 24 hours
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-secondary/20 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Star className="w-5 h-5 text-secondary" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">No Obligation</p>
                      <p className="text-sm text-muted-foreground">
                        Compare quotes and choose the best
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-muted rounded-2xl p-6">
                <h3 className="font-heading text-lg font-bold text-foreground mb-4">
                  Need Help?
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Phone className="w-4 h-4 text-secondary" />
                    <span className="text-foreground">0800 123 4567</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Mail className="w-4 h-4 text-secondary" />
                    <span className="text-foreground">help@deepcleanuk.com</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <MapPin className="w-4 h-4 text-secondary" />
                    <span className="text-foreground">Serving all of the UK</span>
                  </div>
                </div>
              </div>

              <div className="bg-secondary/10 rounded-2xl p-6 border border-secondary/20">
                <p className="text-sm text-foreground">
                  <span className="font-semibold">100% Free Service</span> — No fees, no hidden charges. 
                  Simply submit your request and local cleaners will contact you with quotes.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}