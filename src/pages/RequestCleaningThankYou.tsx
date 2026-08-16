import { useEffect } from "react";
import { CheckCircle, Clock, Phone, ArrowRight, BadgePoundSterling } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate, useLocation } from "react-router-dom";
import { SEOHead } from "@/components/SEOHead";
import { trackCleaningRequest } from "@/lib/analytics";

const RequestCleaningThankYou = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Fire conversion events on page load
  useEffect(() => {
    const state = location.state as { jobType?: string; postcode?: string; estimatedValue?: string; referenceId?: string } | null;
    if (state?.jobType) {
      trackCleaningRequest({
        jobType: state.jobType,
        postcode: state.postcode || '',
        estimatedValue: state.estimatedValue,
      });
    }

    // Meta Pixel Lead event
    if (window.fbq) {
      window.fbq('track', 'Lead', {
        content_name: state?.jobType || 'cleaning_request',
        content_category: 'cleaning',
        value: parseFloat(state?.estimatedValue?.replace(/[^0-9.]/g, '') || '100'),
        currency: 'GBP',
      });
    }
  }, [location.state]);

  return (
    <>
      <SEOHead
        title="Thank You | Your Cleaning Request is Submitted | Cleanda"
        description="Cleanda has received your Greater Manchester cleaning request and will contact you to confirm the requirements and price."
        canonical="https://cleanda.co.uk/request-cleaning/thank-you"
        noIndex={true}
      />
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-orange-50 flex items-center justify-center p-4">
      <div className="max-w-lg w-full text-center">
        {/* Almost There Icon */}
        <div className="relative mb-8">
          <div className="w-24 h-24 mx-auto bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center shadow-xl shadow-amber-200">
            <Clock className="w-12 h-12 text-white" />
          </div>
          <div className="absolute -top-2 -right-2 w-8 h-8 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
          <div className="absolute -bottom-1 -left-4 w-6 h-6 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
        </div>

        {/* Main Message */}
        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
          Request received
        </h1>
        <p className="text-xl text-gray-600 mb-8">
          Cleanda will review your requirements and contact you to confirm the price and booking.
        </p>

        {/* Managed service confirmation */}
        <div className="bg-white rounded-2xl p-6 shadow-lg border-2 border-amber-200 mb-8 text-left">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
              <Phone className="w-5 h-5 text-amber-600" />
            </div>
            <h2 className="font-semibold text-gray-900 text-lg">What happens next</h2>
          </div>
          
          <p className="text-gray-700 mb-4">
            Our Greater Manchester team will check the job details and contact you if anything needs clarification.
          </p>
          
          <div className="bg-gradient-to-r from-emerald-50 to-green-50 rounded-xl p-4 border border-emerald-200">
            <p className="text-gray-800 font-medium text-center">
              Your request is with Cleanda
            </p>
            <p className="text-gray-600 text-sm text-center mt-2">
              Nothing is booked or charged until the price and arrangements are confirmed.
            </p>
          </div>
        </div>

        {/* Managed journey */}
        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 mb-8 text-left">
          <h2 className="font-semibold text-gray-900 mb-4 text-lg">Your Cleanda journey:</h2>
          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">We confirm the requirements</p>
                <p className="text-gray-600 text-sm">Cleanda reviews the property, service and preferred date.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                <BadgePoundSterling className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">Cleanda provides the price</p>
                <p className="text-gray-600 text-sm">Once accepted, Cleanda secures the booking and arranges a vetted cleaner.</p>
              </div>
            </div>
          </div>
        </div>

        {/* CTA */}
        <Button 
          onClick={() => navigate('/')}
          variant="outline"
          className="border-gray-300 text-gray-700 hover:bg-gray-50 px-8 py-6 text-lg rounded-xl"
        >
          Back to Home
          <ArrowRight className="w-5 h-5 ml-2" />
        </Button>
      </div>
    </div>
    </>
  );
};

export default RequestCleaningThankYou;
