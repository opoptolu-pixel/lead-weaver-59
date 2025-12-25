import { useState } from "react";
import { Link } from "react-router-dom";
import { Clock, ArrowRight, Search, Filter } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SEOHead } from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollReveal } from "@/components/ScrollReveal";
import { cn } from "@/lib/utils";
import { 
  blogPosts, 
  categoryLabels, 
  categoryColors, 
  getAllCategories,
  type BlogCategory 
} from "@/data/blogPosts";

const Blog = () => {
  const [selectedCategory, setSelectedCategory] = useState<BlogCategory | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");

  const categories = getAllCategories();
  
  const filteredPosts = blogPosts.filter(post => {
    const matchesCategory = selectedCategory === "all" || post.category === selectedCategory;
    const matchesSearch = searchQuery === "" || 
      post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      post.excerpt.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const blogStructuredData = {
    "@context": "https://schema.org",
    "@type": "Blog",
    "@id": "https://deepcleanuk.com/blog#blog",
    "name": "Deep Clean UK Blog - Cleaning Tips & Guides",
    "description": "Expert cleaning tips, guides, and advice for homes and businesses across the UK.",
    "url": "https://deepcleanuk.com/blog",
    "publisher": {
      "@id": "https://deepcleanuk.com/#organization"
    },
    "blogPost": blogPosts.slice(0, 10).map(post => ({
      "@type": "BlogPosting",
      "headline": post.title,
      "description": post.excerpt,
      "url": `https://deepcleanuk.com/blog/${post.slug}`,
      "datePublished": post.publishedAt,
      "author": {
        "@type": "Organization",
        "name": "Deep Clean UK"
      }
    }))
  };

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Cleaning Tips & Guides | Expert Advice | Deep Clean UK Blog"
        description="Expert cleaning tips, guides, and advice for UK homes and businesses. Learn professional techniques for deep cleaning, carpet care, end of tenancy cleaning and more."
        canonical="https://deepcleanuk.com/blog"
        structuredData={blogStructuredData}
      />
      <Header />

      {/* Hero Section */}
      <section className="pt-32 pb-16 bg-primary relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-secondary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-white/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
        </div>
        <div className="container mx-auto px-4 relative">
          <div className="max-w-3xl mx-auto text-center">
            <span className="inline-block text-sm font-semibold text-secondary uppercase tracking-wider mb-3">
              Expert Advice
            </span>
            <h1 className="font-heading text-4xl md:text-5xl font-bold text-primary-foreground mb-4">
              Cleaning Tips & Guides
            </h1>
            <p className="text-xl text-primary-foreground/80">
              Professional cleaning advice for homes and businesses across the UK
            </p>
          </div>
        </div>
      </section>

      <main className="container mx-auto px-4 py-16">
        {/* Filters */}
        <div className="max-w-6xl mx-auto mb-12">
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            {/* Search */}
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search articles..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Category Filters */}
            <div className="flex flex-wrap gap-2">
              <Button
                variant={selectedCategory === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory("all")}
                className="rounded-full"
              >
                All
              </Button>
              {categories.map((category) => (
                <Button
                  key={category}
                  variant={selectedCategory === category ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCategory(category)}
                  className="rounded-full"
                >
                  {categoryLabels[category]}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {/* Blog Posts Grid */}
        <div className="max-w-6xl mx-auto">
          {filteredPosts.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-muted-foreground text-lg">No articles found matching your criteria.</p>
              <Button 
                variant="outline" 
                onClick={() => { setSelectedCategory("all"); setSearchQuery(""); }}
                className="mt-4"
              >
                Clear Filters
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredPosts.map((post, index) => (
                <ScrollReveal key={post.id} animation="fade-up" delay={index * 50}>
                  <Link to={`/blog/${post.slug}`} className="group block h-full">
                    <article className="h-full bg-card rounded-2xl border border-border shadow-card overflow-hidden transition-all duration-300 group-hover:shadow-elevated group-hover:border-secondary/40 group-hover:-translate-y-1 flex flex-col">
                      {/* Category Badge */}
                      <div className="p-6 pb-0">
                        <span className={cn(
                          "inline-block text-xs font-semibold px-3 py-1 rounded-full",
                          categoryColors[post.category]
                        )}>
                          {categoryLabels[post.category]}
                        </span>
                      </div>

                      {/* Content */}
                      <div className="p-6 flex-1 flex flex-col">
                        <h2 className="font-heading font-bold text-xl text-foreground mb-3 group-hover:text-secondary transition-colors line-clamp-2">
                          {post.title}
                        </h2>
                        <p className="text-muted-foreground text-sm leading-relaxed mb-4 flex-1 line-clamp-3">
                          {post.excerpt}
                        </p>

                        {/* Meta */}
                        <div className="flex items-center justify-between pt-4 border-t border-border">
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Clock className="w-4 h-4" />
                            <span>{post.readingTime} min read</span>
                          </div>
                          <span className="text-sm text-secondary font-medium flex items-center gap-1 group-hover:gap-2 transition-all">
                            Read More
                            <ArrowRight className="w-4 h-4" />
                          </span>
                        </div>
                      </div>
                    </article>
                  </Link>
                </ScrollReveal>
              ))}
            </div>
          )}
        </div>

        {/* CTA Section */}
        <ScrollReveal animation="fade-up" delay={100}>
          <div className="max-w-4xl mx-auto mt-20 text-center">
            <div className="bg-primary rounded-3xl p-8 md:p-12">
              <h2 className="font-heading text-2xl md:text-3xl font-bold text-primary-foreground mb-4">
                Need Professional Cleaning Help?
              </h2>
              <p className="text-primary-foreground/80 mb-6 max-w-xl mx-auto">
                Get free quotes from verified local cleaners. We'll connect you with professionals who can help with any cleaning task.
              </p>
              <Link to="/request-cleaning">
                <Button variant="cta" size="lg">
                  Get Free Quotes
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
            </div>
          </div>
        </ScrollReveal>
      </main>

      <Footer />
    </div>
  );
};

export default Blog;
