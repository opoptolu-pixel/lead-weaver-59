import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    question: "Are leads shared between multiple cleaners?",
    answer: "No — every lead on Cleanda is 100% exclusive. Once you unlock a lead, it's yours and yours alone. You'll never compete for a job you've paid for.",
  },
  {
    question: "What happens if the lead doesn't respond?",
    answer: "We verify all leads before listing them. However, if you're unable to reach a customer after 3 attempts over 48 hours, contact our support team and we'll review your case for a potential credit.",
  },
  {
    question: "Do I get refunds on bad leads?",
    answer: "We have a fair lead guarantee. If a lead is clearly fake, already completed, or the customer denies requesting a quote, we'll issue a full credit to your account after verification.",
  },
  {
    question: "How are leads verified?",
    answer: "Every lead goes through our verification process including phone number validation, email confirmation, and basic service requirement checks before being listed on the platform.",
  },
  {
    question: "What areas do you cover?",
    answer: "We cover the entire UK. You can set your preferred postcode areas in your dashboard and only receive leads relevant to your service area.",
  },
  {
    question: "Is there a monthly fee or contract?",
    answer: "Absolutely not. Cleanda is 100% pay-per-lead. No monthly subscriptions, no contracts, no hidden fees. You only pay when you choose to unlock a lead.",
  },
];

export const FAQ = () => {
  return (
    <section id="faq" className="py-20 lg:py-28 bg-muted/50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <span className="inline-block text-secondary font-semibold text-sm uppercase tracking-wider mb-4">
            Got Questions?
          </span>
          <h2 className="font-heading text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-6">
            Frequently Asked Questions
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Everything you need to know about Cleanda
          </p>
        </div>

        <div className="max-w-3xl mx-auto">
          <Accordion type="single" collapsible className="space-y-4">
            {faqs.map((faq, index) => (
              <AccordionItem
                key={index}
                value={`item-${index}`}
                className="bg-card rounded-xl border border-border px-6 shadow-card data-[state=open]:shadow-elevated data-[state=open]:border-secondary/30 transition-all duration-200"
              >
                <AccordionTrigger className="text-left font-heading font-semibold text-foreground hover:text-secondary hover:no-underline py-5">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground pb-5 leading-relaxed">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
};
