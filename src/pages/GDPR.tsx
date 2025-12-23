import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

const GDPR = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-16 max-w-4xl">
        <h1 className="text-4xl font-bold text-foreground mb-8">GDPR Compliance</h1>
        <p className="text-muted-foreground mb-8">Last updated: December 2024</p>

        <div className="prose prose-lg max-w-none space-y-8 text-foreground">
          <section>
            <h2 className="text-2xl font-semibold mb-4">1. Our Commitment to GDPR</h2>
            <p className="text-muted-foreground leading-relaxed">
              Deep Clean UK is fully committed to complying with the UK General Data Protection Regulation (UK GDPR) and the Data Protection Act 2018. We take the protection of your personal data seriously and have implemented robust measures to ensure your rights are protected.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">2. Data Controller</h2>
            <p className="text-muted-foreground leading-relaxed">
              Deep Clean UK acts as the Data Controller for the personal data we collect and process. We determine the purposes and means of processing personal data on our platform.
            </p>
            <div className="mt-4 p-4 bg-muted rounded-lg">
              <p className="text-foreground font-medium">Data Controller Contact:</p>
              <p className="text-muted-foreground">Deep Clean UK</p>
              <p className="text-muted-foreground">Email: dpo@deepcleanuk.com</p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">3. Lawful Basis for Processing</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">We process personal data under the following lawful bases:</p>
            
            <div className="space-y-4">
              <div className="p-4 border border-border rounded-lg">
                <h4 className="font-medium text-foreground">Contract Performance</h4>
                <p className="text-muted-foreground text-sm mt-1">Processing necessary to provide our lead generation services and manage your account.</p>
              </div>
              
              <div className="p-4 border border-border rounded-lg">
                <h4 className="font-medium text-foreground">Legitimate Interest</h4>
                <p className="text-muted-foreground text-sm mt-1">Processing for fraud prevention, platform improvement, and business operations where balanced against your rights.</p>
              </div>
              
              <div className="p-4 border border-border rounded-lg">
                <h4 className="font-medium text-foreground">Consent</h4>
                <p className="text-muted-foreground text-sm mt-1">Marketing communications and optional WhatsApp notifications (which can be withdrawn at any time).</p>
              </div>
              
              <div className="p-4 border border-border rounded-lg">
                <h4 className="font-medium text-foreground">Legal Obligation</h4>
                <p className="text-muted-foreground text-sm mt-1">Compliance with tax, accounting, and regulatory requirements.</p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">4. Your Data Rights</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">Under UK GDPR, you have the following rights:</p>
            
            <div className="space-y-4">
              <div className="flex gap-4 items-start">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-primary font-bold">1</span>
                </div>
                <div>
                  <h4 className="font-medium text-foreground">Right of Access</h4>
                  <p className="text-muted-foreground text-sm">Request a copy of your personal data we hold. We will respond within 30 days.</p>
                </div>
              </div>
              
              <div className="flex gap-4 items-start">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-primary font-bold">2</span>
                </div>
                <div>
                  <h4 className="font-medium text-foreground">Right to Rectification</h4>
                  <p className="text-muted-foreground text-sm">Request correction of inaccurate or incomplete personal data.</p>
                </div>
              </div>
              
              <div className="flex gap-4 items-start">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-primary font-bold">3</span>
                </div>
                <div>
                  <h4 className="font-medium text-foreground">Right to Erasure (Right to be Forgotten)</h4>
                  <p className="text-muted-foreground text-sm">Request deletion of your personal data where there is no compelling reason for continued processing.</p>
                </div>
              </div>
              
              <div className="flex gap-4 items-start">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-primary font-bold">4</span>
                </div>
                <div>
                  <h4 className="font-medium text-foreground">Right to Restrict Processing</h4>
                  <p className="text-muted-foreground text-sm">Request limitation of processing in certain circumstances.</p>
                </div>
              </div>
              
              <div className="flex gap-4 items-start">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-primary font-bold">5</span>
                </div>
                <div>
                  <h4 className="font-medium text-foreground">Right to Data Portability</h4>
                  <p className="text-muted-foreground text-sm">Receive your data in a structured, commonly used format and transfer it to another provider.</p>
                </div>
              </div>
              
              <div className="flex gap-4 items-start">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-primary font-bold">6</span>
                </div>
                <div>
                  <h4 className="font-medium text-foreground">Right to Object</h4>
                  <p className="text-muted-foreground text-sm">Object to processing based on legitimate interests or for direct marketing purposes.</p>
                </div>
              </div>
              
              <div className="flex gap-4 items-start">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-primary font-bold">7</span>
                </div>
                <div>
                  <h4 className="font-medium text-foreground">Right to Withdraw Consent</h4>
                  <p className="text-muted-foreground text-sm">Withdraw consent at any time where processing is based on consent.</p>
                </div>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">5. How to Exercise Your Rights</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              To exercise any of your rights, please contact us using one of the following methods:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>Email our Data Protection Officer: dpo@deepcleanuk.com</li>
              <li>Use the data request form in your account settings</li>
              <li>Write to us at our registered address</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-4">
              We will respond to your request within <strong>30 days</strong>. In complex cases, we may extend this by a further 60 days, in which case we will inform you of the extension and reasons.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">6. Data Processing Activities</h2>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-border">
                <thead>
                  <tr className="bg-muted">
                    <th className="border border-border p-3 text-left text-foreground">Data Category</th>
                    <th className="border border-border p-3 text-left text-foreground">Purpose</th>
                    <th className="border border-border p-3 text-left text-foreground">Retention</th>
                  </tr>
                </thead>
                <tbody className="text-muted-foreground">
                  <tr>
                    <td className="border border-border p-3">Account Information</td>
                    <td className="border border-border p-3">Service provision</td>
                    <td className="border border-border p-3">Duration of account + 6 years</td>
                  </tr>
                  <tr>
                    <td className="border border-border p-3">Transaction Data</td>
                    <td className="border border-border p-3">Payment processing, tax compliance</td>
                    <td className="border border-border p-3">7 years (legal requirement)</td>
                  </tr>
                  <tr>
                    <td className="border border-border p-3">Lead Information</td>
                    <td className="border border-border p-3">Service delivery</td>
                    <td className="border border-border p-3">2 years from creation</td>
                  </tr>
                  <tr>
                    <td className="border border-border p-3">Verification Documents</td>
                    <td className="border border-border p-3">Business verification</td>
                    <td className="border border-border p-3">Duration of account + 1 year</td>
                  </tr>
                  <tr>
                    <td className="border border-border p-3">Marketing Preferences</td>
                    <td className="border border-border p-3">Communication management</td>
                    <td className="border border-border p-3">Until consent withdrawn</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">7. International Data Transfers</h2>
            <p className="text-muted-foreground leading-relaxed">
              We primarily store and process data within the UK and European Economic Area. Where we transfer data outside these regions, we ensure appropriate safeguards are in place, including:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2 mt-4">
              <li>Standard Contractual Clauses approved by the ICO</li>
              <li>Transfers to countries with adequacy decisions</li>
              <li>Binding Corporate Rules where applicable</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">8. Data Security Measures</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">We implement technical and organisational measures including:</p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>Encryption of data in transit and at rest</li>
              <li>Regular security assessments and penetration testing</li>
              <li>Access controls and authentication mechanisms</li>
              <li>Staff training on data protection</li>
              <li>Incident response procedures</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">9. Data Breach Procedures</h2>
            <p className="text-muted-foreground leading-relaxed">
              In the event of a personal data breach that is likely to result in a risk to your rights and freedoms, we will notify the Information Commissioner's Office within 72 hours and inform affected individuals without undue delay.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">10. Complaints</h2>
            <p className="text-muted-foreground leading-relaxed">
              If you are not satisfied with how we handle your personal data, you have the right to lodge a complaint with the Information Commissioner's Office (ICO):
            </p>
            <div className="mt-4 p-4 bg-muted rounded-lg">
              <p className="text-foreground font-medium">Information Commissioner's Office</p>
              <p className="text-muted-foreground">Website: ico.org.uk</p>
              <p className="text-muted-foreground">Helpline: 0303 123 1113</p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">11. Contact Our DPO</h2>
            <p className="text-muted-foreground leading-relaxed">
              For any GDPR-related queries, please contact our Data Protection Officer:
            </p>
            <div className="mt-4 p-4 bg-muted rounded-lg">
              <p className="text-foreground font-medium">Data Protection Officer</p>
              <p className="text-muted-foreground">Deep Clean UK</p>
              <p className="text-muted-foreground">Email: dpo@deepcleanuk.com</p>
              <p className="text-muted-foreground">Response time: Within 5 business days</p>
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default GDPR;
