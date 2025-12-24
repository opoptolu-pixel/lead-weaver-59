import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

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
    <section id="faq" className="py-20 bg-muted/30">
      <div className="container mx-auto px-4">
        {/* Section header */}
        <div className="text-center mb-12">
          <h2 className="font-heading text-3xl md:text-4xl font-bold text-foreground mb-4">
            Frequently Asked Questions
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Everything you need to know about our service.
          </p>
        </div>

        {/* FAQ Accordion */}
        <div className="max-w-3xl mx-auto">
          <Accordion type="single" collapsible className="w-full">
            {faqs.map((faq, index) => (
              <AccordionItem key={index} value={`item-${index}`} className="border-b border-border">
                <AccordionTrigger className="text-left font-medium text-foreground hover:text-secondary py-4">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground pb-4">
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
