import { Star, Quote } from "lucide-react";
import { ScrollReveal } from "@/components/ScrollReveal";

const testimonials = [
  {
    name: "Sarah M.",
    location: "London",
    rating: 5,
    text: "Fantastic service! I found a great cleaner within hours of submitting my request. The end of tenancy clean was perfect and I got my full deposit back.",
    service: "End of Tenancy Clean",
    datePublished: "2025-01-10",
  },
  {
    name: "James T.",
    location: "Manchester",
    rating: 5,
    text: "So easy to use. I needed a deep clean before a family visit and the cleaner who contacted me was professional, friendly and did an amazing job.",
    service: "Deep Clean",
    datePublished: "2025-01-05",
  },
  {
    name: "Emily R.",
    location: "Birmingham",
    rating: 5,
    text: "Best decision I made! The carpet cleaning transformed our living room. Quick response, fair price, and outstanding results. Highly recommend.",
    service: "Carpet Cleaning",
    datePublished: "2024-12-28",
  },
  {
    name: "David L.",
    location: "Bristol",
    rating: 5,
    text: "Used this for our Airbnb property turnover. The cleaner was reliable, thorough, and now handles all our bookings. Brilliant service!",
    service: "Airbnb Refresh",
    datePublished: "2024-12-20",
  },
];

// Generate Review structured data for SEO
// Reviews are attached to the Organization entity defined in index.html
// Using proper nesting to avoid "Invalid object type" errors
export const generateReviewSchema = () => {
  return testimonials.map((t) => ({
    "@type": "Review",
    "itemReviewed": {
      "@type": "Organization",
      "@id": "https://deepcleanco.uk/#organization",
      "name": "Deep Clean UK"
    },
    "author": {
      "@type": "Person",
      "name": t.name
    },
    "reviewBody": t.text,
    "reviewRating": {
      "@type": "Rating",
      "ratingValue": t.rating,
      "bestRating": 5,
      "worstRating": 1
    },
    "datePublished": t.datePublished
  }));
};

export const TestimonialsSection = () => {
  return (
    <section className="py-28 bg-muted/30 relative overflow-hidden">
      {/* Background elements */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-secondary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-primary/5 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 relative">
        {/* Section header */}
        <div className="text-center mb-16 animate-fade-in">
          <span className="inline-block text-sm font-semibold text-secondary uppercase tracking-wider mb-3">
            Testimonials
          </span>
          <h2 className="font-heading text-3xl md:text-5xl font-bold text-foreground mb-4 tracking-tight">
            What Our Customers Say
          </h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Join thousands of happy customers across the UK
          </p>
        </div>

        {/* Testimonials grid - using CSS animations instead of ScrollReveal */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
          {testimonials.map((testimonial, index) => (
            <div 
              key={index} 
              className="group relative bg-background rounded-2xl p-6 border border-border shadow-card transition-all duration-300 hover:shadow-elevated hover:-translate-y-1 h-full animate-fade-in"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              {/* Quote icon */}
              <div className="absolute -top-3 right-6">
                <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shadow-md">
                  <Quote className="w-4 h-4 text-secondary-foreground" />
                </div>
              </div>

              {/* Rating */}
              <div className="flex gap-1 mb-4">
                {Array.from({ length: testimonial.rating }).map((_, i) => (
                  <Star
                    key={i}
                    className="w-4 h-4 fill-secondary text-secondary"
                  />
                ))}
              </div>

              {/* Quote text */}
              <p className="text-foreground text-sm leading-relaxed mb-6">
                "{testimonial.text}"
              </p>

              {/* Author */}
              <div className="border-t border-border pt-4">
                <p className="font-heading font-bold text-foreground">
                  {testimonial.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {testimonial.location} · {testimonial.service}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Trust stats */}
        <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto text-center animate-fade-in" style={{ animationDelay: '400ms' }}>
          <div>
            <p className="font-heading text-4xl font-bold text-foreground mb-1">5,000+</p>
            <p className="text-sm text-muted-foreground">Happy Customers</p>
          </div>
          <div>
            <p className="font-heading text-4xl font-bold text-foreground mb-1">500+</p>
            <p className="text-sm text-muted-foreground">Verified Cleaners</p>
          </div>
          <div>
            <p className="font-heading text-4xl font-bold text-foreground mb-1">4.9</p>
            <p className="text-sm text-muted-foreground">Average Rating</p>
          </div>
          <div>
            <p className="font-heading text-4xl font-bold text-foreground mb-1">98%</p>
            <p className="text-sm text-muted-foreground">Would Recommend</p>
          </div>
        </div>
      </div>
    </section>
  );
};
