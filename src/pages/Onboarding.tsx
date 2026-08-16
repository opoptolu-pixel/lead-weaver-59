import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Loader2, MapPin, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const services = [
  { slug: "end-of-tenancy", name: "End of Tenancy Cleaning" },
  { slug: "move-in-move-out", name: "Move-In / Move-Out Cleaning" },
  { slug: "one-off-deep", name: "One-Off Deep Cleaning" },
  { slug: "weekly-routine", name: "Weekly Routine Cleaning" },
  { slug: "post-construction", name: "Post-Construction Deep Cleaning" },
  { slug: "airbnb-short-let", name: "Airbnb / Short-Let Cleaning" },
];

export default function Onboarding() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [postcode, setPostcode] = useState("");
  const [experienceSummary, setExperienceSummary] = useState("");
  const [hasTransport, setHasTransport] = useState(false);
  const [serviceSlugs, setServiceSlugs] = useState<string[]>([]);

  useEffect(() => {
    if (!loading && !user) navigate("/auth?mode=signup&account=cleaner");
  }, [loading, navigate, user]);

  const toggleService = (slug: string) => {
    setServiceSlugs((current) => current.includes(slug) ? current.filter((item) => item !== slug) : [...current, slug]);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke("submit-cleaner-application", {
      body: { fullName, phone, postcode, experienceSummary, hasTransport, serviceSlugs },
    });
    setSubmitting(false);
    if (error || data?.error) return toast.error(data?.error || error?.message || "Could not submit your application");
    toast.success("Cleaner application submitted");
    navigate("/cleaner/dashboard");
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-primary px-4 py-4"><div className="mx-auto max-w-4xl"><Logo variant="white" size="md" /></div></header>
      <main className="mx-auto max-w-3xl px-4 py-10">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary/15"><Sparkles className="h-7 w-7 text-secondary" /></div>
          <h1 className="text-3xl font-bold">Apply to clean with Cleanda</h1>
          <p className="mt-3 text-muted-foreground">Get managed cleaning jobs across Greater Manchester. There are no lead fees or monthly subscriptions.</p>
        </div>
        <form onSubmit={submit} className="space-y-6 rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
          <div className="grid gap-5 sm:grid-cols-2">
            <div><Label htmlFor="full-name">Full name</Label><Input id="full-name" value={fullName} onChange={(event) => setFullName(event.target.value)} required className="mt-2" /></div>
            <div><Label htmlFor="phone">Mobile number</Label><Input id="phone" type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="07..." required className="mt-2" /></div>
          </div>
          <div><Label htmlFor="postcode">Home postcode</Label><div className="relative mt-2"><MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input id="postcode" value={postcode} onChange={(event) => setPostcode(event.target.value.toUpperCase())} className="pl-10" required /></div><p className="mt-1 text-xs text-muted-foreground">The launch area is Greater Manchester. Admins will confirm the jobs you can reasonably cover.</p></div>
          <div><Label>Cleaning services you can perform</Label><div className="mt-3 grid gap-3 sm:grid-cols-2">{services.map((service) => <label key={service.slug} className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 hover:bg-muted/50"><Checkbox checked={serviceSlugs.includes(service.slug)} onCheckedChange={() => toggleService(service.slug)} /><span className="text-sm">{service.name}</span></label>)}</div></div>
          <div><Label htmlFor="experience">Experience</Label><Textarea id="experience" value={experienceSummary} onChange={(event) => setExperienceSummary(event.target.value)} rows={4} placeholder="Briefly describe your cleaning experience and the type of work you have completed." className="mt-2" /></div>
          <label className="flex items-start gap-3 rounded-lg bg-muted/50 p-4"><Checkbox checked={hasTransport} onCheckedChange={(checked) => setHasTransport(checked === true)} /><span><span className="block font-medium">I have reliable transport</span><span className="text-sm text-muted-foreground">This helps Cleanda assess suitable locations but is not an automatic requirement.</span></span></label>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"><p className="font-medium"><Check className="mr-2 inline h-4 w-4" />What happens next</p><p className="mt-1">Cleanda reviews your application. If approved, you will be able to receive jobs showing the service, area, schedule and cleaner payout before accepting.</p></div>
          <Button type="submit" size="lg" className="w-full" disabled={submitting || serviceSlugs.length === 0}>{submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Submit cleaner application</Button>
        </form>
      </main>
    </div>
  );
}
