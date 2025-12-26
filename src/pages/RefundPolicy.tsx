import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SEOHead } from "@/components/SEOHead";

const RefundPolicy = () => {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": "https://deepcleanco.uk/refund-policy#webpage",
    "url": "https://deepcleanco.uk/refund-policy",
    "name": "Refund Policy | Deep Clean UK",
    "description": "Understand Deep Clean UK's refund policy for lead credits.",
    "isPartOf": { "@id": "https://deepcleanco.uk/#website" },
    "about": { "@id": "https://deepcleanco.uk/#organization" },
    "breadcrumb": {
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://deepcleanco.uk" },
        { "@type": "ListItem", "position": 2, "name": "Refund Policy", "item": "https://deepcleanco.uk/refund-policy" }
      ]
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Refund Policy | Deep Clean UK"
        description="Understand Deep Clean UK's refund policy for lead credits. Learn about eligible refund situations, the dispute process, and how to request a refund."
        canonical="https://deepcleanco.uk/refund-policy"
        structuredData={structuredData}
      />
      <Header />
      <main className="container mx-auto px-4 py-16 max-w-4xl">
        <h1 className="text-4xl font-bold text-foreground mb-8">Refund Policy</h1>
        <p className="text-muted-foreground mb-8">Last updated: December 2024</p>

        <div className="prose prose-lg max-w-none space-y-8 text-foreground">
          <section className="p-4 bg-muted rounded-lg mb-8">
            <p className="text-muted-foreground text-sm">
              Deep Clean UK is a trading name of <strong>Orbit Shade Ltd</strong> (Company No. 15337705), registered in England and Wales. 
              Registered address: 128 City Road, London, EC1V 2NX, United Kingdom.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">1. Overview</h2>
            <p className="text-muted-foreground leading-relaxed">
              At Deep Clean UK, we are committed to providing high-quality leads to our cleaning business partners. We understand that not every lead will result in a successful job, which is why we have established a fair and transparent refund policy.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">2. Lead Credit Refunds</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              You may be eligible for a lead credit refund under the following circumstances:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li><strong>Invalid Contact Information:</strong> The customer's phone number or email address is incorrect or non-functional</li>
              <li><strong>Duplicate Lead:</strong> You have already received and unlocked this lead within the past 30 days</li>
              <li><strong>Outside Service Area:</strong> The job location is clearly outside your registered service area</li>
              <li><strong>Wrong Service Type:</strong> The lead is for a service type you do not offer (e.g., commercial cleaning when you only offer domestic)</li>
              <li><strong>Customer Unresponsive:</strong> The customer does not respond after 3 contact attempts within 48 hours</li>
              <li><strong>Job Already Completed:</strong> The customer has already hired another cleaner for the job</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">3. Refund Request Process</h2>
            <ol className="list-decimal pl-6 text-muted-foreground space-y-2">
              <li>Submit a dispute within <strong>7 days</strong> of unlocking the lead</li>
              <li>Provide detailed information about why the lead is invalid</li>
              <li>Include any supporting evidence (screenshots, call logs, etc.)</li>
              <li>Our team will review your request within 2-3 business days</li>
              <li>If approved, credits will be returned to your account</li>
            </ol>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">4. Non-Refundable Situations</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Refunds will <strong>not</strong> be provided in the following situations:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>The customer chose a different provider (competition)</li>
              <li>You were unable to agree on pricing with the customer</li>
              <li>The customer's needs changed after the lead was generated</li>
              <li>You failed to contact the customer in a timely manner (within 24 hours)</li>
              <li>Dispute submitted more than 7 days after unlocking the lead</li>
              <li>The lead information was accurate but you simply didn't win the job</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">5. Credit Package Refunds</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              For unused credit packages:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li><strong>Within 14 days of purchase:</strong> Full refund available for unused credits</li>
              <li><strong>After 14 days:</strong> No refund for credit purchases, but credits remain valid for 12 months</li>
              <li><strong>Partially used packages:</strong> Refund calculated on unused credits only (within 14-day window)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">6. How Refunds Are Processed</h2>
            <div className="space-y-4 text-muted-foreground">
              <p><strong>Lead Credit Refunds:</strong> Credits are returned directly to your Deep Clean UK account balance within 24 hours of approval.</p>
              <p><strong>Monetary Refunds:</strong> If eligible, refunds are processed to your original payment method within 5-10 business days.</p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">7. Abuse Prevention</h2>
            <p className="text-muted-foreground leading-relaxed">
              We monitor refund requests to prevent abuse of our system. Accounts with excessive or fraudulent refund claims may face:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2 mt-4">
              <li>Additional verification requirements</li>
              <li>Reduced refund eligibility</li>
              <li>Account suspension or termination</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">8. Disputes and Appeals</h2>
            <p className="text-muted-foreground leading-relaxed">
              If you disagree with a refund decision, you may appeal by contacting our support team with additional evidence. Appeals must be submitted within 7 days of the original decision.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">9. Contact Us</h2>
            <p className="text-muted-foreground leading-relaxed">
              For refund requests or questions about this policy:
            </p>
            <div className="mt-4 p-4 bg-muted rounded-lg">
              <p className="text-foreground">Deep Clean UK Support</p>
              <p className="text-muted-foreground">Email: hello@deepcleanco.uk</p>
              <p className="text-muted-foreground">Phone: 07757 188 197</p>
              <p className="text-muted-foreground mt-2">Support hours: Monday - Friday, 9am - 5pm GMT</p>
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default RefundPolicy;
