import { useParams, Link, useNavigate } from "react-router-dom";
import { Clock, ArrowLeft, ArrowRight, Calendar, Tag } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SEOHead } from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { ScrollReveal } from "@/components/ScrollReveal";
import { SocialShareButtons } from "@/components/SocialShareButtons";
import { cn } from "@/lib/utils";
import { 
  getPostBySlug, 
  getRelatedPosts, 
  categoryLabels, 
  categoryColors,
  type BlogPost 
} from "@/data/blogPosts";

const BlogPost = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  
  const post = slug ? getPostBySlug(slug) : undefined;
  const relatedPosts = post ? getRelatedPosts(post, 3) : [];

  if (!post) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-32 text-center">
          <h1 className="text-4xl font-bold mb-4">Article Not Found</h1>
          <p className="text-muted-foreground mb-8">The article you're looking for doesn't exist.</p>
          <Button onClick={() => navigate("/blog")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Blog
          </Button>
        </main>
        <Footer />
      </div>
    );
  }

  const articleStructuredData = {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": `https://cleanda.co.uk/blog/${post.slug}#article`,
    "headline": post.title,
    "description": post.metaDescription,
    "image": post.featuredImage || "https://cleanda.co.uk/og-image.png",
    "datePublished": post.publishedAt,
    "dateModified": post.publishedAt,
    "author": {
      "@type": "Organization",
      "name": "Cleanda",
      "@id": "https://cleanda.co.uk/#organization"
    },
    "publisher": {
      "@id": "https://cleanda.co.uk/#organization"
    },
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": `https://cleanda.co.uk/blog/${post.slug}`
    },
    "keywords": post.keywords.join(", "),
    "wordCount": post.content.split(/\s+/).length,
    "articleSection": categoryLabels[post.category],
    "inLanguage": "en-GB"
  };

  const breadcrumbStructuredData = {
    "@context": "https://schema.org",
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
        "name": "Blog",
        "item": "https://cleanda.co.uk/blog"
      },
      {
        "@type": "ListItem",
        "position": 3,
        "name": post.title,
        "item": `https://cleanda.co.uk/blog/${post.slug}`
      }
    ]
  };

  const combinedStructuredData = {
    "@context": "https://schema.org",
    "@graph": [articleStructuredData, breadcrumbStructuredData]
  };

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title={`${post.title} | Cleanda Blog`}
        description={post.metaDescription}
        canonical={`https://cleanda.co.uk/blog/${post.slug}`}
        structuredData={combinedStructuredData}
      />
      <Header />

      {/* Hero Section */}
      <section className="pt-32 pb-12 bg-primary relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-secondary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        </div>
        <div className="container mx-auto px-4 relative">
          <div className="max-w-3xl mx-auto">
            {/* Breadcrumb */}
            <nav className="mb-6" aria-label="Breadcrumb">
              <ol className="flex items-center gap-2 text-sm text-primary-foreground/70">
                <li>
                  <Link to="/" className="hover:text-primary-foreground transition-colors">Home</Link>
                </li>
                <li>/</li>
                <li>
                  <Link to="/blog" className="hover:text-primary-foreground transition-colors">Blog</Link>
                </li>
                <li>/</li>
                <li className="text-primary-foreground truncate max-w-[200px]">{post.title}</li>
              </ol>
            </nav>

            {/* Category */}
            <span className={cn(
              "inline-block text-xs font-semibold px-3 py-1 rounded-full mb-4",
              categoryColors[post.category]
            )}>
              {categoryLabels[post.category]}
            </span>

            {/* Title */}
            <h1 className="font-heading text-3xl md:text-4xl lg:text-5xl font-bold text-primary-foreground mb-6 leading-tight">
              {post.title}
            </h1>

            {/* Meta */}
            <div className="flex flex-wrap items-center gap-4 text-sm text-primary-foreground/80">
              <div className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                <time dateTime={post.publishedAt}>
                  {new Date(post.publishedAt).toLocaleDateString('en-GB', { 
                    day: 'numeric', 
                    month: 'long', 
                    year: 'numeric' 
                  })}
                </time>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                <span>{post.readingTime} min read</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <main className="container mx-auto px-4 py-12">
        <div className="max-w-3xl mx-auto">
          {/* Article Content */}
          <article className="prose prose-lg max-w-none prose-headings:font-heading prose-headings:font-bold prose-h2:text-2xl prose-h2:mt-12 prose-h2:mb-6 prose-h3:text-xl prose-h3:mt-10 prose-h3:mb-4 prose-p:text-muted-foreground prose-p:leading-loose prose-p:mb-6 prose-li:text-muted-foreground prose-li:leading-relaxed prose-li:mb-2 prose-strong:text-foreground prose-ul:my-6 prose-ul:space-y-2 prose-ol:my-6 prose-ol:space-y-2">
            <div className="space-y-6" dangerouslySetInnerHTML={{ __html: formatContent(post.content) }} />
          </article>

          {/* CTA Box */}
          <ScrollReveal animation="fade-up">
            <div className="mt-12 bg-secondary/10 border border-secondary/20 rounded-2xl p-6 md:p-8">
              <h2 className="font-heading text-xl md:text-2xl font-bold text-foreground mb-3">
                Need Professional Cleaning Help?
              </h2>
              <p className="text-muted-foreground mb-6">
                Get free quotes from verified local cleaners. Whether you need {categoryLabels[post.category].toLowerCase()} or any other cleaning service, we'll connect you with trusted professionals in your area.
              </p>
              <Link to="/request-cleaning">
                <Button variant="cta" size="lg">
                  Get Free Quotes
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
            </div>
          </ScrollReveal>

          {/* Social Sharing */}
          <div className="mt-10 pt-6 border-t border-border">
            <SocialShareButtons 
              url={`https://cleanda.co.uk/blog/${post.slug}`}
              title={post.title}
              description={post.metaDescription}
            />
          </div>

          {/* Tags/Keywords */}
          <div className="mt-8 pt-6 border-t border-border">
            <div className="flex items-center gap-2 flex-wrap">
              <Tag className="w-4 h-4 text-muted-foreground" />
              {post.keywords.map((keyword, index) => (
                <span 
                  key={index}
                  className="text-sm bg-muted px-3 py-1 rounded-full text-muted-foreground"
                >
                  {keyword}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Related Posts */}
        {relatedPosts.length > 0 && (
          <section className="max-w-6xl mx-auto mt-16 pt-12 border-t border-border" aria-labelledby="related-posts-heading">
            <h2 id="related-posts-heading" className="font-heading text-2xl md:text-3xl font-bold text-foreground mb-8 text-center">
              Related Articles
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {relatedPosts.map((relatedPost, index) => (
                <ScrollReveal key={relatedPost.id} animation="fade-up" delay={index * 50}>
                  <Link to={`/blog/${relatedPost.slug}`} className="group block h-full">
                    <article className="h-full bg-card rounded-2xl border border-border shadow-card overflow-hidden transition-all duration-300 group-hover:shadow-elevated group-hover:border-secondary/40 group-hover:-translate-y-1 flex flex-col">
                      <div className="p-6 pb-0">
                        <span className={cn(
                          "inline-block text-xs font-semibold px-3 py-1 rounded-full",
                          categoryColors[relatedPost.category]
                        )}>
                          {categoryLabels[relatedPost.category]}
                        </span>
                      </div>
                      <div className="p-6 flex-1 flex flex-col">
                        <h3 className="font-heading font-bold text-lg text-foreground mb-3 group-hover:text-secondary transition-colors line-clamp-2">
                          {relatedPost.title}
                        </h3>
                        <p className="text-muted-foreground text-sm leading-relaxed flex-1 line-clamp-2">
                          {relatedPost.excerpt}
                        </p>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground mt-4 pt-4 border-t border-border">
                          <Clock className="w-4 h-4" />
                          <span>{relatedPost.readingTime} min read</span>
                        </div>
                      </div>
                    </article>
                  </Link>
                </ScrollReveal>
              ))}
            </div>
          </section>
        )}

        {/* Back to Blog */}
        <div className="max-w-3xl mx-auto mt-12 text-center">
          <Link to="/blog">
            <Button variant="outline" size="lg">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to All Articles
            </Button>
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  );
};

// Helper function to convert markdown-like content to HTML with proper spacing
function formatContent(content: string): string {
  // Split content into sections for better paragraph handling
  const lines = content.split('\n');
  let html = '';
  let inList = false;
  let listType = '';

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();
    
    // Skip empty lines but use them as paragraph breaks
    if (!line) {
      if (inList) {
        html += listType === 'ul' ? '</ul>' : '</ol>';
        inList = false;
      }
      continue;
    }

    // Headers
    if (line.startsWith('### ')) {
      if (inList) {
        html += listType === 'ul' ? '</ul>' : '</ol>';
        inList = false;
      }
      html += `<h3 class="mt-10 mb-4">${line.substring(4)}</h3>`;
      continue;
    }
    if (line.startsWith('## ')) {
      if (inList) {
        html += listType === 'ul' ? '</ul>' : '</ol>';
        inList = false;
      }
      html += `<h2 class="mt-12 mb-6">${line.substring(3)}</h2>`;
      continue;
    }

    // Bold text
    line = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    // Unordered list items
    if (line.startsWith('- [ ] ')) {
      if (!inList || listType !== 'ul') {
        if (inList) html += listType === 'ul' ? '</ul>' : '</ol>';
        html += '<ul class="space-y-3 my-6">';
        inList = true;
        listType = 'ul';
      }
      html += `<li class="flex items-start gap-3 leading-relaxed"><input type="checkbox" disabled class="mt-1.5 flex-shrink-0" /><span>${line.substring(6)}</span></li>`;
      continue;
    }
    if (line.startsWith('- ')) {
      if (!inList || listType !== 'ul') {
        if (inList) html += listType === 'ul' ? '</ul>' : '</ol>';
        html += '<ul class="space-y-3 my-6">';
        inList = true;
        listType = 'ul';
      }
      html += `<li class="leading-relaxed pl-2">${line.substring(2)}</li>`;
      continue;
    }

    // Ordered list items
    const orderedMatch = line.match(/^(\d+)\. (.+)$/);
    if (orderedMatch) {
      if (!inList || listType !== 'ol') {
        if (inList) html += listType === 'ul' ? '</ul>' : '</ol>';
        html += '<ol class="space-y-3 my-6 list-decimal list-inside">';
        inList = true;
        listType = 'ol';
      }
      html += `<li class="leading-relaxed pl-2">${orderedMatch[2]}</li>`;
      continue;
    }

    // Regular paragraph
    if (inList) {
      html += listType === 'ul' ? '</ul>' : '</ol>';
      inList = false;
    }
    html += `<p class="leading-loose mb-6">${line}</p>`;
  }

  // Close any remaining list
  if (inList) {
    html += listType === 'ul' ? '</ul>' : '</ol>';
  }

  return html;
}

export default BlogPost;
