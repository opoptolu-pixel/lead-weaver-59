import { Header } from "@/components/Header";
import { CustomerHeroSection } from "@/components/CustomerHeroSection";
import { TrustSection } from "@/components/TrustSection";
import { CustomerHowItWorks } from "@/components/CustomerHowItWorks";
import { CustomerServicesGrid } from "@/components/CustomerServicesGrid";
import { TestimonialsSection, generateReviewSchema } from "@/components/TestimonialsSection";
import { CustomerFAQ } from "@/components/CustomerFAQ";
import { Footer } from "@/components/Footer";
import { SEOHead } from "@/components/SEOHead";

const Index = () => {
  const reviewSchema = generateReviewSchema();

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "FAQPage",
        "mainEntity": [
          {
            "@type": "Question",
            "name": "Is it free to get quotes from cleaners?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Yes, completely free! You can request quotes from multiple verified cleaners without any obligation. There are no hidden fees or charges for using our service."
            }
          },
          {
            "@type": "Question", 
            "name": "How quickly will cleaners contact me?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Most customers are contacted by their cleaning partner within 24 hours of submitting their request. Our verified cleaners are ready to provide quotes fast."
            }
          },
          {
            "@type": "Question",
            "name": "Are the cleaners verified and insured?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Yes, all cleaners on our platform are verified professionals. We check their credentials, insurance, and reviews before they can receive cleaning requests."
            }
          },
          {
            "@type": "Question",
            "name": "What types of cleaning services are available?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "We offer a wide range of services including deep cleaning, end of tenancy cleaning, carpet cleaning, upholstery cleaning, one-off cleans, post-construction cleaning, and commercial office cleaning."
            }
          },
          {
            "@type": "Question",
            "name": "Do you cover my area in the UK?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "We have verified cleaners across the UK. Simply enter your postcode when requesting a quote and we'll connect you with local professionals in your area."
            }
          }
        ]
      },
      {
        "@type": "WebPage",
        "@id": "https://deepcleanuk.com/#webpage",
        "url": "https://deepcleanuk.com",
        "name": "Find Trusted Cleaners Near You | Free Quotes | Deep Clean UK",
        "description": "Get free quotes from verified local cleaners in the UK. Compare prices for deep cleaning, end of tenancy, carpet cleaning & more.",
        "isPartOf": { "@id": "https://deepcleanuk.com/#website" },
        "about": { "@id": "https://deepcleanuk.com/#organization" },
        "primaryImageOfPage": {
          "@type": "ImageObject",
          "url": "https://deepcleanuk.com/og-image.png"
        },
        "breadcrumb": {
          "@type": "BreadcrumbList",
          "itemListElement": [
            {
              "@type": "ListItem",
              "position": 1,
              "name": "Home",
              "item": "https://deepcleanuk.com"
            }
          ]
        }
      },
      reviewSchema
    ]
  };

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Find Trusted Cleaners Near You | Free Quotes | Deep Clean UK"
        description="Get free quotes from verified local cleaners in the UK. Compare prices for deep cleaning, end of tenancy, carpet cleaning & more. Fast response within 24 hours."
        canonical="https://deepcleanuk.com"
        structuredData={structuredData}
      />
      <Header />
      <main>
        <CustomerHeroSection />
        <TrustSection />
        <CustomerHowItWorks />
        <CustomerServicesGrid />
        <TestimonialsSection />
        <CustomerFAQ />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
