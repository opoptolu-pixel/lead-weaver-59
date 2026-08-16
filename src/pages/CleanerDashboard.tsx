import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Calendar, CheckCircle2, Clock, Loader2, LogOut, MapPin, PoundSterling } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const db = supabase as unknown as SupabaseClient;

interface CleanerProfile {
  id: string;
  full_name: string | null;
  application_status: string;
  operational_status: string;
  verification_status: string;
}

interface Assignment {
  id: string;
  status: string;
  offered_at: string;
  job: {
    id: string;
    reference: string;
    status: string;
    general_location: string;
    scheduled_date: string;
    start_time: string | null;
    expected_duration_minutes: number | null;
    cleaner_payout_pence: number;
    requirements: string | null;
    service_type: { name: string };
    customer: { name: string; phone: string } | null;
    address: { address_line_1: string | null; address_line_2: string | null; city: string | null; postcode: string } | null;
  };
}

const money = (pence: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(pence / 100);

export default function CleanerDashboard() {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<CleanerProfile | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data: profileData, error: profileError } = await db.from("cleaner_profiles").select("id,full_name,application_status,operational_status,verification_status").eq("user_id", user.id).maybeSingle();
    if (profileError) toast.error(profileError.message);
    setProfile(profileData || null);
    if (profileData) {
      const { data, error } = await db.from("job_assignments").select(`
        id,status,offered_at,
        job:jobs(id,reference,status,general_location,scheduled_date,start_time,expected_duration_minutes,cleaner_payout_pence,requirements,service_type:service_types(name),customer:customers(name,phone),address:customer_addresses(address_line_1,address_line_2,city,postcode))
      `).eq("cleaner_id", profileData.id).order("offered_at", { ascending: false });
      if (error) toast.error(error.message); else setAssignments(data || []);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
    if (user) fetchDashboard();
  }, [authLoading, fetchDashboard, navigate, user]);

  const respond = async (assignmentId: string, response: "accepted" | "declined") => {
    setResponding(assignmentId);
    const { data, error } = await db.rpc("respond_to_job_assignment", { p_assignment_id: assignmentId, p_response: response, p_notes: null });
    setResponding(null);
    if (error || !data) return toast.error(error?.message || "This job offer is no longer available.");
    toast.success(response === "accepted" ? "Job accepted" : "Job declined");
    fetchDashboard();
  };

  const complete = async (assignmentId: string) => {
    setResponding(assignmentId);
    const { data, error } = await db.rpc("complete_assigned_job", { p_assignment_id: assignmentId });
    setResponding(null);
    if (error || !data) return toast.error(error?.message || "The job could not be completed.");
    toast.success("Completion sent to Cleanda for quality review");
    fetchDashboard();
  };

  if (authLoading || loading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  if (!profile) return <div className="flex min-h-screen items-center justify-center p-4"><div className="max-w-md text-center"><h1 className="text-2xl font-bold">Complete your cleaner application</h1><p className="mt-3 text-muted-foreground">Tell Cleanda about your experience and Greater Manchester coverage before receiving jobs.</p><Button className="mt-6" onClick={() => navigate("/onboarding")}>Start application</Button></div></div>;

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-primary text-primary-foreground"><div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4"><Logo variant="white" size="md" /><Button variant="ghost" className="text-primary-foreground hover:bg-white/10" onClick={async () => { await signOut(); navigate("/"); }}><LogOut className="mr-2 h-4 w-4" />Sign out</Button></div></header>
      <main className="mx-auto max-w-6xl space-y-7 px-4 py-8">
        <div><h1 className="text-3xl font-bold">Welcome, {profile.full_name || "Cleaner"}</h1><div className="mt-3 flex flex-wrap gap-2"><Badge variant="outline">Application: {profile.application_status}</Badge><Badge variant="outline">Verification: {profile.verification_status.replaceAll('_',' ')}</Badge><Badge variant="outline">Status: {profile.operational_status}</Badge></div></div>
        {profile.application_status !== "approved" ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-950"><h2 className="font-semibold">Application under review</h2><p className="mt-1 text-sm">Cleanda will review your details and contact you about verification. Jobs become available after approval and activation.</p></div> : null}
        <section><h2 className="mb-4 text-xl font-semibold">Your jobs</h2>{assignments.length === 0 ? <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">No job offers yet.</div> : <div className="grid gap-4">{assignments.map((assignment) => <article key={assignment.id} className="rounded-xl border bg-card p-5 shadow-sm"><div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between"><div className="space-y-3"><div className="flex flex-wrap items-center gap-2"><span className="font-semibold">{assignment.job.reference}</span><Badge>{assignment.status}</Badge><span>{assignment.job.service_type.name}</span></div><div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2"><span><Calendar className="mr-2 inline h-4 w-4" />{assignment.job.scheduled_date}</span><span><Clock className="mr-2 inline h-4 w-4" />{assignment.job.start_time?.slice(0,5) || "Time to be confirmed"}</span><span><MapPin className="mr-2 inline h-4 w-4" />{assignment.status === "accepted" && assignment.job.address ? [assignment.job.address.address_line_1, assignment.job.address.city, assignment.job.address.postcode].filter(Boolean).join(", ") : `${assignment.job.general_location}, Greater Manchester`}</span><span><PoundSterling className="mr-2 inline h-4 w-4" />Cleaner payout: {money(assignment.job.cleaner_payout_pence)}</span></div>{assignment.status === "accepted" && assignment.job.customer && <p className="rounded-lg bg-muted/50 p-3 text-sm"><strong>Customer:</strong> {assignment.job.customer.name} · {assignment.job.customer.phone}</p>}{assignment.job.requirements && <p className="whitespace-pre-wrap text-sm">{assignment.job.requirements}</p>}</div><div className="flex shrink-0 gap-2">{assignment.status === "offered" && <><Button onClick={() => respond(assignment.id,"accepted")} disabled={responding === assignment.id}>Accept</Button><Button variant="outline" onClick={() => respond(assignment.id,"declined")} disabled={responding === assignment.id}>Decline</Button></>}{assignment.status === "accepted" && <Button onClick={() => complete(assignment.id)} disabled={responding === assignment.id}><CheckCircle2 className="mr-2 h-4 w-4" />Mark complete</Button>}</div></div></article>)}</div>}</section>
      </main>
    </div>
  );
}
