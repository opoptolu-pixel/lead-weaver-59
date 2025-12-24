import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SEOHead } from "@/components/SEOHead";

const TermsOfUse = () => {
  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Terms of Use"
        description="Read the terms and conditions for using Deep Clean UK's lead generation platform. Understand your rights and responsibilities as a registered user."
        canonical="https://deepcleanuk.com/terms-of-use"
      />
      <Header />
      <main className="container mx-auto px-4 py-16 max-w-4xl">
        <h1 className="text-4xl font-bold text-foreground mb-8">Terms of Use</h1>
        <p className="text-muted-foreground mb-8">Last updated: December 2024</p>

        <div className="prose prose-lg max-w-none space-y-8 text-foreground">
          <section>
            <h2 className="text-2xl font-semibold mb-4">1. Agreement to Terms</h2>
            <p className="text-muted-foreground leading-relaxed">
              By accessing or using the Deep Clean UK platform, you agree to be bound by these Terms of Use. If you do not agree to these terms, you may not use our services.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">2. Description of Service</h2>
            <p className="text-muted-foreground leading-relaxed">
              Deep Clean UK is a lead generation platform that connects cleaning businesses with potential customers. We provide leads containing customer contact information and job details. Our service operates on a pay-per-lead model where businesses purchase credits to unlock lead information.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">3. Eligibility</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">To use our platform, you must:</p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>Be at least 18 years of age</li>
              <li>Operate a legitimate cleaning business in the United Kingdom</li>
              <li>Have valid business insurance where required</li>
              <li>Provide accurate and truthful information during registration</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">4. Account Registration</h2>
            <p className="text-muted-foreground leading-relaxed">
              You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You must immediately notify us of any unauthorised use of your account.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">5. Credits and Payments</h2>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>Credits are purchased in advance and are non-refundable except as outlined in our Refund Policy</li>
              <li>Credits expire 12 months from the date of purchase</li>
              <li>Lead prices may vary based on job type and location</li>
              <li>All prices are displayed in GBP and include VAT where applicable</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">6. Lead Quality and Disputes</h2>
            <p className="text-muted-foreground leading-relaxed">
              While we strive to provide high-quality leads, we do not guarantee that every lead will result in a job. Our dispute process allows you to request refunds for leads that meet specific invalid criteria as outlined in our Refund Policy.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">7. Prohibited Conduct</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">You agree not to:</p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>Share or resell lead information to third parties</li>
              <li>Use automated systems to access or scrape our platform</li>
              <li>Provide false information during registration or verification</li>
              <li>Engage in fraudulent refund requests</li>
              <li>Harass or abuse customers whose information you receive</li>
              <li>Use our platform for any illegal purpose</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">8. Verification Requirements</h2>
            <p className="text-muted-foreground leading-relaxed">
              We may require you to verify your business identity, insurance, and other credentials. Failure to complete verification may result in limited access to leads or account suspension.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">9. Intellectual Property</h2>
            <p className="text-muted-foreground leading-relaxed">
              All content on the Deep Clean UK platform, including logos, text, graphics, and software, is our property or licensed to us. You may not copy, modify, or distribute this content without our permission.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">10. Limitation of Liability</h2>
            <p className="text-muted-foreground leading-relaxed">
              To the maximum extent permitted by law, Deep Clean UK shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the platform. Our total liability shall not exceed the amount you have paid us in the preceding 12 months.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">11. Indemnification</h2>
            <p className="text-muted-foreground leading-relaxed">
              You agree to indemnify and hold Deep Clean UK harmless from any claims, damages, or expenses arising from your use of the platform, violation of these terms, or infringement of any third-party rights.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">12. Account Suspension and Termination</h2>
            <p className="text-muted-foreground leading-relaxed">
              We reserve the right to suspend or terminate your account for violation of these terms, fraudulent activity, or any other reason at our discretion. Upon termination, any remaining credits may be forfeited.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">13. Changes to Terms</h2>
            <p className="text-muted-foreground leading-relaxed">
              We may modify these terms at any time. Continued use of the platform after changes constitutes acceptance of the new terms. We will notify you of significant changes via email or platform notification.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">14. Governing Law</h2>
            <p className="text-muted-foreground leading-relaxed">
              These terms are governed by the laws of England and Wales. Any disputes shall be resolved in the courts of England and Wales.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">15. Contact Information</h2>
            <p className="text-muted-foreground leading-relaxed">For questions about these terms:</p>
            <div className="mt-4 p-4 bg-muted rounded-lg">
              <p className="text-foreground">Deep Clean UK</p>
              <p className="text-muted-foreground">Email: hello@deepcleanuk.com</p>
              <p className="text-muted-foreground">Phone: 07757 188 197</p>
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default TermsOfUse;
