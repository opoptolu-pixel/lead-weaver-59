import { Header } from "@/components/Header";
import { CustomerHeroSection } from "@/components/CustomerHeroSection";
import { TrustSection } from "@/components/TrustSection";
import { CustomerHowItWorks } from "@/components/CustomerHowItWorks";
import { CustomerServicesGrid } from "@/components/CustomerServicesGrid";
import { CustomerFAQ } from "@/components/CustomerFAQ";
import { Footer } from "@/components/Footer";
import { SEOHead } from "@/components/SEOHead";

const Index = () => {
  const faqStructuredData = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "Is it free to get quotes?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Yes, completely free! You can request quotes from multiple cleaners without any obligation. There are no hidden fees or charges for using our service."
        }
      },
      {
        "@type": "Question", 
        "name": "How quickly will I hear back?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Most customers are contacted by their cleaning partner within 24 hours of submitting their request."
        }
      },
      {
        "@type": "Question",
        "name": "Are the cleaners verified?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Yes, all cleaners on our platform are verified professionals. We check their credentials, insurance, and reviews before they can receive cleaning requests."
        }
      }
    ]
  };

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Find Trusted Cleaners Near You | Deep Clean UK"
        description="Get free quotes from verified local cleaners. Compare prices, read reviews, and book with confidence. Deep cleaning, end of tenancy, carpet cleaning and more."
        canonical="https://deepcleanuk.com"
        structuredData={faqStructuredData}
      />
      <Header />
      <main>
        <CustomerHeroSection />
        <TrustSection />
        <CustomerHowItWorks />
        <CustomerServicesGrid />
        <CustomerFAQ />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
