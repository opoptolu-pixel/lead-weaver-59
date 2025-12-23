import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { 
  Sparkles, 
  Loader2,
  ArrowRight,
  ArrowLeft,
  Home,
  Truck,
  Droplets,
  Sofa,
  BedDouble,
  Building2,
  Layers,
  MapPin,
  User,
  Mail,
  Phone,
  Calendar
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Logo } from "@/components/Logo";
import { cn } from "@/lib/utils";

// Phase 1 Job Types - Bundled jobs that naturally exceed £100
const cleaningTypes = [
  { id: "carpet-2-3-rooms", label: "Carpet Cleaning (2–3 Rooms)", icon: Layers, color: "bg-amber-100 text-amber-600", value: "from £100" },
  { id: "sofa-carpet", label: "Sofa + Carpet Cleaning", icon: Sofa, color: "bg-violet-100 text-violet-600", value: "from £120" },
  { id: "sofa-mattress", label: "Sofa + Mattress Cleaning", icon: BedDouble, color: "bg-rose-100 text-rose-600", value: "from £100" },
  { id: "carpet-mattress", label: "Carpet + Mattress Cleaning", icon: Droplets, color: "bg-sky-100 text-sky-600", value: "from £110" },
  { id: "3-rooms-deep-clean", label: "Deep Clean (3+ Rooms)", icon: Sparkles, color: "bg-emerald-100 text-emerald-600", value: "from £140" },
  { id: "end-of-tenancy", label: "End of Tenancy Clean", icon: Home, color: "bg-indigo-100 text-indigo-600", value: "from £150" },
  { id: "airbnb-refresh", label: "Airbnb / Short-Let Refresh", icon: Building2, color: "bg-teal-100 text-teal-600", value: "from £130" },
  { id: "move-in-out", label: "Move-In / Move-Out Clean", icon: Truck, color: "bg-orange-100 text-orange-600", value: "from £140" },
  { id: "post-tenancy-upholstery", label: "Post-Tenancy Carpet & Upholstery", icon: Layers, color: "bg-pink-100 text-pink-600", value: "from £120" },
  { id: "one-off-deep", label: "One-Off Deep Clean", icon: Sparkles, color: "bg-cyan-100 text-cyan-600", value: "from £100" },
];

const TOTAL_STEPS = 4;

export default function RequestCleaning() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    jobType: "",
    jobValue: "",
    postcode: "",
    customerName: "",
    customerEmail: "",
    customerPhone: "",
    dateFrom: "",
    dateTo: "",
  });

  const progress = (currentStep / TOTAL_STEPS) * 100;

  const handleSubmit = async () => {
    setIsSubmitting(true);

    try {
      const { data, error } = await supabase.functions.invoke("submit-cleaning-request", {
        body: {
          ...formData,
          customerAddress: formData.postcode,
          preferredDate: formData.dateFrom,
          jobDescription: formData.dateTo ? `Preferred dates: ${formData.dateFrom} to ${formData.dateTo}` : "",
          estimatedValue: formData.jobValue,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      toast.success("Your cleaning request has been submitted!");
      navigate("/request-cleaning/thank-you");
    } catch (error: any) {
      console.error("Error submitting request:", error);
      toast.error(error.message || "Failed to submit request. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return formData.jobType !== "";
      case 2:
        return formData.postcode.length >= 3;
      case 3:
        return formData.customerName && formData.customerEmail && formData.customerPhone;
      case 4:
        return formData.dateFrom !== "";
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (currentStep < TOTAL_STEPS) {
      setCurrentStep(currentStep + 1);
    } else {
      handleSubmit();
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleJobTypeSelect = (type: typeof cleaningTypes[0]) => {
    setFormData({ ...formData, jobType: type.label, jobValue: type.value });
  };

  // Get tomorrow's date as minimum date
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().split("T")[0];

  return (
    <div className="min-h-screen bg-primary flex flex-col">
      {/* Header */}
      <header className="bg-primary/80 backdrop-blur-sm border-b border-white/10 sticky top-0 z-50">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <Link to="/">
              <Logo size="sm" />
            </Link>
            <Link to="/" className="text-primary-foreground/80 hover:text-primary-foreground text-sm">
              Back to Home
            </Link>
          </div>
        </div>
      </header>

      {/* Main Hero Form Section */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-8 lg:py-12">
        <div className="w-full max-w-2xl">
          {/* Hero Headline */}
          <div className="text-center mb-8">
            <h1 className="font-heading text-4xl lg:text-5xl font-bold text-white mb-4">
              Get Your Home <span className="text-secondary">Sparkling Clean</span>
            </h1>
            <p className="text-white/80 text-lg lg:text-xl max-w-lg mx-auto">
              Connect with verified local cleaners. Get free quotes within 24 hours.
            </p>
          </div>

          {/* Step Indicator */}
          <div className="text-center mb-6">
            <span className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-2">
              <Sparkles className="w-4 h-4 text-secondary" />
              <span className="text-white/90 text-sm font-medium">
                Step {currentStep} of {TOTAL_STEPS}
              </span>
            </span>
          </div>

          {/* Form Card */}
          <div className="bg-white rounded-3xl shadow-2xl p-8 lg:p-12 min-h-[400px] flex flex-col">
            {/* Step 1: Type of Clean */}
            {currentStep === 1 && (
              <div className="flex-1 animate-in fade-in slide-in-from-right-4 duration-300">
                <h2 className="font-heading text-2xl lg:text-3xl font-bold text-gray-900 text-center mb-2">
                  What type of cleaning do you need?
                </h2>
                <p className="text-gray-500 text-center mb-8">
                  Select a service package (all jobs £100+)
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:gap-4">
                  {cleaningTypes.map((type) => {
                    const Icon = type.icon;
                    const isSelected = formData.jobType === type.label;
                    return (
                      <button
                        key={type.id}
                        type="button"
                        onClick={() => handleJobTypeSelect(type)}
                        className={cn(
                          "flex items-center gap-3 p-4 rounded-xl border-2 transition-all duration-200 text-left group hover:border-primary hover:bg-primary/5",
                          isSelected 
                            ? "border-primary bg-primary/10 shadow-md ring-2 ring-primary/20" 
                            : "border-gray-200 bg-white"
                        )}
                      >
                        <div className={cn(
                          "w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0",
                          type.color
                        )}>
                          <Icon className="w-6 h-6" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className={cn(
                            "font-medium text-sm lg:text-base transition-colors block",
                            isSelected ? "text-primary" : "text-gray-700"
                          )}>
                            {type.label}
                          </span>
                          <span className="text-xs text-gray-500">{type.value}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Step 2: Postcode */}
            {currentStep === 2 && (
              <div className="flex-1 flex flex-col animate-in fade-in slide-in-from-right-4 duration-300">
                <h2 className="font-heading text-2xl lg:text-3xl font-bold text-gray-900 text-center mb-2">
                  Where do you need cleaning?
                </h2>
                <p className="text-gray-500 text-center mb-8">
                  Enter your postcode to find cleaners in your area
                </p>

                <div className="flex-1 flex items-center justify-center">
                  <div className="w-full max-w-sm">
                    <div className="relative">
                      <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <Input
                        value={formData.postcode}
                        onChange={(e) => setFormData({ ...formData, postcode: e.target.value.toUpperCase() })}
                        placeholder="e.g. SW1A 1AA"
                        className="pl-12 h-14 text-lg text-center uppercase tracking-wider border-2 border-gray-200 focus:border-primary rounded-xl"
                        autoFocus
                      />
                    </div>
                    <p className="text-center text-sm text-gray-400 mt-3">
                      You'll provide your full address when contacted
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Contact Details */}
            {currentStep === 3 && (
              <div className="flex-1 flex flex-col animate-in fade-in slide-in-from-right-4 duration-300">
                <h2 className="font-heading text-2xl lg:text-3xl font-bold text-gray-900 text-center mb-2">
                  How can cleaners reach you?
                </h2>
                <p className="text-gray-500 text-center mb-8">
                  Enter your contact details for quotes
                </p>

                <div className="flex-1 flex items-center justify-center">
                  <div className="w-full max-w-sm space-y-4">
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <Input
                        value={formData.customerName}
                        onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                        placeholder="Your name"
                        className="pl-12 h-12 border-2 border-gray-200 focus:border-primary rounded-xl"
                        autoFocus
                      />
                    </div>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <Input
                        type="email"
                        value={formData.customerEmail}
                        onChange={(e) => setFormData({ ...formData, customerEmail: e.target.value })}
                        placeholder="Email address"
                        className="pl-12 h-12 border-2 border-gray-200 focus:border-primary rounded-xl"
                      />
                    </div>
                    <div className="relative">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <Input
                        type="tel"
                        value={formData.customerPhone}
                        onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                        placeholder="Phone number"
                        className="pl-12 h-12 border-2 border-gray-200 focus:border-primary rounded-xl"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 4: Date Range */}
            {currentStep === 4 && (
              <div className="flex-1 flex flex-col animate-in fade-in slide-in-from-right-4 duration-300">
                <h2 className="font-heading text-2xl lg:text-3xl font-bold text-gray-900 text-center mb-2">
                  When would you like the cleaning?
                </h2>
                <p className="text-gray-500 text-center mb-8">
                  Select your preferred date range
                </p>

                <div className="flex-1 flex items-center justify-center">
                  <div className="w-full max-w-sm space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        From date
                      </label>
                      <div className="relative">
                        <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <Input
                          type="date"
                          value={formData.dateFrom}
                          onChange={(e) => setFormData({ ...formData, dateFrom: e.target.value })}
                          min={minDate}
                          className="pl-12 h-12 border-2 border-gray-200 focus:border-primary rounded-xl"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        To date <span className="text-gray-400">(optional)</span>
                      </label>
                      <div className="relative">
                        <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <Input
                          type="date"
                          value={formData.dateTo}
                          onChange={(e) => setFormData({ ...formData, dateTo: e.target.value })}
                          min={formData.dateFrom || minDate}
                          className="pl-12 h-12 border-2 border-gray-200 focus:border-primary rounded-xl"
                        />
                      </div>
                    </div>
                    <p className="text-center text-sm text-gray-400">
                      Flexible dates help cleaners accommodate your request
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-100">
              <Button
                type="button"
                variant="ghost"
                onClick={handleBack}
                disabled={currentStep === 1}
                className={cn(
                  "gap-2 text-gray-600",
                  currentStep === 1 && "invisible"
                )}
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </Button>

              <Button
                type="button"
                onClick={handleNext}
                disabled={!canProceed() || isSubmitting}
                className="gap-2 bg-secondary hover:bg-secondary/90 text-secondary-foreground px-8 h-12 rounded-xl shadow-lg shadow-secondary/30 font-semibold"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Submitting...
                  </>
                ) : currentStep === TOTAL_STEPS ? (
                  <>
                    Get Free Quotes
                    <ArrowRight className="w-5 h-5" />
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

          {/* Progress Bar */}
          <div className="mt-8">
            <div className="h-2 bg-white/20 rounded-full overflow-hidden">
              <div 
                className="h-full bg-secondary rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-center text-white/60 text-sm mt-3">
              {currentStep === TOTAL_STEPS ? "Almost done!" : `${Math.round(progress)}% complete`}
            </p>
          </div>

          {/* Trust badges */}
          <div className="flex items-center justify-center gap-6 mt-8 text-white/60 text-sm">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 bg-secondary rounded-full" />
              100% Free
            </span>
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 bg-secondary rounded-full" />
              No Obligation
            </span>
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 bg-secondary rounded-full" />
              Verified Cleaners
            </span>
          </div>
        </div>
      </main>

      {/* Footer note */}
      <footer className="py-4 text-center">
        <p className="text-white/40 text-xs">
          By submitting, you agree to our{" "}
          <Link to="/terms-of-use" className="text-white/60 hover:text-white underline">
            Terms
          </Link>{" "}
          and{" "}
          <Link to="/privacy-policy" className="text-white/60 hover:text-white underline">
            Privacy Policy
          </Link>
        </p>
      </footer>
    </div>
  );
}
