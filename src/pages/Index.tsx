import { Header } from "@/components/Header";
import { CustomerHeroSection } from "@/components/CustomerHeroSection";
import { TrustSection } from "@/components/TrustSection";
import { CustomerHowItWorks } from "@/components/CustomerHowItWorks";
import { CustomerServicesGrid } from "@/components/CustomerServicesGrid";
import { TestimonialsSection, generateReviewSchema } from "@/components/TestimonialsSection";
import { CustomerFAQ } from "@/components/CustomerFAQ";
import { Footer } from "@/components/Footer";
import { SEOHead } from "@/components/SEOHead";
import { useUtmTracking } from "@/hooks/useUtmTracking";

const Index = () => {
  // Capture UTM parameters on landing page (first-touch attribution)
  useUtmTracking();
  
  const reviewSchemas = generateReviewSchema();

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "FAQPage",
        "mainEntity": [
          {
            "@type": "Question",
            "name": "How do I request cleaning from Cleanda?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Tell Cleanda what you need cleaned. We review the requirements, provide the price and arrange a vetted cleaner after you accept."
            }
          },
          {
            "@type": "Question", 
            "name": "Who manages my booking?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Cleanda manages the requirements, price, booking, cleaner assignment and customer support."
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
              "text": "Cleanda offers end of tenancy, move-in and move-out, one-off deep, weekly routine, post-construction and Airbnb or short-let cleaning."
            }
          },
          {
            "@type": "Question",
            "name": "Where does Cleanda operate?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Cleanda currently operates across Greater Manchester. Enter your full postcode to check the active service area."
            }
          }
        ]
      },
      {
        "@type": "WebPage",
        "@id": "https://cleanda.co.uk/#webpage",
        "url": "https://cleanda.co.uk",
        "name": "Professional Cleaning in Greater Manchester | Cleanda",
        "description": "Request professional cleaning across Greater Manchester. Cleanda manages the price, booking, cleaner and customer support.",
        "isPartOf": { "@id": "https://cleanda.co.uk/#website" },
        "about": { "@id": "https://cleanda.co.uk/#organization" },
        "primaryImageOfPage": {
          "@type": "ImageObject",
          "url": "https://cleanda.co.uk/og-image.png"
        },
        "breadcrumb": {
          "@type": "BreadcrumbList",
          "itemListElement": [
            {
              "@type": "ListItem",
              "position": 1,
              "name": "Home",
              "item": "https://cleanda.co.uk"
            }
          ]
        }
      },
      {
        "@type": "LocalBusiness",
        "@id": "https://cleanda.co.uk/#localbusiness",
        "name": "Cleanda",
        "description": "Managed professional cleaning across Greater Manchester, from request and quote through cleaner assignment and completion.",
        "url": "https://cleanda.co.uk",
        "telephone": "+44-7757-188-197",
        "email": "hello@cleanda.co.uk",
        "address": {
          "@type": "PostalAddress",
          "streetAddress": "128 City Road",
          "addressLocality": "London",
          "postalCode": "EC1V 2NX",
          "addressCountry": "GB"
        },
        "priceRange": "£100-£500",
        "image": "https://cleanda.co.uk/og-image.png",
        "aggregateRating": {
          "@type": "AggregateRating",
          "ratingValue": "4.8",
          "reviewCount": "2500",
          "bestRating": "5",
          "worstRating": "1"
        }
      },
      // Spread individual reviews - each properly references the Organization
      ...reviewSchemas
    ]
  };

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Professional Cleaning in Greater Manchester | Cleanda"
        description="Request professional cleaning across Greater Manchester. Cleanda manages your quote, booking, vetted cleaner and customer support."
        canonical="https://cleanda.co.uk"
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
