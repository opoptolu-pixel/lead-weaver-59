import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Download, FileCheck2, FileUp, Loader2, MapPin, ShieldCheck, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
  uploaded_at: string;
  file_path: string;
  signed_url?: string;
}
interface VettingRecord { address_line_1:string|null;address_line_2:string|null;city:string|null;citizenship_route:string|null;date_of_birth:string|null;right_to_work_share_code:string|null;identity_status:string;address_status:string;right_to_work_status:string;right_to_work_basis:string|null;right_to_work_expires_on:string|null;dbs_status:string;submitted_at:string|null; }

const titleCase = (value: string) => value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

export function CleanerProfilePanel({ profile, email, userId }: { profile: CleanerProfileDetails; email?: string | null; userId?: string }) {
  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [vetting, setVetting] = useState<VettingRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshToken, setRefreshToken] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ addressLine1: "", addressLine2: "", city: "", citizenshipRoute: "", dateOfBirth: "", shareCode: "" });
  const [identityFile, setIdentityFile] = useState<File | null>(null);
  const [addressFile, setAddressFile] = useState<File | null>(null);
  const [dbsFile, setDbsFile] = useState<File | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const [capabilityResult, documentResult, vettingResult] = await Promise.all([
        db.from("cleaner_service_capabilities").select("service_type:service_types(name)").eq("cleaner_id", profile.id),
        db.from("cleaner_vetting_documents").select("id,document_type,status,admin_notes,uploaded_at,file_path").eq("cleaner_id",profile.id).eq("is_current",true).order("uploaded_at", { ascending: false }),
        db.from("cleaner_vetting_records").select("address_line_1,address_line_2,city,citizenship_route,date_of_birth,right_to_work_share_code,identity_status,address_status,right_to_work_status,right_to_work_basis,right_to_work_expires_on,dbs_status,submitted_at").eq("cleaner_id",profile.id).maybeSingle(),
      ]);
      const docs = (documentResult.data as DocumentRecord[] | null) || [];
      const signedDocs = await Promise.all(docs.map(async (document) => {
        const { data } = await supabase.storage.from("verification-documents").createSignedUrl(document.file_path, 900);
        return { ...document, signed_url: data?.signedUrl };
      }));
      if (!cancelled) {
        setCapabilities((capabilityResult.data as unknown as Capability[]) || []);
        setDocuments(signedDocs);
        const nextVetting = (vettingResult.data as VettingRecord | null) || null;
        setVetting(nextVetting);
        setForm({ addressLine1: nextVetting?.address_line_1 || "", addressLine2: nextVetting?.address_line_2 || "", city: nextVetting?.city || "", citizenshipRoute: nextVetting?.citizenship_route || "", dateOfBirth: nextVetting?.date_of_birth || "", shareCode: nextVetting?.right_to_work_share_code || "" });
        setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [profile.id, refreshToken]);

  const submitVetting = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!userId || !identityFile || !addressFile) return toast.error("Upload both your identity document and proof of address.");
    if (!form.addressLine1.trim() || !form.city.trim() || !form.citizenshipRoute) return toast.error("Complete your address and right-to-work route.");
    if (form.citizenshipRoute === "other" && (!form.dateOfBirth || !/^W[A-Z0-9]{8}$/.test(form.shareCode.replace(/\s/g, "").toUpperCase()))) return toast.error("Enter your date of birth and 9-character share code beginning W.");
    const files = [identityFile, addressFile, dbsFile].filter(Boolean) as File[];
    const allowed = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
    if (files.some((file) => file.size === 0 || file.size > 5 * 1024 * 1024 || !allowed.includes(file.type))) return toast.error("Documents must be PDF, JPG, PNG or WebP and no larger than 5MB.");
    setSubmitting(true);
    const upload = async (type: string, file: File) => {
      const extension = file.name.split(".").pop()?.toLowerCase() || "bin";
      const path = `${userId}/cleaner-vetting/${type}-${crypto.randomUUID()}.${extension}`;
      const { error } = await supabase.storage.from("verification-documents").upload(path, file, { contentType: file.type });
      if (error) throw error;
      return path;
    };
    try {
      const [identityPath, addressPath, dbsPath] = await Promise.all([
        upload("identity", identityFile),
        upload("address", addressFile),
        dbsFile ? upload("dbs", dbsFile) : Promise.resolve(null),
      ]);
      const { data, error } = await supabase.functions.invoke("submit-cleaner-vetting", { body: { ...form, rightToWorkShareCode: form.shareCode, identityPath, addressPath, dbsPath } });
      if (error || data?.error) throw new Error(data?.error || error?.message || "Submission failed");
      setIdentityFile(null); setAddressFile(null); setDbsFile(null);
      setRefreshToken((value) => value + 1);
      toast.success("Verification documents submitted for review");
    } catch (error) {
      toast.error((error as Error).message || "We could not submit your documents.");
    } finally { setSubmitting(false); }
  };

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
        <ProfileField label="Home address" value={vetting ? [vetting.address_line_1,vetting.address_line_2,vetting.city,profile.postcode].filter(Boolean).join(", ") : null} />
        <ProfileField label="Own transport" value={profile.has_transport ? "Yes" : "No"} />
        <ProfileField label="Application submitted" value={profile.created_at ? new Date(profile.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "Not recorded"} />
      </dl>
      {vetting && <div className="mt-5 grid gap-3 rounded-lg border p-4 sm:grid-cols-2 lg:grid-cols-4"><StatusField label="Identity" value={vetting.identity_status} /><StatusField label="Address" value={vetting.address_status} /><StatusField label="Right to work" value={vetting.right_to_work_status} detail={vetting.right_to_work_basis === "continuous" ? "Continuous" : vetting.right_to_work_expires_on ? `Expires ${new Date(vetting.right_to_work_expires_on).toLocaleDateString("en-GB")}` : undefined} /><StatusField label="DBS (optional)" value={vetting.dbs_status} /></div>}
      <div className="mt-5 rounded-lg bg-muted/50 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cleaning experience</p><p className="mt-2 whitespace-pre-wrap text-sm">{profile.experience_summary || "No experience summary was supplied."}</p></div>
      <div className="mt-5"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Services selected</p><div className="mt-2 flex flex-wrap gap-2">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : capabilities.length ? capabilities.map((item, index) => <Badge key={`${item.service_type?.name}-${index}`} variant="secondary">{item.service_type?.name || "Cleaning service"}</Badge>) : <span className="text-sm text-muted-foreground">No service preferences recorded.</span>}</div></div>
    </section>

    <section className="rounded-xl border border-primary/30 bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-lg font-semibold">Submit verification documents</h3><p className="mt-1 text-sm text-muted-foreground">Complete the required checks or replace documents Cleanda asked you to resubmit. Your existing jobs and dashboard access are not removed when you submit an update.</p></div><Badge>{documents.length ? "Update documents" : "Action required"}</Badge></div>
      <form onSubmit={submitVetting} className="mt-5 space-y-5">
        <fieldset className="grid gap-4 rounded-lg border p-4 sm:grid-cols-2"><legend className="px-2 font-semibold">Home address</legend><div className="sm:col-span-2"><Label htmlFor="profile-address-1">Address line 1</Label><Input id="profile-address-1" className="mt-2" value={form.addressLine1} onChange={(event)=>setForm((current)=>({...current,addressLine1:event.target.value}))} required /></div><div><Label htmlFor="profile-address-2">Address line 2 (optional)</Label><Input id="profile-address-2" className="mt-2" value={form.addressLine2} onChange={(event)=>setForm((current)=>({...current,addressLine2:event.target.value}))} /></div><div><Label htmlFor="profile-city">Town or city</Label><Input id="profile-city" className="mt-2" value={form.city} onChange={(event)=>setForm((current)=>({...current,city:event.target.value}))} required /></div></fieldset>
        <fieldset className="space-y-4 rounded-lg border p-4"><legend className="px-2 font-semibold">Right to work</legend><div><Label>Citizenship/right-to-work route</Label><Select value={form.citizenshipRoute} onValueChange={(value)=>setForm((current)=>({...current,citizenshipRoute:value}))}><SelectTrigger className="mt-2"><SelectValue placeholder="Select your route" /></SelectTrigger><SelectContent><SelectItem value="british">British citizen</SelectItem><SelectItem value="irish">Irish citizen</SelectItem><SelectItem value="other">Other nationality or immigration status</SelectItem></SelectContent></Select></div>{form.citizenshipRoute==="other"&&<div className="grid gap-4 sm:grid-cols-2"><div><Label htmlFor="profile-dob">Date of birth</Label><Input id="profile-dob" className="mt-2" type="date" value={form.dateOfBirth} onChange={(event)=>setForm((current)=>({...current,dateOfBirth:event.target.value}))} required /></div><div><Label htmlFor="profile-share-code">Right-to-work share code</Label><Input id="profile-share-code" className="mt-2" value={form.shareCode} onChange={(event)=>setForm((current)=>({...current,shareCode:event.target.value.toUpperCase()}))} placeholder="W12345678" required /><p className="mt-1 text-xs text-muted-foreground">British and Irish citizens do not need a share code.</p></div></div>}</fieldset>
        <fieldset className="space-y-4 rounded-lg border p-4"><legend className="px-2 font-semibold">Documents</legend><VettingFileInput id="profile-identity" label="Identity document" help="Passport, driving licence or accepted identity evidence." file={identityFile} setFile={setIdentityFile} required /><VettingFileInput id="profile-address-document" label="Proof of address" help="Recent bank statement, utility bill or council-tax statement." file={addressFile} setFile={setAddressFile} required /><VettingFileInput id="profile-dbs" label="DBS certificate (optional)" help="You can submit this if available; it does not block activation." file={dbsFile} setFile={setDbsFile} /></fieldset>
        <Button type="submit" disabled={submitting} size="lg">{submitting&&<Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Submit documents for review</Button>
      </form>
    </section>

    <section className="rounded-xl border bg-card p-5 shadow-sm">
        <div className="flex items-center gap-3"><div className="rounded-full bg-emerald-100 p-3"><ShieldCheck className="h-5 w-5 text-emerald-700" /></div><div><h3 className="font-semibold">Onboarding documents</h3><p className="text-sm text-muted-foreground">One current document per required check; previous versions remain in the secure audit history.</p></div></div>
      {loading ? <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div> : documents.length === 0 ? <div className="mt-5 rounded-lg border border-dashed p-6 text-center"><FileCheck2 className="mx-auto h-7 w-7 text-muted-foreground" /><p className="mt-2 font-medium">No structured documents on file</p><p className="mt-1 text-sm text-muted-foreground">Required onboarding documents will appear here after submission.</p></div> : <div className="mt-5 divide-y rounded-lg border">{documents.map((document) => <div key={document.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><p className="font-medium">{titleCase(document.document_type)}</p><Badge variant="outline">{titleCase(document.status)}</Badge></div><p className="mt-1 text-xs text-muted-foreground">Submitted {new Date(document.uploaded_at).toLocaleDateString("en-GB")}</p>{document.admin_notes && <p className="mt-2 text-sm text-amber-700">Cleanda note: {document.admin_notes}</p>}</div>{document.signed_url && <Button asChild variant="outline" size="sm"><a href={document.signed_url} target="_blank" rel="noreferrer"><Download className="mr-2 h-4 w-4" />View document</a></Button>}</div>)}</div>}
    </section>
    <p className="text-xs text-muted-foreground">After submission, Cleanda reviews each required check. Use Support if you need help with an unusual document or immigration status.</p>
  </div>;
}

function VettingFileInput({id,label,help,file,setFile,required=false}:{id:string;label:string;help:string;file:File|null;setFile:(file:File|null)=>void;required?:boolean}) { return <div><Label htmlFor={id}>{label}{required&&" *"}</Label><label htmlFor={id} className="mt-2 flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-dashed p-4 hover:bg-muted/50"><span><span className="block text-sm font-medium">{file?.name||"Choose PDF or image"}</span><span className="text-xs text-muted-foreground">{help} Maximum 5MB.</span></span><FileUp className="h-5 w-5 text-primary"/></label><Input id={id} className="hidden" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" required={required} onChange={(event)=>setFile(event.target.files?.[0]||null)}/></div>; }

function StatusField({label,value,detail}:{label:string;value:string;detail?:string}) { return <div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 text-sm font-medium">{titleCase(value)}</p>{detail&&<p className="text-xs text-muted-foreground">{detail}</p>}</div>; }

function ProfileField({ label, value, icon }: { label: string; value?: string | null; icon?: React.ReactNode }) {
  return <div><dt className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{icon}{label}</dt><dd className="mt-1 text-sm font-medium">{value || "Not provided"}</dd></div>;
}
