import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    question: "Is it free to get quotes?",
    answer: "Yes, completely free! You can request quotes from multiple cleaners without any obligation. There are no hidden fees or charges for using our service.",
  },
  {
    question: "How quickly will I receive quotes?",
    answer: "Most customers receive their first quote within a few hours, and typically have multiple quotes to compare within 24 hours.",
  },
  {
    question: "Are the cleaners verified?",
    answer: "Yes, all cleaners on our platform are verified professionals. We check their credentials, insurance, and reviews before they can receive cleaning requests.",
  },
  {
    question: "Can I see reviews before choosing a cleaner?",
    answer: "Absolutely! When you receive quotes, you'll be able to see ratings and reviews from previous customers to help you make an informed decision.",
  },
  {
    question: "What if I'm not happy with the cleaning?",
    answer: "Customer satisfaction is important to us. If you're not happy with the service, contact us and we'll work with you and the cleaner to resolve the issue.",
  },
  {
    question: "What areas do you cover?",
    answer: "We have cleaners across the UK, covering most major cities and surrounding areas. Enter your postcode to see available cleaners in your area.",
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
            Everything you need to know about finding a cleaner.
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
