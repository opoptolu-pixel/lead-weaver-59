import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Download, FileCheck2, Loader2, MapPin, ShieldCheck, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

const db = supabase as unknown as SupabaseClient;

export interface CleanerProfileDetails {
  id: string;
  full_name: string | null;
  phone: string | null;
  postcode: string | null;
  experience_summary: string | null;
  has_transport: boolean | null;
  application_status: string;
  operational_status: string;
  verification_status: string;
  created_at: string | null;
}

interface Capability { service_type: { name: string } | null; }
interface DocumentRecord {
  id: string;
  document_type: string;
  status: string;
  admin_notes: string | null;
  created_at: string;
  file_path: string;
  signed_url?: string;
}

const titleCase = (value: string) => value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

export function CleanerProfilePanel({ profile, email }: { profile: CleanerProfileDetails; email?: string | null }) {
  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const [capabilityResult, documentResult] = await Promise.all([
        db.from("cleaner_service_capabilities").select("service_type:service_types(name)").eq("cleaner_id", profile.id),
        db.from("verification_documents").select("id,document_type,status,admin_notes,created_at,file_path").order("created_at", { ascending: false }),
      ]);
      const docs = (documentResult.data as DocumentRecord[] | null) || [];
      const signedDocs = await Promise.all(docs.map(async (document) => {
        const { data } = await supabase.storage.from("verification-documents").createSignedUrl(document.file_path, 900);
        return { ...document, signed_url: data?.signedUrl };
      }));
      if (!cancelled) {
        setCapabilities((capabilityResult.data as unknown as Capability[]) || []);
        setDocuments(signedDocs);
        setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [profile.id]);

  return <div className="space-y-5">
    <div>
      <h2 className="text-2xl font-bold">Your profile</h2>
      <p className="mt-1 text-sm text-muted-foreground">The application details and verification documents Cleanda has on file for you.</p>
    </div>

    <section className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3"><div className="rounded-full bg-primary/10 p-3"><UserRound className="h-5 w-5 text-primary" /></div><div><h3 className="font-semibold">Personal details</h3><p className="text-sm text-muted-foreground">Submitted during cleaner onboarding</p></div></div>
        <div className="flex flex-wrap gap-2"><Badge variant="outline">Application: {profile.application_status}</Badge><Badge variant="outline">Verification: {titleCase(profile.verification_status)}</Badge></div>
      </div>
      <dl className="mt-5 grid gap-4 sm:grid-cols-2">
        <ProfileField label="Full name" value={profile.full_name} />
        <ProfileField label="Email" value={email} />
        <ProfileField label="Phone" value={profile.phone} />
        <ProfileField label="Home postcode" value={profile.postcode} icon={<MapPin className="h-4 w-4" />} />
        <ProfileField label="Own transport" value={profile.has_transport ? "Yes" : "No"} />
        <ProfileField label="Application submitted" value={profile.created_at ? new Date(profile.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "Not recorded"} />
      </dl>
      <div className="mt-5 rounded-lg bg-muted/50 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cleaning experience</p><p className="mt-2 whitespace-pre-wrap text-sm">{profile.experience_summary || "No experience summary was supplied."}</p></div>
      <div className="mt-5"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Services selected</p><div className="mt-2 flex flex-wrap gap-2">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : capabilities.length ? capabilities.map((item, index) => <Badge key={`${item.service_type?.name}-${index}`} variant="secondary">{item.service_type?.name || "Cleaning service"}</Badge>) : <span className="text-sm text-muted-foreground">No service preferences recorded.</span>}</div></div>
    </section>

    <section className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex items-center gap-3"><div className="rounded-full bg-emerald-100 p-3"><ShieldCheck className="h-5 w-5 text-emerald-700" /></div><div><h3 className="font-semibold">Onboarding documents</h3><p className="text-sm text-muted-foreground">Documents submitted for Cleanda verification</p></div></div>
      {loading ? <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div> : documents.length === 0 ? <div className="mt-5 rounded-lg border border-dashed p-6 text-center"><FileCheck2 className="mx-auto h-7 w-7 text-muted-foreground" /><p className="mt-2 font-medium">No documents on file</p><p className="mt-1 text-sm text-muted-foreground">Any onboarding documents you submit will appear here with their review status.</p></div> : <div className="mt-5 divide-y rounded-lg border">{documents.map((document) => <div key={document.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><p className="font-medium">{titleCase(document.document_type)}</p><Badge variant="outline">{titleCase(document.status)}</Badge></div><p className="mt-1 text-xs text-muted-foreground">Submitted {new Date(document.created_at).toLocaleDateString("en-GB")}</p>{document.admin_notes && <p className="mt-2 text-sm text-amber-700">Cleanda note: {document.admin_notes}</p>}</div>{document.signed_url && <Button asChild variant="outline" size="sm"><a href={document.signed_url} target="_blank" rel="noreferrer"><Download className="mr-2 h-4 w-4" />View document</a></Button>}</div>)}</div>}
    </section>
    <p className="text-xs text-muted-foreground">Need to correct an onboarding answer or replace a document? Open Support and send Cleanda a message so the change can be reviewed safely.</p>
  </div>;
}

function ProfileField({ label, value, icon }: { label: string; value?: string | null; icon?: React.ReactNode }) {
  return <div><dt className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{icon}{label}</dt><dd className="mt-1 text-sm font-medium">{value || "Not provided"}</dd></div>;
}
