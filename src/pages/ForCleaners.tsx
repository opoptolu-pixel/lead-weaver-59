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
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
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
          },
          {
            "@type": "Question",
            "name": "What types of cleaning leads are available?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "We offer leads for deep cleaning, end of tenancy, carpet cleaning, upholstery cleaning, commercial cleaning, post-construction cleaning and more. All leads are valued at £100+ per job."
            }
          },
          {
            "@type": "Question",
            "name": "How do I get started?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Simply sign up for free, verify your business, and start browsing available leads in your area. No monthly fees or contracts - pay only for leads you want."
            }
          }
        ]
      },
      {
        "@type": "WebPage",
        "@id": "https://cleanda.co.uk/for-cleaners#webpage",
        "url": "https://cleanda.co.uk/for-cleaners",
        "name": "Cleaning Leads for Professional Cleaners | Grow Your Business | Cleanda",
        "description": "Get exclusive cleaning job leads in your area. No monthly fees, pay per lead. Join UK's trusted cleaning lead platform.",
        "isPartOf": { "@id": "https://cleanda.co.uk/#website" },
        "breadcrumb": {
          "@type": "BreadcrumbList",
          "itemListElement": [
            {
              "@type": "ListItem",
              "position": 1,
              "name": "Home",
              "item": "https://cleanda.co.uk"
            },
            {
              "@type": "ListItem",
              "position": 2,
              "name": "For Cleaners",
              "item": "https://cleanda.co.uk/for-cleaners"
            }
          ]
        }
      },
      {
        "@type": "Product",
        "name": "Cleaning Lead Credits",
        "description": "Exclusive cleaning job leads for professional cleaners across the UK",
        "brand": {
          "@type": "Brand",
          "name": "Cleanda"
        },
        "offers": [
          {
            "@type": "Offer",
            "name": "Single Lead",
            "price": "20.00",
            "priceCurrency": "GBP",
            "availability": "https://schema.org/InStock"
          },
          {
            "@type": "Offer",
            "name": "5 Credit Pack",
            "price": "90.00",
            "priceCurrency": "GBP",
            "availability": "https://schema.org/InStock"
          },
          {
            "@type": "Offer",
            "name": "10 Credit Pack",
            "price": "170.00",
            "priceCurrency": "GBP",
            "availability": "https://schema.org/InStock"
          }
        ]
      }
    ]
  };

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Cleaning Leads for Professional Cleaners | Grow Your Business | Cleanda"
        description="Get exclusive cleaning job leads in your area. No monthly fees, no contracts - pay only £20 per lead. Leads worth £100+. Join 500+ UK cleaners growing their business."
        canonical="https://cleanda.co.uk/for-cleaners"
        structuredData={structuredData}
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
      <Footer hideCta />
    </div>
  );
};

export default ForCleaners;
