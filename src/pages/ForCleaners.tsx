import { Header } from "@/components/Header";
import { HeroSection } from "@/components/HeroSection";
import { HowItWorks } from "@/components/HowItWorks";
import { JobBoard } from "@/components/JobBoard";
import { Pricing } from "@/components/Pricing";
import { RegistrationForm } from "@/components/RegistrationForm";
import { FAQ } from "@/components/FAQ";
import { Footer } from "@/components/Footer";
import { SEOHead } from "@/components/SEOHead";

const ForCleaners = () => {
  const faqStructuredData = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "How do cleaning leads work?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Customers request cleaning services through our platform. We verify each request and publish them as leads. You can unlock leads in your area and contact customers directly."
        }
      },
      {
        "@type": "Question", 
        "name": "What is the cost per lead?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Each lead costs £20 or you can buy credit packs for savings. 5 credits cost £90 (£18/lead) and 10 credits cost £170 (£17/lead)."
        }
      },
      {
        "@type": "Question",
        "name": "Are leads exclusive?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Yes, each lead is only sold once. When you unlock a lead, you get exclusive access to that customer's contact information."
        }
      }
    ]
  };

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Cleaning Leads for Professional Cleaners | Deep Clean UK"
        description="Get exclusive deep cleaning job leads in your area. No monthly fees, pay only for the leads you want. Join UK's #1 cleaning lead platform today."
        canonical="https://deepcleanuk.com/for-cleaners"
        structuredData={faqStructuredData}
      />
      <Header />
      <main>
        <HeroSection />
        <HowItWorks />
        <JobBoard />
        <Pricing />
        <RegistrationForm />
        <FAQ />
      </main>
      <Footer />
    </div>
  );
};

export default ForCleaners;
