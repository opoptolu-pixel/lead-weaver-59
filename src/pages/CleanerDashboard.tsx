import { useCallback, useEffect, useMemo, useState, type ComponentType } from "react";
import { useNavigate } from "react-router-dom";
import { BriefcaseBusiness, Calendar, CheckCircle2, Clock, ImagePlus, Loader2, LogOut, MapPin, PoundSterling, WalletCards } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const db = supabase as unknown as SupabaseClient;
const money = (pence: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(pence / 100);
const MAX_EVIDENCE_FILE_SIZE = 5 * 1024 * 1024;
const EVIDENCE_FILE_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const detectEvidenceMimeType = async (file: File) => {
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) return "image/png";
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return "image/webp";
  return null;
};

interface CleanerProfile { id: string; full_name: string | null; application_status: string; operational_status: string; verification_status: string; }
interface Assignment {
  id: string; status: string; offered_at: string;
  job: { id: string; reference: string; status: string; general_location: string; scheduled_date: string; start_time: string | null; expected_duration_minutes: number | null; cleaner_payout_pence: number; requirements: string | null; quality_review_status: string; quality_review_notes: string | null; cleaner_completion_notes: string | null; service_type: { name: string }; customer: { name: string; phone: string } | null; address: { address_line_1: string | null; address_line_2: string | null; city: string | null; postcode: string; access_notes: string | null } | null; };
}
interface Evidence { id: string; job_id: string; assignment_id: string; evidence_type: "before" | "after"; storage_path: string; file_name: string; created_at: string; signedUrl?: string; }
interface Payout { id: string; job_id: string; amount_pence: number; status: string; paid_at: string | null; job: { reference: string; scheduled_date: string; service_type: { name: string } }; }
interface TimeEntry { id:string; assignment_id:string; clocked_in_at:string; clocked_out_at:string|null; corrected_minutes:number|null; }
interface ChecklistItem { id:string; job_id:string; title:string; is_required:boolean; position:number; completed_at:string|null; }
const WEEKDAYS = [{ value: 1, label: "Monday" }, { value: 2, label: "Tuesday" }, { value: 3, label: "Wednesday" }, { value: 4, label: "Thursday" }, { value: 5, label: "Friday" }, { value: 6, label: "Saturday" }, { value: 0, label: "Sunday" }];
const emptyAvailability = () => Object.fromEntries(WEEKDAYS.map(({ value }) => [value, { enabled: false, start: "09:00", end: "17:00" }])) as Record<number, { enabled: boolean; start: string; end: string }>;

export default function CleanerDashboard() {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<CleanerProfile | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [completionNotes, setCompletionNotes] = useState<Record<string, string>>({});
  const [availability, setAvailability] = useState(emptyAvailability);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data: profileData, error: profileError } = await db.from("cleaner_profiles").select("id,full_name,application_status,operational_status,verification_status").eq("user_id", user.id).maybeSingle();
    if (profileError) toast.error(profileError.message);
    setProfile(profileData || null);
    if (profileData) {
      const [initialAssignmentResult, evidenceResult, payoutResult, availabilityResult, timeResult, checklistResult] = await Promise.all([
        db.from("job_assignments").select(`id,status,offered_at,job:jobs(id,reference,status,general_location,scheduled_date,start_time,expected_duration_minutes,cleaner_payout_pence,requirements,quality_review_status,quality_review_notes,cleaner_completion_notes,service_type:service_types(name),customer:customers(name,phone),address:customer_addresses(address_line_1,address_line_2,city,postcode,access_notes))`).eq("cleaner_id", profileData.id).order("offered_at", { ascending: false }),
        db.from("job_evidence").select("id,job_id,assignment_id,evidence_type,storage_path,file_name,created_at").eq("cleaner_id", profileData.id).order("created_at"),
        db.from("cleaner_payouts").select("id,job_id,amount_pence,status,paid_at,job:jobs(reference,scheduled_date,service_type:service_types(name))").eq("cleaner_id", profileData.id).order("created_at", { ascending: false }),
        db.from("cleaner_availability").select("weekday,start_time,end_time").eq("cleaner_id", profileData.id),
        db.from("job_time_entries").select("id,assignment_id,clocked_in_at,clocked_out_at,corrected_minutes").eq("cleaner_id",profileData.id).order("clocked_in_at",{ascending:false}),
        db.from("job_checklist_items").select("id,job_id,title,is_required,position,completed_at").order("position"),
      ]);
      let assignmentResult = initialAssignmentResult;
      if (initialAssignmentResult.error?.message.includes("quality_review_status")) {
        const legacyResult = await db.from("job_assignments").select(`id,status,offered_at,job:jobs(id,reference,status,general_location,scheduled_date,start_time,expected_duration_minutes,cleaner_payout_pence,requirements,service_type:service_types(name),customer:customers(name,phone),address:customer_addresses(address_line_1,address_line_2,city,postcode,access_notes))`).eq("cleaner_id", profileData.id).order("offered_at", { ascending: false });
        assignmentResult = {
          ...legacyResult,
          data: legacyResult.data?.map((assignment) => ({ ...assignment, job: { ...(assignment.job as object), quality_review_status: "pending", quality_review_notes: null, cleaner_completion_notes: null } })) || null,
        } as typeof initialAssignmentResult;
      }
      const firstError = assignmentResult.error || evidenceResult.error || payoutResult.error;
      if (firstError && !firstError.message.includes("job_evidence")) toast.error(firstError.message);
      setAssignments((assignmentResult.data as unknown as Assignment[]) || []);
      setPayouts((payoutResult.data as unknown as Payout[]) || []);
      if (!timeResult.error) setTimeEntries((timeResult.data as TimeEntry[]) || []);
      if (!checklistResult.error) setChecklist((checklistResult.data as ChecklistItem[]) || []);
      if (!availabilityResult.error) {
        const next = emptyAvailability();
        for (const window of availabilityResult.data || []) next[window.weekday] = { enabled: true, start: window.start_time.slice(0, 5), end: window.end_time.slice(0, 5) };
        setAvailability(next);
      }
      const items = (evidenceResult.data as Evidence[]) || [];
      const signed = await Promise.all(items.map(async (item) => {
        const { data } = await supabase.storage.from("job-evidence").createSignedUrl(item.storage_path, 3600);
        return { ...item, signedUrl: data?.signedUrl };
      }));
      setEvidence(signed);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { if (!authLoading && !user) navigate("/auth"); if (user) fetchDashboard(); }, [authLoading, fetchDashboard, navigate, user]);

  const respond = async (assignmentId: string, response: "accepted" | "declined") => {
    setBusy(assignmentId);
    const { data, error } = await db.rpc("respond_to_job_assignment", { p_assignment_id: assignmentId, p_response: response, p_notes: null });
    setBusy(null);
    if (error || !data) return toast.error(error?.message || "This offer is no longer available.");
    toast.success(response === "accepted" ? "Job accepted" : "Job declined"); fetchDashboard();
  };

  const uploadEvidence = async (assignment: Assignment, type: "before" | "after", files: FileList | null) => {
    if (!files?.length || !profile) return;
    const selected = Array.from(files);
    if (selected.some((file) => file.size === 0 || file.size > MAX_EVIDENCE_FILE_SIZE || !(file.type in EVIDENCE_FILE_EXTENSIONS))) return toast.error("Use non-empty JPG, PNG or WebP images up to 5MB each.");

    let verifiedFiles: Array<{ file: File; mimeType: string }>;
    try {
      verifiedFiles = await Promise.all(selected.map(async (file) => ({ file, mimeType: await detectEvidenceMimeType(file) || "" })));
    } catch {
      return toast.error("We could not verify one of those images. Please choose it again.");
    }
    if (verifiedFiles.some(({ file, mimeType }) => !mimeType || mimeType !== file.type)) return toast.error("One or more files are not valid JPG, PNG or WebP images.");

    setBusy(`${assignment.id}-${type}`);
    for (const { file, mimeType } of verifiedFiles) {
      const extension = EVIDENCE_FILE_EXTENSIONS[mimeType];
      const path = `${assignment.job.id}/${profile.id}/${type}-${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabase.storage.from("job-evidence").upload(path, file, { contentType: mimeType });
      if (uploadError) { setBusy(null); return toast.error(uploadError.message); }
      const { error: recordError } = await db.from("job_evidence").insert({ job_id: assignment.job.id, assignment_id: assignment.id, cleaner_id: profile.id, evidence_type: type, storage_path: path, file_name: file.name, mime_type: mimeType, size_bytes: file.size });
      if (recordError) { await supabase.storage.from("job-evidence").remove([path]); setBusy(null); return toast.error(recordError.message); }
    }
    setBusy(null); toast.success(`${type === "before" ? "Before" : "After"} photos uploaded`); fetchDashboard();
  };

  const complete = async (assignment: Assignment) => {
    setBusy(assignment.id);
    const { data, error } = await db.rpc("complete_assigned_job", { p_assignment_id: assignment.id, p_completion_notes: completionNotes[assignment.id] || null });
    setBusy(null);
    if (error || !data) return toast.error(error?.message || "The job could not be completed.");
    toast.success("Completion sent to Cleanda for quality review"); fetchDashboard();
  };

  const clockJob = async (assignmentId:string, action:"in"|"out") => { setBusy(`${assignmentId}-clock`); const {error}=await db.rpc("clock_assigned_job",{p_assignment_id:assignmentId,p_action:action}); setBusy(null); if(error)return toast.error(error.message); toast.success(action==="in"?"Clocked in":"Clocked out"); fetchDashboard(); };
  const toggleChecklist = async (item:ChecklistItem, completed:boolean) => { const {data,error}=await db.rpc("set_job_checklist_item",{p_item_id:item.id,p_completed:completed}); if(error||!data)return toast.error(error?.message||"Checklist could not be updated"); fetchDashboard(); };

  const saveAvailability = async () => {
    const windows = WEEKDAYS.filter(({ value }) => availability[value].enabled).map(({ value }) => ({ weekday: value, start_time: availability[value].start, end_time: availability[value].end }));
    if (!windows.length) return toast.error("Select at least one working day.");
    if (windows.some((window) => window.end_time <= window.start_time)) return toast.error("Each availability window must end after it starts.");
    setBusy("availability");
    const { data, error } = await db.rpc("replace_my_cleaner_availability", { p_windows: windows });
    setBusy(null);
    if (error || !data) return toast.error(error?.message || "Availability could not be saved.");
    toast.success("Availability updated");
  };

  const totals = useMemo(() => ({
    available: assignments.filter((a) => a.status === "offered").length,
    active: assignments.filter((a) => a.status === "accepted").length,
    pending: payouts.filter((p) => ["pending", "held"].includes(p.status)).reduce((sum, p) => sum + p.amount_pence, 0),
    approved: payouts.filter((p) => p.status === "approved").reduce((sum, p) => sum + p.amount_pence, 0),
    paid: payouts.filter((p) => p.status === "paid").reduce((sum, p) => sum + p.amount_pence, 0),
  }), [assignments, payouts]);

  if (authLoading || loading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  if (!profile) return <div className="flex min-h-screen items-center justify-center p-4"><div className="max-w-md text-center"><h1 className="text-2xl font-bold">Complete your cleaner application</h1><p className="mt-3 text-muted-foreground">Tell Cleanda about your experience and Greater Manchester coverage before receiving jobs.</p><Button className="mt-6" onClick={() => navigate("/onboarding")}>Start application</Button></div></div>;

  return <div className="min-h-screen bg-muted/30">
    <header className="border-b bg-primary text-primary-foreground"><div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4"><Logo variant="white" size="md" /><Button variant="ghost" className="text-primary-foreground hover:bg-white/10" onClick={async () => { await signOut(); navigate("/"); }}><LogOut className="mr-2 h-4 w-4" />Sign out</Button></div></header>
    <main className="mx-auto max-w-6xl space-y-7 px-4 py-8">
      <div><h1 className="text-3xl font-bold">Welcome, {profile.full_name || "Cleaner"}</h1><div className="mt-3 flex flex-wrap gap-2"><Badge variant="outline">Application: {profile.application_status}</Badge><Badge variant="outline">Verification: {profile.verification_status.replace(/_/g, " ")}</Badge><Badge variant="outline">Status: {profile.operational_status}</Badge></div></div>
      {profile.application_status !== "approved" && <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-950"><h2 className="font-semibold">Application under review</h2><p className="mt-1 text-sm">Cleanda will contact you about verification. Jobs become available after approval and activation.</p></div>}
      <Tabs defaultValue="dashboard" className="space-y-6"><TabsList><TabsTrigger value="dashboard">Dashboard</TabsTrigger><TabsTrigger value="jobs">Jobs</TabsTrigger><TabsTrigger value="availability">Availability</TabsTrigger><TabsTrigger value="earnings">Earnings</TabsTrigger></TabsList>
        <TabsContent value="dashboard" className="space-y-6"><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{([["Offers", totals.available, BriefcaseBusiness],["Active jobs",totals.active,Calendar],["Awaiting approval",money(totals.pending),Clock],["Paid",money(totals.paid),WalletCards]] as Array<[string, string | number, ComponentType<{ className?: string }>]>).map(([label,value,Icon]) => <div key={String(label)} className="rounded-xl border bg-card p-5"><Icon className="mb-3 h-5 w-5 text-primary" /><p className="text-sm text-muted-foreground">{String(label)}</p><p className="mt-1 text-2xl font-bold">{String(value)}</p></div>)}</div><p className="rounded-xl border bg-card p-5 text-sm text-muted-foreground">Use the Jobs tab to accept offers, see confirmed addresses and times, upload before-and-after photos, and submit completed work for review.</p></TabsContent>
        <TabsContent value="jobs"><JobList assignments={assignments} evidence={evidence} timeEntries={timeEntries} checklist={checklist} busy={busy} completionNotes={completionNotes} setCompletionNotes={setCompletionNotes} onRespond={respond} onUpload={uploadEvidence} onComplete={complete} onClock={clockJob} onToggleChecklist={toggleChecklist} /></TabsContent>
        <TabsContent value="availability" className="space-y-5"><div><h2 className="text-xl font-semibold">Weekly availability</h2><p className="mt-1 text-sm text-muted-foreground">Cleanda uses these hours when offering work. Accepted jobs and time off are also checked to prevent clashes.</p></div><div className="divide-y rounded-xl border bg-card">{WEEKDAYS.map(({ value, label }) => { const day = availability[value]; return <div key={value} className="grid gap-3 p-4 sm:grid-cols-[1fr_auto_auto] sm:items-center"><label className="flex items-center gap-3 font-medium"><Input className="h-4 w-4" type="checkbox" checked={day.enabled} onChange={(event) => setAvailability((current) => ({ ...current, [value]: { ...current[value], enabled: event.target.checked } }))} />{label}</label><Input aria-label={`${label} start time`} className="sm:w-36" type="time" value={day.start} disabled={!day.enabled} onChange={(event) => setAvailability((current) => ({ ...current, [value]: { ...current[value], start: event.target.value } }))} /><Input aria-label={`${label} end time`} className="sm:w-36" type="time" value={day.end} disabled={!day.enabled} onChange={(event) => setAvailability((current) => ({ ...current, [value]: { ...current[value], end: event.target.value } }))} /></div>; })}</div><Button onClick={saveAvailability} disabled={busy === "availability"}>{busy === "availability" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save availability</Button></TabsContent>
        <TabsContent value="earnings" className="space-y-5"><div className="grid gap-4 sm:grid-cols-3"><Summary label="Pending / held" value={money(totals.pending)} /><Summary label="Approved" value={money(totals.approved)} /><Summary label="Paid" value={money(totals.paid)} /></div><div className="rounded-xl border bg-card"><div className="border-b p-5"><h2 className="font-semibold">Earnings history</h2></div>{payouts.length === 0 ? <p className="p-8 text-center text-muted-foreground">No earnings recorded yet.</p> : payouts.map((p) => <div key={p.id} className="flex flex-col gap-2 border-b p-5 last:border-0 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-medium">{p.job.reference} · {p.job.service_type.name}</p><p className="text-sm text-muted-foreground">{p.job.scheduled_date}{p.paid_at ? ` · Paid ${new Date(p.paid_at).toLocaleDateString("en-GB")}` : ""}</p></div><div className="flex items-center gap-3"><Badge variant="outline">{p.status}</Badge><strong>{money(p.amount_pence)}</strong></div></div>)}</div></TabsContent>
      </Tabs>
    </main>
  </div>;
}

function Summary({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border bg-card p-5"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-bold">{value}</p></div>; }

function JobList({ assignments, evidence, timeEntries, checklist, busy, completionNotes, setCompletionNotes, onRespond, onUpload, onComplete, onClock, onToggleChecklist }: { assignments: Assignment[]; evidence: Evidence[]; timeEntries:TimeEntry[]; checklist:ChecklistItem[]; busy: string | null; completionNotes: Record<string,string>; setCompletionNotes: React.Dispatch<React.SetStateAction<Record<string,string>>>; onRespond: (id:string,response:"accepted"|"declined")=>void; onUpload:(a:Assignment,t:"before"|"after",f:FileList|null)=>void; onComplete:(a:Assignment)=>void; onClock:(id:string,a:"in"|"out")=>void; onToggleChecklist:(i:ChecklistItem,c:boolean)=>void; }) {
  if (!assignments.length) return <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">No job offers yet.</div>;
  return <div className="grid gap-5">{assignments.map((assignment) => {
    const photos = evidence.filter((item) => item.assignment_id === assignment.id); const before = photos.filter((p) => p.evidence_type === "before"); const after = photos.filter((p) => p.evidence_type === "after"); const revealsDetails = ["accepted","completed"].includes(assignment.status); const entries=timeEntries.filter(e=>e.assignment_id===assignment.id); const openEntry=entries.find(e=>!e.clocked_out_at); const jobChecklist=checklist.filter(i=>i.job_id===assignment.job.id); const requiredDone=jobChecklist.filter(i=>i.is_required).every(i=>i.completed_at);
    const address = assignment.job.address ? [assignment.job.address.address_line_1, assignment.job.address.address_line_2, assignment.job.address.city, assignment.job.address.postcode].filter(Boolean).join(", ") : "Address awaiting confirmation";
    return <article key={assignment.id} className="rounded-xl border bg-card p-5 shadow-sm"><div className="flex flex-col gap-5 lg:flex-row lg:justify-between"><div className="space-y-3"><div className="flex flex-wrap items-center gap-2"><strong>{assignment.job.reference}</strong><Badge>{assignment.status}</Badge><span>{assignment.job.service_type.name}</span></div><div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2"><span><Calendar className="mr-2 inline h-4 w-4" />{assignment.job.scheduled_date}</span><span><Clock className="mr-2 inline h-4 w-4" />{assignment.job.start_time?.slice(0,5) || "Time awaiting confirmation"}{assignment.job.expected_duration_minutes ? ` · ${assignment.job.expected_duration_minutes / 60} hrs` : ""}</span><span><MapPin className="mr-2 inline h-4 w-4" />{revealsDetails ? address : `${assignment.job.general_location}, Greater Manchester`}</span><span><PoundSterling className="mr-2 inline h-4 w-4" />Cleaner payout: {money(assignment.job.cleaner_payout_pence)}</span></div>{revealsDetails && assignment.job.customer && <p className="rounded-lg bg-muted/50 p-3 text-sm"><strong>Customer:</strong> {assignment.job.customer.name} · {assignment.job.customer.phone}{assignment.job.address?.access_notes && <><br /><strong>Access:</strong> {assignment.job.address.access_notes}</>}</p>}{assignment.job.requirements && <p className="whitespace-pre-wrap text-sm"><strong>Job requirements:</strong> {assignment.job.requirements}</p>}</div><div className="flex shrink-0 gap-2">{assignment.status === "offered" && <><Button onClick={() => onRespond(assignment.id,"accepted")} disabled={busy === assignment.id}>Accept</Button><Button variant="outline" onClick={() => onRespond(assignment.id,"declined")} disabled={busy === assignment.id}>Decline</Button></>}</div></div>
      {assignment.status === "accepted" && <div className="mt-6 space-y-5 border-t pt-5"><div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted p-4"><div><h3 className="font-semibold">Job timer</h3><p className="text-sm text-muted-foreground">{openEntry?`Clocked in ${new Date(openEntry.clocked_in_at).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"})}`:entries.length?"Clocked out":"Not started"}</p></div><Button onClick={()=>onClock(assignment.id,openEntry?"out":"in")} disabled={busy===`${assignment.id}-clock`}>{openEntry?"Clock out":"Clock in"}</Button></div><div><h3 className="font-semibold">Cleaning checklist</h3><div className="mt-3 space-y-2">{jobChecklist.map(item=><label key={item.id} className="flex items-center gap-3 rounded-lg border p-3"><Input className="h-4 w-4" type="checkbox" checked={!!item.completed_at} onChange={e=>onToggleChecklist(item,e.target.checked)}/><span>{item.title}{item.is_required&&" *"}</span></label>)}</div></div><div><h3 className="font-semibold">Job evidence</h3><p className="mt-1 text-sm text-muted-foreground">Upload at least one before and one after photo. JPG, PNG or WebP; maximum 5MB per image.</p><div className="mt-4 grid gap-4 md:grid-cols-2"><EvidenceBox title="Before photos" items={before} inputId={`${assignment.id}-before`} busy={busy === `${assignment.id}-before`} onChange={(files) => onUpload(assignment,"before",files)} /><EvidenceBox title="After photos" items={after} inputId={`${assignment.id}-after`} busy={busy === `${assignment.id}-after`} onChange={(files) => onUpload(assignment,"after",files)} /></div><div className="mt-4 space-y-2"><Label htmlFor={`${assignment.id}-notes`}>Completion notes (optional)</Label><Textarea id={`${assignment.id}-notes`} placeholder="Anything Cleanda should know about the completed clean" value={completionNotes[assignment.id] || ""} onChange={(e) => setCompletionNotes((v) => ({...v,[assignment.id]:e.target.value}))} /></div><Button className="mt-4" disabled={!before.length || !after.length || !requiredDone || !!openEntry || !entries.length || busy === assignment.id} onClick={() => onComplete(assignment)}><CheckCircle2 className="mr-2 h-4 w-4" />Submit for quality review</Button></div></div>}
      {assignment.status === "completed" && <div className="mt-6 border-t pt-5"><div className="flex items-center gap-2"><h3 className="font-semibold">Quality review</h3><Badge variant="outline">{assignment.job.quality_review_status?.replace(/_/g," ") || "pending"}</Badge></div>{assignment.job.quality_review_notes && <p className="mt-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-950">{assignment.job.quality_review_notes}</p>}<div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">{photos.map((photo) => photo.signedUrl && <a key={photo.id} href={photo.signedUrl} target="_blank" rel="noreferrer"><img src={photo.signedUrl} alt={`${photo.evidence_type} evidence`} className="aspect-square w-full rounded-lg border object-cover" /></a>)}</div></div>}
    </article>;
  })}</div>;
}

function EvidenceBox({ title, items, inputId, busy, onChange }: { title:string; items:Evidence[]; inputId:string; busy:boolean; onChange:(files:FileList|null)=>void; }) { return <div className="rounded-xl border p-4"><div className="flex items-center justify-between"><strong className="text-sm">{title} ({items.length})</strong><Label htmlFor={inputId} className="cursor-pointer"><span className="inline-flex items-center rounded-md border px-3 py-2 text-sm"><ImagePlus className="mr-2 h-4 w-4" />{busy ? "Uploading…" : "Add photos"}</span></Label><Input id={inputId} className="hidden" type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={busy} onChange={(e) => { onChange(e.target.files); e.currentTarget.value = ""; }} /></div><div className="mt-3 grid grid-cols-3 gap-2">{items.map((photo) => photo.signedUrl && <a key={photo.id} href={photo.signedUrl} target="_blank" rel="noreferrer"><img src={photo.signedUrl} alt={`${photo.evidence_type} evidence`} className="aspect-square w-full rounded-md object-cover" /></a>)}</div></div>; }
