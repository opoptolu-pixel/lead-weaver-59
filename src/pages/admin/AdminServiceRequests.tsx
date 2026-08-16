import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  Image,
  Loader2,
  List,
  MapPin,
  Phone,
  RefreshCw,
  RotateCcw,
  UserRound,
} from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { SupabaseClient } from "@supabase/supabase-js";

const db = supabase as unknown as SupabaseClient;

interface ManagedRequest {
  id: string;
  reference: string;
  status: string;
  preferred_date_from: string | null;
  preferred_date_to: string | null;
  property_type: string | null;
  bedrooms: string | null;
  customer_notes: string | null;
  admin_notes: string | null;
  source: string | null;
  created_at: string;
  customer: { id: string; name: string; email: string; phone: string };
  address: {
    id: string;
    address_line_1: string | null;
    address_line_2: string | null;
    postcode: string;
    city: string | null;
    access_notes: string | null;
  };
  service_type: { id: string; name: string };
  quotes?: Quote[];
}

interface Quote {
  id: string;
  status: string;
  customer_amount_pence: number;
  cleaner_payout_pence: number;
  valid_until: string | null;
  version: number;
}

interface Job {
  id: string;
  reference: string;
  service_request_id: string;
  status: string;
  scheduled_date: string;
  start_time: string | null;
  expected_duration_minutes: number | null;
  requirements: string | null;
  quality_review_status: string;
  quality_review_notes: string | null;
  cleaner_completion_notes: string | null;
  customer_amount_pence: number;
  cleaner_payout_pence: number;
  service_type: { name: string };
  customer: { name: string; phone: string };
  address: {
    id: string;
    address_line_1: string | null;
    address_line_2: string | null;
    postcode: string;
    city: string | null;
    access_notes: string | null;
  };
  assignments?: Array<{
    id: string;
    status: string;
    cleaner: {
      id: string;
      full_name: string | null;
      phone: string | null;
      postcode: string | null;
    } | null;
  }>;
}

interface JobEvent {
  id: string;
  event_type: string;
  created_at: string;
  details: Record<string, unknown> | null;
}

interface JobEvidence {
  id: string;
  evidence_type: "before" | "after";
  storage_path: string;
  file_name: string;
  created_at: string;
  signedUrl?: string;
}
interface DeliveryTime {
  id: string;
  clocked_in_at: string;
  clocked_out_at: string | null;
  corrected_minutes: number | null;
  correction_reason: string | null;
}
interface DeliveryChecklist {
  id: string;
  title: string;
  is_required: boolean;
  completed_at: string | null;
}

interface Cleaner {
  id: string;
  full_name: string | null;
  postcode: string | null;
  phone: string | null;
  application_status: string;
  operational_status: string;
  verification_status: string;
  payout_status: string;
  experience_summary: string | null;
  admin_notes: string | null;
  has_transport: boolean | null;
  created_at: string;
}

const requestStatusClasses: Record<string, string> = {
  new: "bg-blue-100 text-blue-700",
  contacted: "bg-amber-100 text-amber-700",
  qualified: "bg-cyan-100 text-cyan-700",
  quoted: "bg-purple-100 text-purple-700",
  accepted: "bg-emerald-100 text-emerald-700",
  declined: "bg-slate-100 text-slate-700",
  lost: "bg-red-100 text-red-700",
  cancelled: "bg-red-100 text-red-700",
};

const money = (pence: number) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(pence / 100);

const makeJobReference = () =>
  `JOB-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;

export default function AdminServiceRequests() {
  const location = useLocation();
  const [requests, setRequests] = useState<ManagedRequest[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [cleaners, setCleaners] = useState<Cleaner[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState("active");
  const [selected, setSelected] = useState<ManagedRequest | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [customerPrice, setCustomerPrice] = useState("");
  const [cleanerPayout, setCleanerPayout] = useState("");
  const [quoteValidUntil, setQuoteValidUntil] = useState("");
  const [assignmentChoices, setAssignmentChoices] = useState<
    Record<string, string>
  >({});
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [city, setCity] = useState("");
  const [bookingPostcode, setBookingPostcode] = useState("");
  const [accessNotes, setAccessNotes] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [durationHours, setDurationHours] = useState("");
  const [jobRequirements, setJobRequirements] = useState("");
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [jobEvidence, setJobEvidence] = useState<JobEvidence[]>([]);
  const [qualityNotes, setQualityNotes] = useState("");
  const [deliveryTimes, setDeliveryTimes] = useState<DeliveryTime[]>([]);
  const [deliveryChecklist, setDeliveryChecklist] = useState<
    DeliveryChecklist[]
  >([]);
  const [correctionEntry, setCorrectionEntry] = useState("");
  const [correctionMinutes, setCorrectionMinutes] = useState("");
  const [correctionReason, setCorrectionReason] = useState("");
  const [liveNow, setLiveNow] = useState(() => Date.now());
  const [jobView, setJobView] = useState<"list" | "calendar">("list");
  const [jobStatusFilter, setJobStatusFilter] = useState("active");
  const [jobEvents, setJobEvents] = useState<JobEvent[]>([]);
  const [calendarMonth, setCalendarMonth] = useState(() => startOfMonth(new Date()));

  useEffect(() => {
    const timer = window.setInterval(() => setLiveNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [requestResult, initialJobResult, cleanerResult] = await Promise.all([
      db
        .from("service_requests")
        .select(
          `
        *,
        customer:customers(id,name,email,phone),
        address:customer_addresses(id,address_line_1,address_line_2,postcode,city,access_notes),
        service_type:service_types(id,name),
        quotes(id,status,customer_amount_pence,cleaner_payout_pence,valid_until,version)
      `,
        )
        .order("created_at", { ascending: false }),
      db
        .from("jobs")
        .select(
          `
        id,reference,service_request_id,status,scheduled_date,start_time,expected_duration_minutes,requirements,
        customer_amount_pence,cleaner_payout_pence,quality_review_status,quality_review_notes,cleaner_completion_notes,
        service_type:service_types(name),customer:customers(name,phone),address:customer_addresses(id,address_line_1,address_line_2,postcode,city,access_notes),
        assignments:job_assignments(id,status,cleaner:cleaner_profiles(id,full_name,phone,postcode))
      `,
        )
        .order("scheduled_date", { ascending: true }),
      db
        .from("cleaner_profiles")
        .select(
          "id,full_name,postcode,phone,application_status,operational_status,verification_status,payout_status,experience_summary,admin_notes,has_transport,created_at",
        )
        .order("created_at", { ascending: false }),
    ]);

    let jobResult = initialJobResult;
    if (initialJobResult.error?.message.includes("quality_review_status")) {
      const legacyResult = await db
        .from("jobs")
        .select(
          `
        id,reference,service_request_id,status,scheduled_date,start_time,expected_duration_minutes,requirements,
        customer_amount_pence,cleaner_payout_pence,
        service_type:service_types(name),customer:customers(name,phone),address:customer_addresses(id,address_line_1,address_line_2,postcode,city,access_notes),
        assignments:job_assignments(id,status,cleaner:cleaner_profiles(id,full_name,phone,postcode))
      `,
        )
        .order("scheduled_date", { ascending: true });
      jobResult = {
        ...legacyResult,
        data:
          legacyResult.data?.map((job) => ({
            ...job,
            quality_review_status:
              job.status === "quality_check" ? "pending" : "not_submitted",
            quality_review_notes: null,
            cleaner_completion_notes: null,
          })) || null,
      } as typeof initialJobResult;
      toast.warning(
        "The quality-workflow database update is still pending. Existing jobs remain available, but evidence review is temporarily disabled.",
      );
    }

    if (requestResult.error || jobResult.error || cleanerResult.error) {
      toast.error(
        requestResult.error?.message ||
          jobResult.error?.message ||
          cleanerResult.error?.message ||
          "Could not load managed operations",
      );
    } else {
      setRequests(requestResult.data || []);
      setJobs((jobResult.data as unknown as Job[]) || []);
      setCleaners(cleanerResult.data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const visibleRequests = useMemo(
    () =>
      requests.filter((request) => {
        if (statusFilter === "all") return true;
        if (statusFilter === "active")
          return !["declined", "lost", "cancelled", "accepted"].includes(
            request.status,
          );
        return request.status === statusFilter;
      }),
    [requests, statusFilter],
  );

  const openRequest = (request: ManagedRequest) => {
    setSelected(request);
    setAdminNotes(request.admin_notes || "");
    const latest = [...(request.quotes || [])].sort(
      (a, b) => b.version - a.version,
    )[0];
    setCustomerPrice(latest ? String(latest.customer_amount_pence / 100) : "");
    setCleanerPayout(latest ? String(latest.cleaner_payout_pence / 100) : "");
    setQuoteValidUntil(
      latest?.valid_until ? latest.valid_until.slice(0, 10) : "",
    );
    setAddressLine1(request.address.address_line_1 || "");
    setAddressLine2(request.address.address_line_2 || "");
    setCity(request.address.city || "");
    setBookingPostcode(request.address.postcode || "");
    setAccessNotes(request.address.access_notes || "");
    setScheduledDate(request.preferred_date_from || "");
    setStartTime("");
    setDurationHours("");
    setJobRequirements(request.customer_notes || "");
  };

  const updateRequest = async (status?: string) => {
    if (!selected) return;
    setSaving(true);
    const updates: Record<string, unknown> = { admin_notes: adminNotes };
    if (status) updates.status = status;
    if (status === "contacted") updates.contacted_at = new Date().toISOString();
    if (status === "qualified") updates.qualified_at = new Date().toISOString();
    const { error } = await db
      .from("service_requests")
      .update(updates)
      .eq("id", selected.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Request updated");
    setSelected(null);
    fetchData();
  };

  const createQuote = async () => {
    if (!selected) return;
    const customerPence = Math.round(Number(customerPrice) * 100);
    const cleanerPence = Math.round(Number(cleanerPayout) * 100);
    if (!customerPence || cleanerPence < 0 || customerPence < cleanerPence) {
      return toast.error(
        "Enter a valid customer price and cleaner payout. The customer price must cover the payout.",
      );
    }
    setSaving(true);
    const nextVersion =
      Math.max(0, ...(selected.quotes || []).map((quote) => quote.version)) + 1;
    const { error } = await db.from("quotes").insert({
      service_request_id: selected.id,
      version: nextVersion,
      status: "sent",
      customer_amount_pence: customerPence,
      cleaner_payout_pence: cleanerPence,
      valid_until: quoteValidUntil
        ? new Date(`${quoteValidUntil}T23:59:59`).toISOString()
        : null,
      sent_at: new Date().toISOString(),
    });
    if (!error)
      await db
        .from("service_requests")
        .update({ status: "quoted", admin_notes: adminNotes })
        .eq("id", selected.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Quote recorded as sent");
    setSelected(null);
    fetchData();
  };

  const acceptAndCreateJob = async () => {
    if (!selected) return;
    const latest = [...(selected.quotes || [])]
      .filter((quote) => quote.status === "sent")
      .sort((a, b) => b.version - a.version)[0];
    if (!latest) return toast.error("Create and send a quote first.");
    if (!addressLine1.trim() || !city.trim() || !bookingPostcode.trim())
      return toast.error(
        "Confirm the full customer address before creating the job.",
      );
    if (!scheduledDate || !startTime || !Number(durationHours))
      return toast.error(
        "Confirm the job date, start time and expected duration.",
      );
    setSaving(true);
    const { error: addressError } = await db
      .from("customer_addresses")
      .update({
        address_line_1: addressLine1.trim(),
        address_line_2: addressLine2.trim() || null,
        city: city.trim(),
        postcode: bookingPostcode.trim().toUpperCase(),
        access_notes: accessNotes.trim() || null,
      })
      .eq("id", selected.address.id);
    if (addressError) {
      setSaving(false);
      return toast.error(addressError.message);
    }
    const acceptedAt = new Date().toISOString();
    const { error: quoteError } = await db
      .from("quotes")
      .update({ status: "accepted", accepted_at: acceptedAt })
      .eq("id", latest.id);
    if (quoteError) {
      setSaving(false);
      return toast.error(quoteError.message);
    }
    const { data: job, error: jobError } = await db
      .from("jobs")
      .insert({
        reference: makeJobReference(),
        service_request_id: selected.id,
        accepted_quote_id: latest.id,
        customer_id: selected.customer.id,
        address_id: selected.address.id,
        service_type_id: selected.service_type.id,
        service_area_id: (
          await db
            .from("service_areas")
            .select("id")
            .eq("slug", "greater-manchester")
            .single()
        ).data?.id,
        scheduled_date: scheduledDate,
        start_time: startTime,
        expected_duration_minutes: Math.round(Number(durationHours) * 60),
        general_location: bookingPostcode.trim().toUpperCase().split(" ")[0],
        customer_amount_pence: latest.customer_amount_pence,
        cleaner_payout_pence: latest.cleaner_payout_pence,
        requirements: jobRequirements.trim() || null,
      })
      .select("id")
      .single();
    if (!jobError) {
      await Promise.all([
        db
          .from("service_requests")
          .update({ status: "accepted" })
          .eq("id", selected.id),
        db
          .from("customer_payments")
          .insert({
            job_id: job.id,
            amount_pence: latest.customer_amount_pence,
          }),
        db
          .from("job_events")
          .insert({
            job_id: job.id,
            event_type: "job_created",
            details: { request_reference: selected.reference },
          }),
      ]);
    }
    setSaving(false);
    if (jobError) return toast.error(jobError.message);
    toast.success("Quote accepted and job created");
    setSelected(null);
    fetchData();
  };

  const assignCleaner = async (job: Job) => {
    const cleanerId = assignmentChoices[job.id];
    if (!cleanerId) return toast.error("Choose an approved active cleaner.");
    setSaving(true);
    const { error } = await db.rpc("offer_job_to_cleaner", {
      p_job_id: job.id,
      p_cleaner_id: cleanerId,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Job offered to cleaner");
    fetchData();
  };

  const openJob = async (job: Job) => {
    setSelectedJob(job);
    setAddressLine1(job.address.address_line_1 || "");
    setAddressLine2(job.address.address_line_2 || "");
    setCity(job.address.city || "");
    setBookingPostcode(job.address.postcode || "");
    setAccessNotes(job.address.access_notes || "");
    setScheduledDate(job.scheduled_date);
    setStartTime(job.start_time?.slice(0, 5) || "");
    setDurationHours(
      job.expected_duration_minutes
        ? String(job.expected_duration_minutes / 60)
        : "",
    );
    setJobRequirements(job.requirements || "");
    setQualityNotes(job.quality_review_notes || "");
    const [{ data, error }, timeResult, checklistResult, eventResult] =
      await Promise.all([
      db
        .from("job_evidence")
        .select("id,evidence_type,storage_path,file_name,created_at")
        .eq("job_id", job.id)
        .order("created_at"),
      db
        .from("job_time_entries")
        .select(
          "id,clocked_in_at,clocked_out_at,corrected_minutes,correction_reason",
        )
        .eq("job_id", job.id)
        .order("clocked_in_at"),
      db
        .from("job_checklist_items")
        .select("id,title,is_required,completed_at")
        .eq("job_id", job.id)
        .order("position"),
      db
        .from("job_events")
        .select("id,event_type,created_at,details")
        .eq("job_id", job.id)
        .order("created_at", { ascending: false }),
    ]);
    setDeliveryTimes((timeResult.data as DeliveryTime[]) || []);
    setDeliveryChecklist((checklistResult.data as DeliveryChecklist[]) || []);
    setJobEvents((eventResult.data as JobEvent[]) || []);
    setCorrectionEntry("");
    setCorrectionMinutes("");
    setCorrectionReason("");
    if (error) {
      toast.error(error.message);
      setJobEvidence([]);
      return;
    }
    const evidenceWithUrls = await Promise.all(
      (data || []).map(async (item: JobEvidence) => {
        const { data: signed } = await supabase.storage
          .from("job-evidence")
          .createSignedUrl(item.storage_path, 3600);
        return { ...item, signedUrl: signed?.signedUrl };
      }),
    );
    setJobEvidence(evidenceWithUrls);
  };

  const correctTime = async () => {
    if (
      !correctionEntry ||
      !Number.isFinite(Number(correctionMinutes)) ||
      correctionReason.trim().length < 5
    )
      return toast.error(
        "Choose a time entry, enter minutes and provide an audit reason.",
      );
    setSaving(true);
    const { data, error } = await db.rpc("correct_job_time_entry", {
      p_entry_id: correctionEntry,
      p_minutes: Math.round(Number(correctionMinutes)),
      p_reason: correctionReason.trim(),
    });
    setSaving(false);
    if (error || !data)
      return toast.error(error?.message || "Time correction failed");
    toast.success("Worked time corrected and audited");
    if (selectedJob) openJob(selectedJob);
  };

  const saveJobDetails = async () => {
    if (!selectedJob) return;
    if (
      !addressLine1.trim() ||
      !city.trim() ||
      !bookingPostcode.trim() ||
      !scheduledDate ||
      !startTime ||
      !Number(durationHours)
    ) {
      return toast.error(
        "Full address, date, start time and duration are required.",
      );
    }
    setSaving(true);
    const [addressResult, jobResult] = await Promise.all([
      db
        .from("customer_addresses")
        .update({
          address_line_1: addressLine1.trim(),
          address_line_2: addressLine2.trim() || null,
          city: city.trim(),
          postcode: bookingPostcode.trim().toUpperCase(),
          access_notes: accessNotes.trim() || null,
        })
        .eq("id", selectedJob.address.id),
      db
        .from("jobs")
        .update({
          scheduled_date: scheduledDate,
          start_time: startTime,
          expected_duration_minutes: Math.round(Number(durationHours) * 60),
          requirements: jobRequirements.trim() || null,
          general_location: bookingPostcode.trim().toUpperCase().split(" ")[0],
        })
        .eq("id", selectedJob.id),
    ]);
    setSaving(false);
    if (addressResult.error || jobResult.error)
      return toast.error(
        addressResult.error?.message ||
          jobResult.error?.message ||
          "Could not save job details",
      );
    toast.success("Job details updated");
    setSelectedJob(null);
    fetchData();
  };

  const cancelJob = async () => {
    if (!selectedJob) return;
    setSaving(true);
    const { error } = await db
      .from("jobs")
      .update({ status: "cancelled" })
      .eq("id", selectedJob.id);
    if (!error) {
      await db.from("job_events").insert({
        job_id: selectedJob.id,
        event_type: "job_cancelled_by_admin",
        details: { previous_status: selectedJob.status },
      });
    }
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Job cancelled and recorded in the audit trail");
    setSelectedJob(null);
    fetchData();
  };

  const reviewCompletion = async (
    decision: "approved" | "rework_required" | "issue",
  ) => {
    if (!selectedJob) return;
    const beforeCount = jobEvidence.filter(
      (item) => item.evidence_type === "before",
    ).length;
    const afterCount = jobEvidence.filter(
      (item) => item.evidence_type === "after",
    ).length;
    if (decision === "approved" && (beforeCount < 1 || afterCount < 1))
      return toast.error(
        "Before and after evidence is required before approval.",
      );
    setSaving(true);
    const { data: authData } = await supabase.auth.getUser();
    const nextStatus =
      decision === "approved"
        ? "completed"
        : decision === "rework_required"
          ? "in_progress"
          : "issue";
    const { error } = await db
      .from("jobs")
      .update({
        status: nextStatus,
        quality_review_status: decision,
        quality_review_notes: qualityNotes.trim() || null,
        quality_reviewed_at: new Date().toISOString(),
        quality_reviewed_by: authData.user?.id || null,
      })
      .eq("id", selectedJob.id);
    if (!error) {
      const { data: assignment } = await db
        .from("job_assignments")
        .select("id,cleaner_id")
        .eq("job_id", selectedJob.id)
        .in("status", ["accepted", "completed"])
        .maybeSingle();
      if (assignment) {
        await Promise.all([
          decision === "rework_required"
            ? db
                .from("job_assignments")
                .update({ status: "accepted" })
                .eq("id", assignment.id)
            : Promise.resolve(),
          db
            .from("cleaner_payouts")
            .update({ status: decision === "approved" ? "approved" : "held" })
            .eq("job_id", selectedJob.id)
            .eq("cleaner_id", assignment.cleaner_id),
          db
            .from("job_events")
            .insert({
              job_id: selectedJob.id,
              event_type: `quality_${decision}`,
              details: { notes: qualityNotes.trim() || null },
            }),
        ]);
      }
    }
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(
      decision === "approved"
        ? "Completion approved and payout released for processing"
        : decision === "rework_required"
          ? "Job returned to cleaner for rework"
          : "Job placed on hold for investigation",
    );
    setSelectedJob(null);
    fetchData();
  };

  const updateCleaner = async (
    cleaner: Cleaner,
    updates: Record<string, unknown>,
  ) => {
    setSaving(true);
    const { error } = await db
      .from("cleaner_profiles")
      .update(updates)
      .eq("id", cleaner.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Cleaner status updated");
    fetchData();
  };

  const requestedSection = location.pathname.endsWith("/jobs")
    ? "jobs"
    : location.pathname.endsWith("/cleaners") ||
        location.pathname.endsWith("/onboarding")
      ? "cleaners"
      : "requests";
  const pageTitle =
    requestedSection === "jobs"
      ? "Jobs & Schedule"
      : location.pathname.endsWith("/onboarding")
        ? "Onboarding & Checks"
        : requestedSection === "cleaners"
          ? "Cleaners"
          : "Cleaning Requests";
  const isOnboarding = location.pathname.endsWith("/onboarding");
  const visibleCleaners = isOnboarding
    ? cleaners.filter(
        (cleaner) =>
          cleaner.application_status !== "approved" ||
          cleaner.verification_status !== "approved",
      )
    : cleaners.filter((cleaner) => cleaner.application_status === "approved");
  const visibleJobs = jobs.filter((job) => {
    if (jobStatusFilter === "all") return true;
    if (jobStatusFilter === "active")
      return !["closed", "cancelled"].includes(job.status);
    return job.status === jobStatusFilter;
  });
  const jobsByDate = visibleJobs.reduce<Record<string, Job[]>>((groups, job) => {
    (groups[job.scheduled_date] ||= []).push(job);
    return groups;
  }, {});
  const calendarDays = eachDayOfInterval({
    start: startOfWeek(startOfMonth(calendarMonth), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(calendarMonth), { weekStartsOn: 1 }),
  });

  return (
    <AdminLayout title={pageTitle}>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">{pageTitle}</h1>
            <p className="text-muted-foreground">
              Qualify requests, record quotes, create jobs and assign cleaners.
            </p>
          </div>
          <Button variant="outline" onClick={fetchData}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>

        <Tabs value={requestedSection}>
          <TabsContent value="requests" className="space-y-4">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[
                  "active",
                  "all",
                  "new",
                  "contacted",
                  "qualified",
                  "quoted",
                  "accepted",
                  "declined",
                  "lost",
                  "cancelled",
                ].map((status) => (
                  <SelectItem key={status} value={status}>
                    {status.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {loading ? (
              <Loader2 className="h-7 w-7 animate-spin" />
            ) : (
              visibleRequests.map((request) => (
                <div
                  key={request.id}
                  className="rounded-xl border bg-card p-4 shadow-sm"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">
                          {request.reference}
                        </span>
                        <Badge className={requestStatusClasses[request.status]}>
                          {request.status}
                        </Badge>
                        <span>{request.service_type.name}</span>
                      </div>
                      <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
                        <span>
                          <UserRound className="mr-1 inline h-4 w-4" />
                          {request.customer.name}
                        </span>
                        <span>
                          <Phone className="mr-1 inline h-4 w-4" />
                          {request.customer.phone}
                        </span>
                        <span>
                          <MapPin className="mr-1 inline h-4 w-4" />
                          {request.address.postcode}
                        </span>
                        <span>
                          <Calendar className="mr-1 inline h-4 w-4" />
                          {request.preferred_date_from || "No date"}
                        </span>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => openRequest(request)}
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      Open
                    </Button>
                  </div>
                </div>
              ))
            )}
          </TabsContent>
          <TabsContent value="jobs" className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-4">
              {[
                ["Unassigned", "awaiting_assignment"],
                ["Offered", "offered"],
                ["In delivery", "in_progress"],
                ["Quality review", "quality_check"],
              ].map(([label, status]) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setJobStatusFilter(status)}
                  className="rounded-xl border bg-card p-4 text-left transition hover:border-secondary"
                >
                  <p className="text-sm text-muted-foreground">{label}</p>
                  <p className="mt-1 text-2xl font-bold">
                    {jobs.filter((job) => job.status === status).length}
                  </p>
                </button>
              ))}
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Select value={jobStatusFilter} onValueChange={setJobStatusFilter}>
                <SelectTrigger className="w-full sm:w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["active", "all", "awaiting_assignment", "offered", "assigned", "in_progress", "quality_check", "completed", "closed", "cancelled", "issue"].map(
                    (status) => (
                      <SelectItem key={status} value={status}>
                        {status.replace(/_/g, " ")}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
              <div className="flex rounded-lg border bg-card p-1">
                <Button
                  size="sm"
                  variant={jobView === "list" ? "secondary" : "ghost"}
                  onClick={() => setJobView("list")}
                >
                  <List className="mr-2 h-4 w-4" /> List
                </Button>
                <Button
                  size="sm"
                  variant={jobView === "calendar" ? "secondary" : "ghost"}
                  onClick={() => setJobView("calendar")}
                >
                  <Calendar className="mr-2 h-4 w-4" /> Calendar
                </Button>
              </div>
            </div>
            {visibleJobs.length === 0 && (
              <p className="text-muted-foreground">No managed jobs yet.</p>
            )}
            {jobView === "calendar" && (
              <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
                <div className="flex items-center justify-between border-b p-4">
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="Previous month"
                    onClick={() => setCalendarMonth((month) => subMonths(month, 1))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <div className="text-center">
                    <h2 className="text-lg font-semibold">
                      {format(calendarMonth, "MMMM yyyy")}
                    </h2>
                    <Button
                      variant="link"
                      size="sm"
                      onClick={() => setCalendarMonth(startOfMonth(new Date()))}
                    >
                      Today
                    </Button>
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="Next month"
                    onClick={() => setCalendarMonth((month) => addMonths(month, 1))}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid grid-cols-7 border-b bg-muted/40 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(
                    (day) => (
                      <div key={day} className="border-r px-1 py-2 last:border-r-0">
                        {day}
                      </div>
                    ),
                  )}
                </div>
                <div className="grid grid-cols-7">
                  {calendarDays.map((day) => {
                    const dateKey = format(day, "yyyy-MM-dd");
                    const dayJobs = jobsByDate[dateKey] || [];
                    const isToday = dateKey === format(new Date(), "yyyy-MM-dd");
                    return (
                      <div
                        key={dateKey}
                        className={`min-h-28 border-b border-r p-1.5 sm:min-h-36 ${
                          isSameMonth(day, calendarMonth)
                            ? "bg-card"
                            : "bg-muted/20 text-muted-foreground"
                        }`}
                      >
                        <div
                          className={`mb-1 flex h-7 w-7 items-center justify-center rounded-full text-xs ${
                            isToday ? "bg-secondary font-bold text-white" : ""
                          }`}
                        >
                          {format(day, "d")}
                        </div>
                        <div className="space-y-1">
                          {dayJobs.map((job) => (
                            <button
                              type="button"
                              key={job.id}
                              onClick={() => openJob(job)}
                              title={`${job.start_time?.slice(0, 5) || "TBC"} · ${job.customer.name} · ${job.address.postcode}`}
                              className={`block w-full truncate rounded px-1.5 py-1 text-left text-[10px] font-medium leading-tight sm:text-xs ${
                                job.status === "in_progress"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : job.status === "quality_check"
                                    ? "bg-amber-100 text-amber-800"
                                    : job.status === "cancelled"
                                      ? "bg-red-100 text-red-700 line-through"
                                      : job.status === "awaiting_assignment"
                                        ? "bg-purple-100 text-purple-800"
                                        : "bg-blue-100 text-blue-800"
                              }`}
                            >
                              <span className="hidden sm:inline">
                                {job.start_time?.slice(0, 5) || "TBC"} ·{" "}
                              </span>
                              {job.customer.name} · {job.address.postcode}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {jobView === "list" && visibleJobs.map((job) => (
              <div key={job.id} className="rounded-xl border bg-card p-4">
                <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{job.reference}</span>
                      <Badge variant="outline">{job.status}</Badge>
                      <span>{job.service_type.name}</span>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {job.customer.name} · {job.address.postcode} ·{" "}
                      {format(
                        new Date(`${job.scheduled_date}T12:00:00`),
                        "d MMM yyyy",
                      )}{" "}
                      · Customer {money(job.customer_amount_pence)} · Cleaner{" "}
                      {money(job.cleaner_payout_pence)}
                    </p>
                    <p className="mt-1 text-sm">
                      Cleaner: {job.assignments?.find((assignment) =>
                        ["offered", "accepted", "completed"].includes(
                          assignment.status,
                        ),
                      )?.cleaner?.full_name || "Unassigned"}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button variant="outline" onClick={() => openJob(job)}>
                      <Eye className="mr-2 h-4 w-4" />
                      Open job
                    </Button>
                    {["awaiting_assignment", "offered"].includes(
                      job.status,
                    ) && (
                      <>
                        <Select
                          value={assignmentChoices[job.id] || ""}
                          onValueChange={(value) =>
                            setAssignmentChoices((current) => ({
                              ...current,
                              [job.id]: value,
                            }))
                          }
                        >
                          <SelectTrigger className="w-64">
                            <SelectValue placeholder="Choose vetted active cleaner" />
                          </SelectTrigger>
                          <SelectContent>
                            {cleaners
                              .filter(
                                (cleaner) =>
                                  cleaner.application_status === "approved" &&
                                  cleaner.verification_status === "approved" &&
                                  cleaner.operational_status === "active",
                              )
                              .map((cleaner) => (
                                <SelectItem key={cleaner.id} value={cleaner.id}>
                                  {cleaner.full_name || "Unnamed cleaner"}{" "}
                                  {cleaner.postcode
                                    ? `· ${cleaner.postcode}`
                                    : ""}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                        <Button
                          onClick={() => assignCleaner(job)}
                          disabled={saving}
                        >
                          Offer job
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </TabsContent>
          <TabsContent value="cleaners" className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border bg-card p-4">
                <p className="text-sm text-muted-foreground">
                  {isOnboarding ? "Awaiting review" : "Active cleaners"}
                </p>
                <p className="mt-1 text-2xl font-bold">
                  {isOnboarding
                    ? cleaners.filter(
                        (cleaner) => cleaner.application_status === "pending",
                      ).length
                    : cleaners.filter(
                        (cleaner) => cleaner.operational_status === "active",
                      ).length}
                </p>
              </div>
              <div className="rounded-xl border bg-card p-4">
                <p className="text-sm text-muted-foreground">
                  {isOnboarding ? "Checks pending" : "Suspended"}
                </p>
                <p className="mt-1 text-2xl font-bold">
                  {isOnboarding
                    ? cleaners.filter(
                        (cleaner) => cleaner.verification_status === "pending",
                      ).length
                    : cleaners.filter(
                        (cleaner) =>
                          cleaner.operational_status === "suspended",
                      ).length}
                </p>
              </div>
              <div className="rounded-xl border bg-card p-4">
                <p className="text-sm text-muted-foreground">
                  {isOnboarding ? "Rejected" : "Payout ready"}
                </p>
                <p className="mt-1 text-2xl font-bold">
                  {isOnboarding
                    ? cleaners.filter(
                        (cleaner) =>
                          cleaner.application_status === "rejected" ||
                          cleaner.verification_status === "rejected",
                      ).length
                    : cleaners.filter(
                        (cleaner) => cleaner.payout_status === "ready",
                      ).length}
                </p>
              </div>
            </div>
            <div>
              <h2 className="text-lg font-semibold">
                {isOnboarding ? "Application queue" : "Cleaner directory"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {isOnboarding
                  ? "Review applications first, then record completed identity and vetting checks before activation."
                  : "Manage approved cleaners, operational availability and payout readiness."}
              </p>
            </div>
            {visibleCleaners.length === 0 && (
              <p className="rounded-xl border bg-card p-6 text-muted-foreground">
                {isOnboarding
                  ? "No applications currently require review."
                  : "No approved cleaners yet."}
              </p>
            )}
            {visibleCleaners.map((cleaner) => (
              <div key={cleaner.id} className="rounded-xl border bg-card p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">
                        {cleaner.full_name || "Unnamed cleaner"}
                      </span>
                      <Badge variant="outline">
                        {cleaner.application_status}
                      </Badge>
                      <Badge variant="outline">
                        {cleaner.operational_status}
                      </Badge>
                      <Badge variant="outline">
                        verification:{" "}
                        {cleaner.verification_status.replace(/_/g, " ")}
                      </Badge>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {cleaner.phone || "No phone"} ·{" "}
                      {cleaner.postcode || "No postcode"} ·{" "}
                      {cleaner.has_transport
                        ? "Has transport"
                        : "Transport not confirmed"}
                    </p>
                    {cleaner.experience_summary && (
                      <p className="mt-2 max-w-2xl text-sm">
                        {cleaner.experience_summary}
                      </p>
                    )}
                    <p className="mt-2 text-xs text-muted-foreground">
                      Applied {format(new Date(cleaner.created_at), "dd MMM yyyy")} ·
                      payout: {cleaner.payout_status.replace(/_/g, " ")}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {isOnboarding && cleaner.application_status === "pending" && (
                      <>
                        <Button
                          onClick={() =>
                            updateCleaner(cleaner, {
                              application_status: "approved",
                              operational_status: "inactive",
                              verification_status: "pending",
                            })
                          }
                          disabled={saving}
                        >
                          Approve application
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() =>
                            updateCleaner(cleaner, {
                              application_status: "rejected",
                              operational_status: "inactive",
                            })
                          }
                          disabled={saving}
                        >
                          Reject
                        </Button>
                      </>
                    )}
                    {isOnboarding &&
                      cleaner.application_status === "approved" &&
                      cleaner.verification_status === "pending" && (
                        <>
                          <Button
                            onClick={() =>
                              updateCleaner(cleaner, {
                                verification_status: "approved",
                                operational_status: "active",
                                approved_at: new Date().toISOString(),
                              })
                            }
                            disabled={saving}
                          >
                            Approve checks & activate
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() =>
                              updateCleaner(cleaner, {
                                verification_status: "rejected",
                                operational_status: "inactive",
                              })
                            }
                            disabled={saving}
                          >
                            Reject checks
                          </Button>
                        </>
                      )}
                    {!isOnboarding &&
                      cleaner.application_status === "approved" &&
                      cleaner.operational_status === "active" && (
                        <Button
                          variant="outline"
                          onClick={() =>
                            updateCleaner(cleaner, {
                              operational_status: "suspended",
                            })
                          }
                          disabled={saving}
                        >
                          Suspend
                        </Button>
                      )}
                    {!isOnboarding &&
                      cleaner.application_status === "approved" &&
                      cleaner.operational_status === "suspended" && (
                        <Button
                          onClick={() =>
                            updateCleaner(cleaner, {
                              operational_status: "active",
                            })
                          }
                          disabled={saving}
                        >
                          Reactivate
                        </Button>
                      )}
                  </div>
                </div>
              </div>
            ))}
          </TabsContent>
        </Tabs>
      </div>

      <Dialog
        open={!!selected}
        onOpenChange={(open) => !open && setSelected(null)}
      >
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selected?.reference} · {selected?.service_type.name}
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-5">
              <div className="grid gap-3 rounded-lg bg-muted/40 p-4 sm:grid-cols-2">
                <div>
                  <Label>Customer</Label>
                  <p>{selected.customer.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {selected.customer.email}
                    <br />
                    {selected.customer.phone}
                  </p>
                </div>
                <div>
                  <Label>Property</Label>
                  <p>
                    {selected.address.postcode} ·{" "}
                    {selected.property_type || "Not specified"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {selected.bedrooms ? `${selected.bedrooms} bedroom(s)` : ""}
                  </p>
                </div>
              </div>
              {selected.customer_notes && (
                <div>
                  <Label>Customer notes</Label>
                  <p className="mt-1 whitespace-pre-wrap rounded-md border p-3 text-sm">
                    {selected.customer_notes}
                  </p>
                </div>
              )}
              <div>
                <Label>Internal notes</Label>
                <Textarea
                  value={adminNotes}
                  onChange={(event) => setAdminNotes(event.target.value)}
                  rows={3}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() => updateRequest("contacted")}
                  disabled={saving}
                >
                  Mark contacted
                </Button>
                <Button
                  variant="outline"
                  onClick={() => updateRequest("qualified")}
                  disabled={saving}
                >
                  Mark qualified
                </Button>
                <Button
                  variant="outline"
                  onClick={() => updateRequest("lost")}
                  disabled={saving}
                >
                  Mark lost
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => updateRequest()}
                  disabled={saving}
                >
                  Save notes
                </Button>
              </div>
              <div className="space-y-3 border-t pt-5">
                <h3 className="font-semibold">Confirmed booking details</h3>
                <p className="text-sm text-muted-foreground">
                  These details become visible to the cleaner only after they
                  accept the job.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label>Address line 1</Label>
                    <Input
                      value={addressLine1}
                      onChange={(event) => setAddressLine1(event.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Address line 2</Label>
                    <Input
                      value={addressLine2}
                      onChange={(event) => setAddressLine2(event.target.value)}
                    />
                  </div>
                  <div>
                    <Label>City</Label>
                    <Input
                      value={city}
                      onChange={(event) => setCity(event.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Postcode</Label>
                    <Input
                      value={bookingPostcode}
                      onChange={(event) =>
                        setBookingPostcode(event.target.value.toUpperCase())
                      }
                    />
                  </div>
                  <div>
                    <Label>Confirmed date</Label>
                    <Input
                      type="date"
                      value={scheduledDate}
                      onChange={(event) => setScheduledDate(event.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Start time</Label>
                    <Input
                      type="time"
                      value={startTime}
                      onChange={(event) => setStartTime(event.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Expected duration (hours)</Label>
                    <Input
                      type="number"
                      min="0.5"
                      step="0.5"
                      value={durationHours}
                      onChange={(event) => setDurationHours(event.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <Label>Access notes</Label>
                  <Textarea
                    value={accessNotes}
                    onChange={(event) => setAccessNotes(event.target.value)}
                    placeholder="Parking, keys, entry instructions, alarm information..."
                  />
                </div>
                <div>
                  <Label>Cleaner instructions</Label>
                  <Textarea
                    value={jobRequirements}
                    onChange={(event) => setJobRequirements(event.target.value)}
                    rows={3}
                  />
                </div>
              </div>
              <div className="space-y-3 border-t pt-5">
                <h3 className="font-semibold">Quote economics</h3>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <Label>Customer price (£)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={customerPrice}
                      onChange={(event) => setCustomerPrice(event.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Cleaner payout (£)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={cleanerPayout}
                      onChange={(event) => setCleanerPayout(event.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Valid until</Label>
                    <Input
                      type="date"
                      value={quoteValidUntil}
                      onChange={(event) =>
                        setQuoteValidUntil(event.target.value)
                      }
                    />
                  </div>
                </div>
                {customerPrice && cleanerPayout && (
                  <p className="text-sm text-muted-foreground">
                    Expected gross margin:{" "}
                    {money(
                      Math.round(
                        (Number(customerPrice) - Number(cleanerPayout)) * 100,
                      ),
                    )}
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button onClick={createQuote} disabled={saving}>
                    {saving && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Record quote sent
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={acceptAndCreateJob}
                    disabled={saving}
                  >
                    Record acceptance & create job
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!selectedJob}
        onOpenChange={(open) => !open && setSelectedJob(null)}
      >
        <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedJob?.reference} · Job control</DialogTitle>
          </DialogHeader>
          {selectedJob && (
            <div className="space-y-6">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{selectedJob.status}</Badge>
                <Badge variant="outline">
                  quality:{" "}
                  {selectedJob.quality_review_status?.replace(/_/g, " ")}
                </Badge>
                <Badge variant="outline">
                  cleaner payout: {money(selectedJob.cleaner_payout_pence)}
                </Badge>
              </div>
              <div className="grid gap-3 rounded-xl border bg-muted/30 p-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Customer
                  </p>
                  <p className="mt-1 font-medium">{selectedJob.customer.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedJob.customer.phone}
                  </p>
                  <p className="mt-2 text-sm">
                    {selectedJob.service_type.name} · Customer price{" "}
                    {money(selectedJob.customer_amount_pence)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Cleaner
                  </p>
                  {(() => {
                    const assignment = selectedJob.assignments?.find((item) =>
                      ["offered", "accepted", "completed"].includes(item.status),
                    );
                    return assignment?.cleaner ? (
                      <>
                        <p className="mt-1 font-medium">
                          {assignment.cleaner.full_name || "Unnamed cleaner"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {assignment.cleaner.phone || "No phone recorded"} ·{" "}
                          {assignment.cleaner.postcode || "No postcode"}
                        </p>
                        <Badge className="mt-2" variant="outline">
                          assignment: {assignment.status}
                        </Badge>
                      </>
                    ) : (
                      <p className="mt-1 text-sm text-amber-700">
                        No cleaner currently assigned.
                      </p>
                    );
                  })()}
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Address line 1</Label>
                  <Input
                    value={addressLine1}
                    onChange={(event) => setAddressLine1(event.target.value)}
                  />
                </div>
                <div>
                  <Label>Address line 2</Label>
                  <Input
                    value={addressLine2}
                    onChange={(event) => setAddressLine2(event.target.value)}
                  />
                </div>
                <div>
                  <Label>City</Label>
                  <Input
                    value={city}
                    onChange={(event) => setCity(event.target.value)}
                  />
                </div>
                <div>
                  <Label>Postcode</Label>
                  <Input
                    value={bookingPostcode}
                    onChange={(event) =>
                      setBookingPostcode(event.target.value.toUpperCase())
                    }
                  />
                </div>
                <div>
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={scheduledDate}
                    onChange={(event) => setScheduledDate(event.target.value)}
                  />
                </div>
                <div>
                  <Label>Start time</Label>
                  <Input
                    type="time"
                    value={startTime}
                    onChange={(event) => setStartTime(event.target.value)}
                  />
                </div>
                <div>
                  <Label>Duration (hours)</Label>
                  <Input
                    type="number"
                    min="0.5"
                    step="0.5"
                    value={durationHours}
                    onChange={(event) => setDurationHours(event.target.value)}
                  />
                </div>
              </div>
              <div>
                <Label>Access notes</Label>
                <Textarea
                  value={accessNotes}
                  onChange={(event) => setAccessNotes(event.target.value)}
                />
              </div>
              <div>
                <Label>Cleaner instructions</Label>
                <Textarea
                  value={jobRequirements}
                  onChange={(event) => setJobRequirements(event.target.value)}
                />
              </div>
              <Button
                variant="outline"
                onClick={saveJobDetails}
                disabled={saving}
              >
                Save booking details
              </Button>
              {!['cancelled', 'closed'].includes(selectedJob.status) && (
                <Button
                  variant="destructive"
                  onClick={cancelJob}
                  disabled={saving}
                >
                  Cancel job
                </Button>
              )}
              <div className="space-y-4 border-t pt-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">Live delivery</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Monitor attendance, worked time and the cleaner checklist.
                    </p>
                  </div>
                  {(() => {
                    const scheduledStart = new Date(
                      `${selectedJob.scheduled_date}T${selectedJob.start_time || "00:00"}`,
                    ).getTime();
                    const isLate =
                      selectedJob.status === "assigned" &&
                      deliveryTimes.length === 0 &&
                      Number.isFinite(scheduledStart) &&
                      liveNow > scheduledStart + 15 * 60_000;
                    const activeEntry = deliveryTimes.find(
                      (entry) => !entry.clocked_out_at,
                    );
                    return isLate ? (
                      <Badge className="bg-red-100 text-red-700">
                        <AlertTriangle className="mr-1 h-3 w-3" /> Cleaner late
                      </Badge>
                    ) : activeEntry ? (
                      <Badge className="bg-emerald-100 text-emerald-700">
                        <Clock className="mr-1 h-3 w-3" /> On site
                      </Badge>
                    ) : (
                      <Badge variant="outline">Not currently clocked in</Badge>
                    );
                  })()}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border p-4">
                    <p className="text-sm font-medium">Attendance</p>
                    {deliveryTimes.length === 0 ? (
                      <p className="mt-2 text-sm text-muted-foreground">
                        No clock activity yet.
                      </p>
                    ) : (
                      <div className="mt-3 space-y-3">
                        {deliveryTimes.map((entry) => {
                          const end = entry.clocked_out_at
                            ? new Date(entry.clocked_out_at).getTime()
                            : liveNow;
                          const rawMinutes = Math.max(
                            0,
                            Math.floor(
                              (end - new Date(entry.clocked_in_at).getTime()) /
                                60_000,
                            ),
                          );
                          const workedMinutes =
                            entry.corrected_minutes ?? rawMinutes;
                          return (
                            <div key={entry.id} className="text-sm">
                              <div className="flex items-center justify-between gap-2">
                                <span>
                                  {format(
                                    new Date(entry.clocked_in_at),
                                    "HH:mm",
                                  )}
                                  {entry.clocked_out_at
                                    ? ` – ${format(new Date(entry.clocked_out_at), "HH:mm")}`
                                    : " – active"}
                                </span>
                                <span className="font-medium">
                                  {Math.floor(workedMinutes / 60)}h {workedMinutes % 60}m
                                </span>
                              </div>
                              {entry.correction_reason && (
                                <p className="mt-1 text-xs text-amber-700">
                                  Corrected: {entry.correction_reason}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="rounded-xl border p-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">Job checklist</p>
                      <span className="text-sm text-muted-foreground">
                        {deliveryChecklist.filter((item) => item.completed_at)
                          .length}
                        /{deliveryChecklist.length}
                      </span>
                    </div>
                    {deliveryChecklist.length === 0 ? (
                      <p className="mt-2 text-sm text-muted-foreground">
                        Checklist will appear once the job is prepared.
                      </p>
                    ) : (
                      <div className="mt-3 space-y-2">
                        {deliveryChecklist.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-start gap-2 text-sm"
                          >
                            <CheckCircle2
                              className={`mt-0.5 h-4 w-4 ${item.completed_at ? "text-emerald-600" : "text-slate-300"}`}
                            />
                            <span
                              className={
                                item.completed_at
                                  ? "text-muted-foreground line-through"
                                  : ""
                              }
                            >
                              {item.title}
                              {item.is_required ? " *" : ""}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {deliveryTimes.length > 0 && (
                  <div className="rounded-xl border bg-muted/30 p-4">
                    <p className="text-sm font-medium">Correct worked time</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Corrections are recorded in the job audit trail.
                    </p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_140px]">
                      <Select
                        value={correctionEntry}
                        onValueChange={setCorrectionEntry}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Choose attendance entry" />
                        </SelectTrigger>
                        <SelectContent>
                          {deliveryTimes.map((entry) => (
                            <SelectItem key={entry.id} value={entry.id}>
                              {format(new Date(entry.clocked_in_at), "dd MMM HH:mm")}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        min="0"
                        placeholder="Total minutes"
                        value={correctionMinutes}
                        onChange={(event) =>
                          setCorrectionMinutes(event.target.value)
                        }
                      />
                    </div>
                    <Textarea
                      className="mt-3"
                      placeholder="Reason for correction (required)"
                      value={correctionReason}
                      onChange={(event) =>
                        setCorrectionReason(event.target.value)
                      }
                    />
                    <Button
                      className="mt-3"
                      variant="outline"
                      onClick={correctTime}
                      disabled={saving}
                    >
                      Save audited correction
                    </Button>
                  </div>
                )}
              </div>
              <div className="border-t pt-5">
                <h3 className="font-semibold">Completion evidence</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Cleaner notes:{" "}
                  {selectedJob.cleaner_completion_notes || "None provided"}
                </p>
                {jobEvidence.length === 0 ? (
                  <p className="mt-4 rounded-lg bg-muted p-4 text-sm text-muted-foreground">
                    No before/after photos uploaded.
                  </p>
                ) : (
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    {(["before", "after"] as const).map((type) => (
                      <div key={type}>
                        <h4 className="mb-2 font-medium capitalize">
                          {type} photos (
                          {
                            jobEvidence.filter(
                              (item) => item.evidence_type === type,
                            ).length
                          }
                          )
                        </h4>
                        <div className="grid grid-cols-2 gap-2">
                          {jobEvidence
                            .filter((item) => item.evidence_type === type)
                            .map((item) =>
                              item.signedUrl ? (
                                <a
                                  key={item.id}
                                  href={item.signedUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  <img
                                    src={item.signedUrl}
                                    alt={`${type} evidence`}
                                    className="h-32 w-full rounded-lg border object-cover"
                                  />
                                </a>
                              ) : (
                                <div
                                  key={item.id}
                                  className="flex h-32 items-center justify-center rounded-lg border"
                                >
                                  <Image className="h-6 w-6" />
                                </div>
                              ),
                            )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="border-t pt-5">
                <h3 className="font-semibold">Job history</h3>
                {jobEvents.length === 0 ? (
                  <p className="mt-2 text-sm text-muted-foreground">
                    No audit events recorded yet.
                  </p>
                ) : (
                  <div className="mt-3 space-y-3">
                    {jobEvents.map((event) => (
                      <div key={event.id} className="flex gap-3 text-sm">
                        <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-secondary" />
                        <div>
                          <p className="font-medium">
                            {event.event_type.replace(/_/g, " ")}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(event.created_at), "dd MMM yyyy, HH:mm")}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {selectedJob.status === "quality_check" && (
                <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <div>
                    <Label>Quality review notes</Label>
                    <Textarea
                      value={qualityNotes}
                      onChange={(event) => setQualityNotes(event.target.value)}
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={() => reviewCompletion("approved")}
                      disabled={saving}
                    >
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Approve completion
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => reviewCompletion("rework_required")}
                      disabled={saving}
                    >
                      <RotateCcw className="mr-2 h-4 w-4" />
                      Request rework
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => reviewCompletion("issue")}
                      disabled={saving}
                    >
                      <AlertTriangle className="mr-2 h-4 w-4" />
                      Flag issue
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
