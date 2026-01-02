import { useState } from "react";
import { Copy, Check, Link2, ExternalLink, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import AdminLayout from "@/components/admin/AdminLayout";

const commonSources = [
  { value: "facebook", label: "Facebook" },
  { value: "instagram", label: "Instagram" },
  { value: "google", label: "Google" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "twitter", label: "Twitter/X" },
  { value: "tiktok", label: "TikTok" },
  { value: "email", label: "Email" },
  { value: "newsletter", label: "Newsletter" },
  { value: "referral", label: "Referral" },
];

const commonMediums = [
  { value: "cpc", label: "CPC (Cost Per Click)" },
  { value: "cpm", label: "CPM (Cost Per Mille)" },
  { value: "social", label: "Social" },
  { value: "email", label: "Email" },
  { value: "organic", label: "Organic" },
  { value: "referral", label: "Referral" },
  { value: "display", label: "Display" },
  { value: "affiliate", label: "Affiliate" },
  { value: "video", label: "Video" },
];

interface SavedLink {
  id: string;
  name: string;
  url: string;
  createdAt: Date;
}

export default function AdminUtmBuilder() {
  const [baseUrl, setBaseUrl] = useState("https://cleanda.co.uk");
  const [utmSource, setUtmSource] = useState("");
  const [utmMedium, setUtmMedium] = useState("");
  const [utmCampaign, setUtmCampaign] = useState("");
  const [utmTerm, setUtmTerm] = useState("");
  const [utmContent, setUtmContent] = useState("");
  const [copied, setCopied] = useState(false);
  const [savedLinks, setSavedLinks] = useState<SavedLink[]>(() => {
    const saved = localStorage.getItem("admin-utm-links");
    return saved ? JSON.parse(saved) : [];
  });
  const [linkName, setLinkName] = useState("");

  const generateUrl = () => {
    if (!baseUrl) return "";
    
    const url = new URL(baseUrl);
    
    if (utmSource) url.searchParams.set("utm_source", utmSource.toLowerCase().replace(/\s+/g, "_"));
    if (utmMedium) url.searchParams.set("utm_medium", utmMedium.toLowerCase().replace(/\s+/g, "_"));
    if (utmCampaign) url.searchParams.set("utm_campaign", utmCampaign.toLowerCase().replace(/\s+/g, "_"));
    if (utmTerm) url.searchParams.set("utm_term", utmTerm.toLowerCase().replace(/\s+/g, "_"));
    if (utmContent) url.searchParams.set("utm_content", utmContent.toLowerCase().replace(/\s+/g, "_"));
    
    return url.toString();
  };

  const generatedUrl = generateUrl();
  const hasUtmParams = utmSource || utmMedium || utmCampaign;

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(generatedUrl);
      setCopied(true);
      toast.success("Link copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy link");
    }
  };

  const saveLink = () => {
    if (!linkName.trim()) {
      toast.error("Please enter a name for this link");
      return;
    }
    if (!hasUtmParams) {
      toast.error("Please add at least one UTM parameter");
      return;
    }

    const newLink: SavedLink = {
      id: crypto.randomUUID(),
      name: linkName,
      url: generatedUrl,
      createdAt: new Date(),
    };

    const updatedLinks = [newLink, ...savedLinks];
    setSavedLinks(updatedLinks);
    localStorage.setItem("admin-utm-links", JSON.stringify(updatedLinks));
    setLinkName("");
    toast.success("Link saved!");
  };

  const deleteLink = (id: string) => {
    const updatedLinks = savedLinks.filter(link => link.id !== id);
    setSavedLinks(updatedLinks);
    localStorage.setItem("admin-utm-links", JSON.stringify(updatedLinks));
    toast.success("Link deleted");
  };

  const copyLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied!");
    } catch {
      toast.error("Failed to copy");
    }
  };

  const clearForm = () => {
    setUtmSource("");
    setUtmMedium("");
    setUtmCampaign("");
    setUtmTerm("");
    setUtmContent("");
    setLinkName("");
  };

  return (
    <AdminLayout title="UTM Link Builder">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <p className="text-muted-foreground">
            Create trackable campaign links with UTM parameters to measure lead sources.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Builder Form */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Link2 className="w-5 h-5" />
                Build Your Link
              </CardTitle>
              <CardDescription>
                Fill in the parameters below to generate a trackable URL
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Base URL */}
              <div className="space-y-2">
                <Label htmlFor="baseUrl">Base URL *</Label>
                <Input
                  id="baseUrl"
                  placeholder="https://cleanda.co.uk"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                />
              </div>

              {/* UTM Source */}
              <div className="space-y-2">
                <Label htmlFor="source">Campaign Source * (utm_source)</Label>
                <div className="flex gap-2">
                  <Select value={utmSource} onValueChange={setUtmSource}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select or type source..." />
                    </SelectTrigger>
                    <SelectContent>
                      {commonSources.map((source) => (
                        <SelectItem key={source.value} value={source.value}>
                          {source.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="Or custom..."
                    value={utmSource}
                    onChange={(e) => setUtmSource(e.target.value)}
                    className="flex-1"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  The referrer: facebook, google, newsletter
                </p>
              </div>

              {/* UTM Medium */}
              <div className="space-y-2">
                <Label htmlFor="medium">Campaign Medium * (utm_medium)</Label>
                <div className="flex gap-2">
                  <Select value={utmMedium} onValueChange={setUtmMedium}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select or type medium..." />
                    </SelectTrigger>
                    <SelectContent>
                      {commonMediums.map((medium) => (
                        <SelectItem key={medium.value} value={medium.value}>
                          {medium.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="Or custom..."
                    value={utmMedium}
                    onChange={(e) => setUtmMedium(e.target.value)}
                    className="flex-1"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Marketing medium: cpc, social, email
                </p>
              </div>

              {/* UTM Campaign */}
              <div className="space-y-2">
                <Label htmlFor="campaign">Campaign Name * (utm_campaign)</Label>
                <Input
                  id="campaign"
                  placeholder="e.g., spring_sale_2024"
                  value={utmCampaign}
                  onChange={(e) => setUtmCampaign(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Product, promo code, or slogan
                </p>
              </div>

              {/* UTM Term (Optional) */}
              <div className="space-y-2">
                <Label htmlFor="term">Campaign Term (utm_term) - Optional</Label>
                <Input
                  id="term"
                  placeholder="e.g., cleaning+services"
                  value={utmTerm}
                  onChange={(e) => setUtmTerm(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Identify paid keywords
                </p>
              </div>

              {/* UTM Content (Optional) */}
              <div className="space-y-2">
                <Label htmlFor="content">Campaign Content (utm_content) - Optional</Label>
                <Input
                  id="content"
                  placeholder="e.g., hero_banner"
                  value={utmContent}
                  onChange={(e) => setUtmContent(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Differentiate ads or links that point to the same URL
                </p>
              </div>

              <Button variant="outline" onClick={clearForm} className="w-full">
                Clear Form
              </Button>
            </CardContent>
          </Card>

          {/* Generated URL & Saved Links */}
          <div className="space-y-6">
            {/* Generated URL */}
            <Card>
              <CardHeader>
                <CardTitle>Generated URL</CardTitle>
                <CardDescription>
                  Your trackable campaign link
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-3 bg-muted rounded-lg break-all text-sm font-mono">
                  {generatedUrl || "Enter parameters to generate URL"}
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={copyToClipboard}
                    disabled={!hasUtmParams}
                    className="flex-1"
                  >
                    {copied ? (
                      <Check className="w-4 h-4 mr-2" />
                    ) : (
                      <Copy className="w-4 h-4 mr-2" />
                    )}
                    {copied ? "Copied!" : "Copy Link"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => window.open(generatedUrl, "_blank")}
                    disabled={!hasUtmParams}
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                </div>

                {/* Save Link */}
                <div className="pt-4 border-t space-y-3">
                  <Label>Save this link for later</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Link name (e.g., FB Spring Campaign)"
                      value={linkName}
                      onChange={(e) => setLinkName(e.target.value)}
                    />
                    <Button onClick={saveLink} disabled={!hasUtmParams}>
                      <Plus className="w-4 h-4 mr-2" />
                      Save
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Saved Links */}
            <Card>
              <CardHeader>
                <CardTitle>Saved Links</CardTitle>
                <CardDescription>
                  {savedLinks.length} link{savedLinks.length !== 1 ? "s" : ""} saved locally
                </CardDescription>
              </CardHeader>
              <CardContent>
                {savedLinks.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    No saved links yet. Create and save a link above.
                  </p>
                ) : (
                  <div className="space-y-3 max-h-80 overflow-y-auto">
                    {savedLinks.map((link) => (
                      <div
                        key={link.id}
                        className="p-3 border rounded-lg space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm">{link.name}</span>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => copyLink(link.url)}
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => deleteLink(link.id)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground break-all font-mono">
                          {link.url}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Created: {new Date(link.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* UTM Parameter Guide */}
        <Card>
          <CardHeader>
            <CardTitle>UTM Parameter Guide</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-1">
                <p className="font-medium text-sm">utm_source (Required)</p>
                <p className="text-xs text-muted-foreground">
                  Identifies which site sent the traffic. Examples: google, facebook, newsletter
                </p>
              </div>
              <div className="space-y-1">
                <p className="font-medium text-sm">utm_medium (Required)</p>
                <p className="text-xs text-muted-foreground">
                  Identifies the marketing medium. Examples: cpc, email, social
                </p>
              </div>
              <div className="space-y-1">
                <p className="font-medium text-sm">utm_campaign (Required)</p>
                <p className="text-xs text-muted-foreground">
                  Identifies the specific campaign. Examples: spring_sale, black_friday
                </p>
              </div>
              <div className="space-y-1">
                <p className="font-medium text-sm">utm_term (Optional)</p>
                <p className="text-xs text-muted-foreground">
                  Identifies search terms. Used for paid search campaigns.
                </p>
              </div>
              <div className="space-y-1">
                <p className="font-medium text-sm">utm_content (Optional)</p>
                <p className="text-xs text-muted-foreground">
                  Differentiates similar content. Examples: hero_cta, sidebar_link
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
