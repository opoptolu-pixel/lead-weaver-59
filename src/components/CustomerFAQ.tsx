import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { HelpCircle } from "lucide-react";

const faqs = [
  {
    question: "Is it free to request a quote?",
    answer: "Yes, completely free! There are no hidden fees or charges for using our service to find a cleaner.",
  },
  {
    question: "How quickly will I hear back?",
    answer: "Most customers are contacted by their cleaning partner within 24 hours of submitting their request.",
  },
  {
    question: "Are the cleaners verified?",
    answer: "Yes, all cleaning partners on our platform are verified professionals. We check their credentials and insurance before they can join our network.",
  },
  {
    question: "How does the matching work?",
    answer: "When you submit your request, we match you with a cleaning partner in your area who specialises in the service you need. They'll contact you directly to discuss your requirements and provide a quote.",
  },
  {
    question: "What if I'm not happy with the service?",
    answer: "Customer satisfaction is important to us. If you're not happy with the service, contact us and we'll work with you and the cleaning partner to resolve the issue.",
  },
  {
    question: "What areas do you cover?",
    answer: "We have cleaning partners across the UK, covering most major cities and surrounding areas. Enter your postcode to check availability in your area.",
  },
];

export const CustomerFAQ = () => {
  return (
    <section id="faq" className="py-28 bg-background relative overflow-hidden" aria-labelledby="faq-heading">
      {/* Background elements */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute top-1/2 left-0 w-[600px] h-[600px] -translate-y-1/2 -translate-x-1/2 bg-secondary/5 rounded-full blur-3xl" />
        <div className="absolute top-1/2 right-0 w-[400px] h-[400px] -translate-y-1/2 translate-x-1/2 bg-primary/5 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 relative">
        <div className="max-w-4xl mx-auto">
          {/* Section header */}
          <div className="text-center mb-16">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-secondary/10 mb-6" aria-hidden="true">
              <HelpCircle className="w-7 h-7 text-secondary" />
            </div>
            <h2 id="faq-heading" className="font-heading text-3xl md:text-5xl font-bold text-foreground mb-4 tracking-tight">
              Cleaning Services FAQ
            </h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              Common questions about finding and booking cleaners in the UK
            </p>
          </div>

          {/* FAQ Grid */}
          <div className="bg-card rounded-3xl border border-border shadow-card overflow-hidden">
            <Accordion type="single" collapsible className="w-full">
              {faqs.map((faq, index) => (
                <AccordionItem 
                  key={index} 
                  value={`item-${index}`} 
                  className="border-b border-border last:border-b-0 px-8"
                >
                  <AccordionTrigger className="text-left font-heading font-semibold text-foreground hover:text-secondary py-6 text-base md:text-lg gap-4">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground pb-6 text-base leading-relaxed">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>

          {/* Bottom CTA */}
          <div className="text-center mt-12">
            <p className="text-muted-foreground">
              Still have questions?{" "}
              <a href="mailto:hello@cleanda.co.uk" className="text-secondary font-medium hover:underline">
                Get in touch
              </a>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
