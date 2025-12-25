import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
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
  Calendar,
  Clock,
  ShieldCheck,
  BadgeCheck,
  ThumbsUp
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Logo } from "@/components/Logo";
import { Footer } from "@/components/Footer";
import { cn } from "@/lib/utils";
import { SEOHead } from "@/components/SEOHead";
import { trackCleaningRequest, trackFormStep } from "@/lib/analytics";

// Phase 1 + Phase 2 Job Types - Bundled jobs that exceed £100
const cleaningTypes = [
  // Phase 1 - Core Services (£100+)
  { id: "carpet-2-3-rooms", label: "Carpet Cleaning (2–3 Rooms)", icon: Layers, color: "bg-amber-100 text-amber-600", value: "from £100", phase: 1 },
  { id: "sofa-carpet", label: "Sofa + Carpet Cleaning", icon: Sofa, color: "bg-violet-100 text-violet-600", value: "from £120", phase: 1 },
  { id: "sofa-mattress", label: "Sofa + Mattress Cleaning", icon: BedDouble, color: "bg-rose-100 text-rose-600", value: "from £100", phase: 1 },
  { id: "carpet-mattress", label: "Carpet + Mattress Cleaning", icon: Droplets, color: "bg-sky-100 text-sky-600", value: "from £110", phase: 1 },
  { id: "3-rooms-deep-clean", label: "Deep Clean (3+ Rooms)", icon: Sparkles, color: "bg-emerald-100 text-emerald-600", value: "from £140", phase: 1 },
  { id: "end-of-tenancy", label: "End of Tenancy Clean", icon: Home, color: "bg-indigo-100 text-indigo-600", value: "from £150", phase: 1 },
  { id: "airbnb-refresh", label: "Airbnb / Short-Let Refresh", icon: Building2, color: "bg-teal-100 text-teal-600", value: "from £130", phase: 1 },
  { id: "move-in-out", label: "Move-In / Move-Out Clean", icon: Truck, color: "bg-orange-100 text-orange-600", value: "from £140", phase: 1 },
  { id: "post-tenancy-upholstery", label: "Post-Tenancy Carpet & Upholstery", icon: Layers, color: "bg-pink-100 text-pink-600", value: "from £120", phase: 1 },
  { id: "one-off-deep", label: "One-Off Deep Clean", icon: Sparkles, color: "bg-cyan-100 text-cyan-600", value: "from £100", phase: 1 },
  // Phase 2 - Commercial & Specialist (£120+)
  { id: "office-carpet-upholstery", label: "Office Carpet + Upholstery Clean", icon: Building2, color: "bg-blue-100 text-blue-600", value: "from £150", phase: 2 },
  { id: "post-construction", label: "Post-Construction Deep Clean", icon: Truck, color: "bg-slate-100 text-slate-600", value: "from £200", phase: 2 },
  { id: "large-window-interior", label: "Large Property Window + Interior", icon: Home, color: "bg-sky-100 text-sky-600", value: "from £180", phase: 2 },
  { id: "multi-room-upholstery", label: "Multi-Room + Upholstery Deep Clean", icon: Sofa, color: "bg-purple-100 text-purple-600", value: "from £160", phase: 2 },
];

const TOTAL_STEPS = 7;

// Property types for step 3
const propertyTypes = [
  { id: "house", label: "House" },
  { id: "flat", label: "Flat or Apartment" },
  { id: "bungalow", label: "Bungalow" },
  { id: "commercial", label: "A Commercial property" },
];

// Bedroom options for step 4
const bedroomOptions = [
  { id: "studio", label: "Studio" },
  { id: "0", label: "0 bedrooms" },
  { id: "1", label: "1 bedroom" },
  { id: "2", label: "2 bedrooms" },
  { id: "3", label: "3 bedrooms" },
  { id: "4", label: "4 bedrooms" },
  { id: "5+", label: "5+ bedrooms" },
];

// Frequency options for step 5
const frequencyOptions = [
  { id: "one-time", label: "One-time clean" },
  { id: "weekly", label: "Weekly" },
  { id: "twice-a-week", label: "Twice a week" },
  { id: "every-other-week", label: "Every other week" },
  { id: "monthly", label: "Once a month" },
  { id: "daily", label: "Daily" },
];

// UK Postcode validation regex - full postcode
const UK_POSTCODE_REGEX = /^([A-Z]{1,2}[0-9][0-9A-Z]?\s?[0-9][A-Z]{2})$/i;

// Check if it's at least a valid postcode prefix (outward code like M5, SW1A, etc.)
const UK_POSTCODE_PREFIX_REGEX = /^[A-Z]{1,2}[0-9][0-9A-Z]?$/i;

const validatePostcode = (postcode: string): boolean => {
  const cleaned = postcode.replace(/\s+/g, '').toUpperCase();
  return UK_POSTCODE_REGEX.test(cleaned);
};

const isValidPostcodePrefix = (postcode: string): boolean => {
  const cleaned = postcode.replace(/\s+/g, '').toUpperCase();
  return UK_POSTCODE_PREFIX_REGEX.test(cleaned) || UK_POSTCODE_REGEX.test(cleaned);
};

// UK Postcode regex used for validation in component

export default function RequestCleaning() {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Initialize state directly from location.state - runs once before first render
  const [currentStep, setCurrentStep] = useState(() => {
    const navState = location.state as { type?: string; postcode?: string } | null;
    const typeParam = navState?.type || "";
    const postcodeParam = (navState?.postcode || "").toUpperCase();
    const matchedType = cleaningTypes.find(t => t.id === typeParam);
    
    if (matchedType && postcodeParam) {
      const cleaned = postcodeParam.replace(/\s+/g, '');
      if (UK_POSTCODE_REGEX.test(cleaned)) {
        return 3; // Full postcode - go to contact details
      }
      return 2; // Partial - stay on postcode step
    } else if (matchedType) {
      return 2; // Go to postcode step
    }
    return 1;
  });
  
  const [formData, setFormData] = useState(() => {
    const navState = location.state as { type?: string; postcode?: string } | null;
    const typeParam = navState?.type || "";
    const postcodeParam = (navState?.postcode || "").toUpperCase();
    const matchedType = cleaningTypes.find(t => t.id === typeParam);
    
    return {
      jobType: matchedType?.label || "",
      jobValue: matchedType?.value || "",
      postcode: postcodeParam,
      propertyType: "",
      bedrooms: "",
      frequency: "",
      customerName: "",
      customerEmail: "",
      customerPhone: "",
      dateFrom: "",
      dateTo: "",
    };
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [postcodeError, setPostcodeError] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [isValidatingPhone, setIsValidatingPhone] = useState(false);

  // Scroll to top on page load only
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  const progress = (currentStep / TOTAL_STEPS) * 100;

  // Validate phone number using Twilio Lookup
  const validatePhone = async (phone: string): Promise<boolean> => {
    if (!phone || phone.length < 10) return false;
    
    setIsValidatingPhone(true);
    setPhoneError("");
    
    try {
      const { data, error } = await supabase.functions.invoke("validate-phone", {
        body: { phone },
      });

      if (error) {
        console.error("Phone validation error:", error);
        // Fail open - allow submission if validation service is down
        return true;
      }

      if (!data.valid) {
        setPhoneError(data.error || "Please enter a valid UK phone number");
        return false;
      }

      return true;
    } catch (err) {
      console.error("Phone validation exception:", err);
      // Fail open
      return true;
    } finally {
      setIsValidatingPhone(false);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);

    try {
      // Validate phone before submission
      const isPhoneValid = await validatePhone(formData.customerPhone);
      if (!isPhoneValid) {
        setIsSubmitting(false);
        toast.error("Please provide a valid phone number");
        return;
      }

      const { data, error } = await supabase.functions.invoke("submit-cleaning-request", {
        body: {
          ...formData,
          customerAddress: formData.postcode,
          preferredDate: formData.dateFrom,
          jobDescription: formData.dateTo ? `Preferred dates: ${formData.dateFrom} to ${formData.dateTo}` : "",
          estimatedValue: formData.jobValue,
          propertyType: formData.propertyType,
          bedrooms: formData.propertyType === "commercial" ? null : formData.bedrooms,
          frequency: formData.frequency,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.message || data.error);

      toast.success("Your cleaning request has been submitted!");
      // Pass form data via state for tracking on thank you page
      navigate("/request-cleaning/thank-you", {
        state: {
          jobType: formData.jobType,
          postcode: formData.postcode,
          estimatedValue: formData.jobValue,
        }
      });
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
        // Require a full valid postcode to proceed
        return formData.postcode.length >= 5 && validatePostcode(formData.postcode);
      case 3:
        return formData.propertyType !== "";
      case 4:
        // Skip bedrooms validation for commercial properties
        return formData.propertyType === "commercial" || formData.bedrooms !== "";
      case 5:
        return formData.frequency !== "";
      case 6:
        return formData.customerName && formData.customerEmail && formData.customerPhone && !phoneError;
      case 7:
        return formData.dateFrom !== "";
      default:
        return false;
    }
  };

  // Check if user has a valid prefix but not a complete postcode
  const hasPartialPostcode = formData.postcode.length >= 2 && 
    isValidPostcodePrefix(formData.postcode) && 
    !validatePostcode(formData.postcode);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const stepNames = ['Service Type', 'Location', 'Property Type', 'Bedrooms', 'Frequency', 'Contact Details', 'Preferred Dates'];
  
  // Should we skip the bedrooms step?
  const shouldSkipBedrooms = formData.propertyType === "commercial";

  const handleNext = () => {
    if (currentStep < TOTAL_STEPS) {
      let nextStep = currentStep + 1;
      
      // Skip bedrooms step (4) if commercial property
      if (nextStep === 4 && shouldSkipBedrooms) {
        nextStep = 5;
      }
      
      setCurrentStep(nextStep);
      scrollToTop();
      // Track step progression
      trackFormStep({
        formName: 'cleaning_request',
        stepNumber: nextStep,
        stepName: stepNames[nextStep - 1],
      });
    } else {
      handleSubmit();
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      let prevStep = currentStep - 1;
      
      // Skip bedrooms step (4) if commercial property when going back
      if (prevStep === 4 && shouldSkipBedrooms) {
        prevStep = 3;
      }
      
      setCurrentStep(prevStep);
      scrollToTop();
    }
  };

  const handleJobTypeSelect = (type: typeof cleaningTypes[0]) => {
    setFormData({ ...formData, jobType: type.label, jobValue: type.value });
    // Auto-advance to step 2 when selecting a cleaning type
    setCurrentStep(2);
    scrollToTop();
    // Track step progression
    trackFormStep({
      formName: 'cleaning_request',
      stepNumber: 2,
      stepName: 'Location',
    });
  };

  // Get tomorrow's date as minimum date
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().split("T")[0];

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Service",
        "name": "Professional Cleaning Service Request",
        "description": "Request free quotes from verified local cleaners for deep cleaning, end of tenancy, carpet cleaning and more across the UK.",
        "provider": {
          "@type": "Organization",
          "name": "Deep Clean UK",
          "@id": "https://deepcleanuk.com/#organization"
        },
        "areaServed": {
          "@type": "Country",
          "name": "United Kingdom"
        },
        "serviceType": [
          "Deep Cleaning",
          "End of Tenancy Cleaning", 
          "Carpet Cleaning",
          "Upholstery Cleaning",
          "Commercial Cleaning"
        ]
      },
      {
        "@type": "WebPage",
        "@id": "https://deepcleanuk.com/request-cleaning#webpage",
        "url": "https://deepcleanuk.com/request-cleaning",
        "name": "Request a Free Cleaning Quote | Deep Clean UK",
        "description": "Get free quotes from verified local cleaners. Request deep cleaning, end of tenancy, carpet cleaning and more.",
        "isPartOf": { "@id": "https://deepcleanuk.com/#website" },
        "breadcrumb": {
          "@type": "BreadcrumbList",
          "itemListElement": [
            {
              "@type": "ListItem",
              "position": 1,
              "name": "Home",
              "item": "https://deepcleanuk.com"
            },
            {
              "@type": "ListItem",
              "position": 2,
              "name": "Request Cleaning",
              "item": "https://deepcleanuk.com/request-cleaning"
            }
          ]
        }
      }
    ]
  };

  return (
    <div className="min-h-screen bg-primary flex flex-col">
      <SEOHead
        title="Get Free Cleaning Quotes in Minutes | Request a Cleaner | Deep Clean UK"
        description="Request free quotes from verified local cleaners. Choose your service, enter your postcode, and get contacted within 24 hours. No obligation, 100% free."
        canonical="https://deepcleanuk.com/request-cleaning"
        structuredData={structuredData}
      />
      {/* Header */}
      <header className="bg-primary/80 backdrop-blur-sm border-b border-white/10 sticky top-0 z-50">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <Logo size="sm" linkTo="/" />
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
              <div className="flex-1">
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
              <div className="flex-1 flex flex-col">
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
                        onChange={(e) => {
                          const value = e.target.value.toUpperCase();
                          setFormData({ ...formData, postcode: value });
                          if (value.length >= 5) {
                            setPostcodeError(validatePostcode(value) ? "" : "Please enter a valid UK postcode");
                          } else {
                            setPostcodeError("");
                          }
                        }}
                        placeholder="e.g. SW1A 1AA"
                        className={cn(
                          "pl-12 h-14 text-lg text-center uppercase tracking-wider border-2 rounded-xl",
                          postcodeError ? "border-red-500 focus:border-red-500" : "border-gray-200 focus:border-primary"
                        )}
                        autoFocus
                      />
                    </div>
                    {postcodeError ? (
                      <p className="text-center text-sm text-red-500 mt-3">{postcodeError}</p>
                    ) : hasPartialPostcode ? (
                      <p className="text-center text-sm text-amber-600 mt-3">
                        Please complete your full postcode (e.g. {formData.postcode}1 1AA)
                      </p>
                    ) : (
                      <p className="text-center text-sm text-gray-400 mt-3">
                        You'll provide your full address when contacted
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Property Type */}
            {currentStep === 3 && (
              <div className="flex-1 flex flex-col">
                <h2 className="font-heading text-2xl lg:text-3xl font-bold text-gray-900 text-center mb-2">
                  What kind of property needs cleaning?
                </h2>
                <p className="text-gray-500 text-center mb-8">
                  Get quotes for cleaners today!
                </p>

                <div className="flex-1">
                  <div className="bg-gray-50 rounded-2xl border border-gray-200 divide-y divide-gray-200 overflow-hidden">
                    {propertyTypes.map((type) => {
                      const isSelected = formData.propertyType === type.id;
                      return (
                        <label
                          key={type.id}
                          className={cn(
                            "flex items-center gap-4 p-4 cursor-pointer transition-colors hover:bg-gray-100",
                            isSelected && "bg-primary/5"
                          )}
                        >
                          <div className={cn(
                            "w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0",
                            isSelected ? "border-primary bg-primary" : "border-gray-300"
                          )}>
                            {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                          </div>
                          <span className={cn(
                            "text-base font-medium",
                            isSelected ? "text-primary" : "text-gray-700"
                          )}>
                            {type.label}
                          </span>
                          <input
                            type="radio"
                            name="propertyType"
                            value={type.id}
                            checked={isSelected}
                            onChange={() => setFormData({ ...formData, propertyType: type.id, bedrooms: type.id === "commercial" ? "" : formData.bedrooms })}
                            className="sr-only"
                          />
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Step 4: Bedrooms (skipped for commercial) */}
            {currentStep === 4 && (
              <div className="flex-1 flex flex-col">
                <h2 className="font-heading text-2xl lg:text-3xl font-bold text-gray-900 text-center mb-2">
                  How many bedroom(s) need cleaning?
                </h2>
                <p className="text-gray-500 text-center mb-8">
                  This helps us match you with the right cleaner
                </p>

                <div className="flex-1">
                  <div className="bg-gray-50 rounded-2xl border border-gray-200 divide-y divide-gray-200 overflow-hidden max-h-[400px] overflow-y-auto">
                    {bedroomOptions.map((option) => {
                      const isSelected = formData.bedrooms === option.id;
                      return (
                        <label
                          key={option.id}
                          className={cn(
                            "flex items-center gap-4 p-4 cursor-pointer transition-colors hover:bg-gray-100",
                            isSelected && "bg-primary/5"
                          )}
                        >
                          <div className={cn(
                            "w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0",
                            isSelected ? "border-primary bg-primary" : "border-gray-300"
                          )}>
                            {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                          </div>
                          <span className={cn(
                            "text-base font-medium",
                            isSelected ? "text-primary" : "text-gray-700"
                          )}>
                            {option.label}
                          </span>
                          <input
                            type="radio"
                            name="bedrooms"
                            value={option.id}
                            checked={isSelected}
                            onChange={() => setFormData({ ...formData, bedrooms: option.id })}
                            className="sr-only"
                          />
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Step 5: Frequency */}
            {currentStep === 5 && (
              <div className="flex-1 flex flex-col">
                <h2 className="font-heading text-2xl lg:text-3xl font-bold text-gray-900 text-center mb-2">
                  How often do you need cleaning?
                </h2>
                <p className="text-gray-500 text-center mb-8">
                  Choose what works best for you
                </p>

                <div className="flex-1">
                  <div className="bg-gray-50 rounded-2xl border border-gray-200 divide-y divide-gray-200 overflow-hidden">
                    {frequencyOptions.map((option) => {
                      const isSelected = formData.frequency === option.id;
                      return (
                        <label
                          key={option.id}
                          className={cn(
                            "flex items-center gap-4 p-4 cursor-pointer transition-colors hover:bg-gray-100",
                            isSelected && "bg-primary/5"
                          )}
                        >
                          <div className={cn(
                            "w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0",
                            isSelected ? "border-primary bg-primary" : "border-gray-300"
                          )}>
                            {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                          </div>
                          <span className={cn(
                            "text-base font-medium",
                            isSelected ? "text-primary" : "text-gray-700"
                          )}>
                            {option.label}
                          </span>
                          <input
                            type="radio"
                            name="frequency"
                            value={option.id}
                            checked={isSelected}
                            onChange={() => setFormData({ ...formData, frequency: option.id })}
                            className="sr-only"
                          />
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Step 6: Contact Details */}
            {currentStep === 6 && (
              <div className="flex-1 flex flex-col">
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
                    <div>
                      <div className="relative">
                        <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <Input
                          type="tel"
                          value={formData.customerPhone}
                          onChange={(e) => {
                            setFormData({ ...formData, customerPhone: e.target.value });
                            setPhoneError(""); // Clear error on change
                          }}
                          onBlur={async () => {
                            // Validate on blur if phone is long enough
                            if (formData.customerPhone.length >= 10) {
                              await validatePhone(formData.customerPhone);
                            }
                          }}
                          placeholder="Phone number (e.g. 07123 456789)"
                          className={cn(
                            "pl-12 h-12 border-2 rounded-xl transition-colors",
                            phoneError 
                              ? "border-destructive focus:border-destructive" 
                              : "border-gray-200 focus:border-primary"
                          )}
                        />
                        {isValidatingPhone && (
                          <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 animate-spin" />
                        )}
                      </div>
                      {phoneError && (
                        <p className="mt-1 text-sm text-destructive">{phoneError}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 7: Date Range */}
            {currentStep === 7 && (
              <div className="flex-1 flex flex-col">
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

            {/* Navigation Buttons - Hidden on Step 1 */}
            {currentStep > 1 && (
              <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-100">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleBack}
                  className="gap-2 text-gray-600"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </Button>

                <Button
                  type="button"
                  onClick={handleNext}
                  disabled={!canProceed() || isSubmitting || isValidatingPhone}
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
            )}
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

      {/* Problem/Solution Section */}
      <section className="bg-white py-16 lg:py-24">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="font-heading text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
              Why Customers Choose <span className="text-primary">Deep Clean UK</span>
            </h2>
            <p className="text-gray-600 text-lg max-w-2xl mx-auto">
              Finding a reliable cleaner shouldn't be stressful. We've solved the biggest pain points.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* Problem 1 */}
            <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100 hover:border-primary/20 hover:shadow-lg transition-all duration-300">
              <div className="w-14 h-14 bg-primary/10 rounded-xl flex items-center justify-center mb-4">
                <Clock className="w-7 h-7 text-primary" />
              </div>
              <h3 className="font-heading font-semibold text-lg text-gray-900 mb-2">
                Save Hours of Searching
              </h3>
              <p className="text-gray-600 text-sm">
                No more endless scrolling through directories. Get multiple quotes from verified cleaners in one request.
              </p>
            </div>

            {/* Problem 2 */}
            <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100 hover:border-primary/20 hover:shadow-lg transition-all duration-300">
              <div className="w-14 h-14 bg-secondary/10 rounded-xl flex items-center justify-center mb-4">
                <ShieldCheck className="w-7 h-7 text-secondary" />
              </div>
              <h3 className="font-heading font-semibold text-lg text-gray-900 mb-2">
                Verified Professionals Only
              </h3>
              <p className="text-gray-600 text-sm">
                Every cleaner in our network is vetted and verified. No cowboys, no scams—just reliable service.
              </p>
            </div>

            {/* Problem 3 */}
            <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100 hover:border-primary/20 hover:shadow-lg transition-all duration-300">
              <div className="w-14 h-14 bg-emerald-100 rounded-xl flex items-center justify-center mb-4">
                <BadgeCheck className="w-7 h-7 text-emerald-600" />
              </div>
              <h3 className="font-heading font-semibold text-lg text-gray-900 mb-2">
                Competitive Quotes
              </h3>
              <p className="text-gray-600 text-sm">
                Cleaners compete for your job, so you get the best price. Compare and choose with confidence.
              </p>
            </div>

            {/* Problem 4 */}
            <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100 hover:border-primary/20 hover:shadow-lg transition-all duration-300">
              <div className="w-14 h-14 bg-violet-100 rounded-xl flex items-center justify-center mb-4">
                <ThumbsUp className="w-7 h-7 text-violet-600" />
              </div>
              <h3 className="font-heading font-semibold text-lg text-gray-900 mb-2">
                100% Free for You
              </h3>
              <p className="text-gray-600 text-sm">
                Our service is completely free for homeowners. No hidden fees, no obligations—just great cleaning.
              </p>
            </div>
          </div>

          {/* CTA */}
          <div className="text-center mt-12">
            <p className="text-gray-500 mb-4">Ready to get started?</p>
            <Button 
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 h-12 rounded-xl font-semibold"
            >
              Get Free Quotes Now
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <Footer />
    </div>
  );
}
