import { Facebook, Twitter, Linkedin, Link2, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface SocialShareButtonsProps {
  url: string;
  title: string;
  description?: string;
}

export const SocialShareButtons = ({ url, title, description }: SocialShareButtonsProps) => {
  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);
  const encodedDescription = encodeURIComponent(description || "");

  const shareLinks = {
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    twitter: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
    whatsapp: `https://wa.me/?text=${encodedTitle}%20${encodedUrl}`,
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied to clipboard!");
    } catch {
      toast.error("Failed to copy link");
    }
  };

  const openShare = (platform: keyof typeof shareLinks) => {
    window.open(shareLinks[platform], "_blank", "width=600,height=400,noopener,noreferrer");
  };

  return (
    <div className="flex flex-col gap-3">
      <span className="text-sm font-medium text-muted-foreground">Share this article</span>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={() => openShare("facebook")}
          className="hover:bg-[#1877F2] hover:text-white hover:border-[#1877F2] transition-colors"
          aria-label="Share on Facebook"
        >
          <Facebook className="w-4 h-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={() => openShare("twitter")}
          className="hover:bg-[#1DA1F2] hover:text-white hover:border-[#1DA1F2] transition-colors"
          aria-label="Share on Twitter"
        >
          <Twitter className="w-4 h-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={() => openShare("linkedin")}
          className="hover:bg-[#0A66C2] hover:text-white hover:border-[#0A66C2] transition-colors"
          aria-label="Share on LinkedIn"
        >
          <Linkedin className="w-4 h-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={() => openShare("whatsapp")}
          className="hover:bg-[#25D366] hover:text-white hover:border-[#25D366] transition-colors"
          aria-label="Share on WhatsApp"
        >
          <MessageCircle className="w-4 h-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={copyLink}
          className="hover:bg-secondary hover:text-secondary-foreground transition-colors"
          aria-label="Copy link"
        >
          <Link2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};
