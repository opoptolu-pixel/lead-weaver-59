import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Sparkles,
  Phone,
  Mail,
  MapPin,
  Copy,
  Check,
  Loader2,
  User,
  LogOut,
  Search,
  Calendar,
  PoundSterling,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

interface UnlockedLead {
  id: string;
  postcode: string;
  job_type: string;
  display_value: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  customer_address: string;
  date: string;
  unlocked_at: string;
}

export default function Dashboard() {
  const { user, profile, signOut, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [leads, setLeads] = useState<UnlockedLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  // Fetch unlocked leads
  useEffect(() => {
    const fetchLeads = async () => {
      if (!user) return;

      try {
        const { data, error } = await supabase
          .from("leads")
          .select("*")
          .eq("unlocked_by", user.id)
          .order("unlocked_at", { ascending: false });

        if (error) throw error;
        setLeads(data || []);
      } catch (error) {
        console.error("Error fetching leads:", error);
        toast.error("Failed to load your leads");
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchLeads();
    }
  }, [user]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
    toast.success("Signed out successfully");
  };

  const copyToClipboard = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopiedField(null), 2000);
  };

  const filteredLeads = leads.filter(
    (lead) =>
      lead.postcode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.job_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.customer_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "d MMM yyyy");
    } catch {
      return dateString;
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-secondary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-primary border-b border-border sticky top-0 z-50">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-20">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-secondary/20">
                <Sparkles className="w-5 h-5 text-secondary" />
              </div>
              <span className="font-heading text-xl font-bold text-primary-foreground">
                Deep Clean UK
              </span>
            </Link>

            <div className="flex items-center gap-4">
              <Link to="/leads">
                <Button variant="outlineHero" size="sm">
                  Browse Leads
                </Button>
              </Link>
              <div className="flex items-center gap-3">
                <div className="hidden sm:block text-right">
                  <p className="text-primary-foreground text-sm font-medium">
                    {profile?.business_name || user?.email}
                  </p>
                  <p className="text-primary-foreground/70 text-xs">
                    {profile?.credits || 0} credits
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSignOut}
                  className="text-primary-foreground hover:bg-primary-foreground/10"
                >
                  <LogOut className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Welcome section */}
        <div className="mb-8">
          <h1 className="font-heading text-3xl font-bold text-foreground mb-2">
            Your Dashboard
          </h1>
          <p className="text-muted-foreground">
            Manage your unlocked leads and account
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-card rounded-xl border border-border p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-secondary/20 flex items-center justify-center">
                <User className="w-6 h-6 text-secondary" />
              </div>
              <div>
                <p className="text-muted-foreground text-sm">Unlocked Leads</p>
                <p className="text-foreground text-2xl font-bold">{leads.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-secondary/20 flex items-center justify-center">
                <PoundSterling className="w-6 h-6 text-secondary" />
              </div>
              <div>
                <p className="text-muted-foreground text-sm">Credits Available</p>
                <p className="text-foreground text-2xl font-bold">{profile?.credits || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-secondary/20 flex items-center justify-center">
                <Calendar className="w-6 h-6 text-secondary" />
              </div>
              <div>
                <p className="text-muted-foreground text-sm">Member Since</p>
                <p className="text-foreground text-2xl font-bold">
                  {user?.created_at ? formatDate(user.created_at) : "N/A"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Leads section */}
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="p-6 border-b border-border">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <h2 className="font-heading text-xl font-bold text-foreground">
                Your Unlocked Leads
              </h2>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search leads..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-secondary" />
            </div>
          ) : filteredLeads.length === 0 ? (
            <div className="text-center py-20 px-4">
              {leads.length === 0 ? (
                <>
                  <p className="text-muted-foreground text-lg mb-4">
                    You haven't unlocked any leads yet
                  </p>
                  <Link to="/leads">
                    <Button variant="cta">Browse Available Leads</Button>
                  </Link>
                </>
              ) : (
                <p className="text-muted-foreground text-lg">
                  No leads match your search
                </p>
              )}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filteredLeads.map((lead) => (
                <div key={lead.id} className="p-6 hover:bg-muted/30 transition-colors">
                  <div className="flex flex-col lg:flex-row lg:items-start gap-6">
                    {/* Lead info */}
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <span className="inline-block bg-muted text-foreground font-semibold rounded-lg px-3 py-1 text-sm mb-2">
                            {lead.postcode}
                          </span>
                          <h3 className="font-semibold text-foreground text-lg">
                            {lead.job_type}
                          </h3>
                        </div>
                        <div className="text-right">
                          <p className="text-secondary font-bold text-xl">
                            {lead.display_value}
                          </p>
                          <p className="text-muted-foreground text-sm">
                            {formatDate(lead.date)}
                          </p>
                        </div>
                      </div>

                      <p className="text-foreground font-medium mb-4">
                        {lead.customer_name}
                      </p>

                      {/* Contact details */}
                      <div className="grid md:grid-cols-2 gap-3">
                        <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2">
                          <Phone className="w-4 h-4 text-secondary" />
                          <a
                            href={`tel:${lead.customer_phone}`}
                            className="text-foreground hover:text-secondary transition-colors flex-1"
                          >
                            {lead.customer_phone}
                          </a>
                          <button
                            onClick={() => copyToClipboard(lead.customer_phone, `phone-${lead.id}`)}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            {copiedField === `phone-${lead.id}` ? (
                              <Check className="w-4 h-4" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </button>
                        </div>

                        <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2">
                          <Mail className="w-4 h-4 text-secondary" />
                          <a
                            href={`mailto:${lead.customer_email}`}
                            className="text-foreground hover:text-secondary transition-colors flex-1 truncate"
                          >
                            {lead.customer_email}
                          </a>
                          <button
                            onClick={() => copyToClipboard(lead.customer_email, `email-${lead.id}`)}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            {copiedField === `email-${lead.id}` ? (
                              <Check className="w-4 h-4" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </button>
                        </div>

                        <div className="md:col-span-2 flex items-start gap-2 bg-muted/50 rounded-lg px-3 py-2">
                          <MapPin className="w-4 h-4 text-secondary mt-0.5" />
                          <span className="text-foreground flex-1">
                            {lead.customer_address}
                          </span>
                          <button
                            onClick={() => copyToClipboard(lead.customer_address, `address-${lead.id}`)}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            {copiedField === `address-${lead.id}` ? (
                              <Check className="w-4 h-4" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex lg:flex-col gap-2">
                      <a href={`tel:${lead.customer_phone}`} className="flex-1 lg:flex-none">
                        <Button variant="cta" size="sm" className="w-full gap-2">
                          <Phone className="w-4 h-4" />
                          Call
                        </Button>
                      </a>
                      <a href={`mailto:${lead.customer_email}`} className="flex-1 lg:flex-none">
                        <Button variant="outline" size="sm" className="w-full gap-2">
                          <Mail className="w-4 h-4" />
                          Email
                        </Button>
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
