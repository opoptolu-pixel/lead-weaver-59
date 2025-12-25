import { CheckCircle, Clock, Phone, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { SEOHead } from "@/components/SEOHead";

const RequestCleaningThankYou = () => {
  const navigate = useNavigate();

  return (
    <>
      <SEOHead
        title="Thank You | Your Cleaning Request is Submitted | Deep Clean UK"
        description="Your cleaning request has been submitted. Verified local cleaners will contact you within 24 hours with quotes."
        canonical="https://deepcleanuk.com/request-cleaning/thank-you"
        noIndex={true}
      />
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 flex items-center justify-center p-4">
      <div className="max-w-lg w-full text-center">
        {/* Success Icon */}
        <div className="relative mb-8">
          <div className="w-24 h-24 mx-auto bg-gradient-to-br from-emerald-400 to-teal-500 rounded-full flex items-center justify-center shadow-xl shadow-emerald-200">
            <CheckCircle className="w-12 h-12 text-white" />
          </div>
          <div className="absolute -top-2 -right-2 w-8 h-8 bg-yellow-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
          <div className="absolute -bottom-1 -left-4 w-6 h-6 bg-pink-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
        </div>

        {/* Main Message */}
        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
          You're all set! 🎉
        </h1>
        <p className="text-xl text-gray-600 mb-8">
          Your cleaning request has been submitted successfully.
        </p>

        {/* What happens next */}
        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 mb-8 text-left">
          <h2 className="font-semibold text-gray-900 mb-4 text-lg">What happens next?</h2>
          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
                <Clock className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">Within 24 hours</p>
                <p className="text-gray-600 text-sm">Local cleaners in your area will receive your request</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                <Phone className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">Get quotes</p>
                <p className="text-gray-600 text-sm">Verified cleaners will contact you with competitive quotes</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                <CheckCircle className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">Choose the best</p>
                <p className="text-gray-600 text-sm">Compare quotes and pick the cleaner that suits you</p>
              </div>
            </div>
          </div>
        </div>

        {/* CTA */}
        <Button 
          onClick={() => navigate('/')}
          className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white px-8 py-6 text-lg rounded-xl shadow-lg shadow-emerald-200"
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
