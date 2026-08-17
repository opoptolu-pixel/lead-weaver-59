import { useEffect, useMemo, useRef, useState } from "react";
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
  Columns3,
  Eye,
  Image,
  Loader2,
  List,
  MapPin,
  Minus,
  Phone,
  Plus,
  RefreshCw,
  RotateCcw,
  Sparkles,
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
  scheduled_date: string | null;
  start_time: string | null;
  expected_duration_minutes: number | null;
  requirements: string | null;
  add_ons?: QuoteAddOn[];
}

interface ServiceAddOn {
  id: string; code: string; name: string; category: string; description: string | null;
  customer_price_pence: number; cleaner_payout_pence: number; duration_minutes: number;
  unit_label: string; max_quantity: number; is_active: boolean; display_order: number;
}

interface QuoteAddOn {
  id: string; addon_id: string | null; addon_code: string; addon_name: string; category: string;
  quantity: number; unit_customer_price_pence: number; unit_cleaner_payout_pence: number; unit_duration_minutes: number;
}

interface CustomerPayment {
  id: string;
  job_id: string;
  amount_pence: number;
  status: string;
  provider: string | null;
  provider_reference: string | null;
  paid_at: string | null;
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

interface DispatchCandidate {
  cleaner_id: string;
  full_name: string | null;
  phone: string | null;
  postcode: string | null;
  has_transport: boolean | null;
  available: boolean;
  has_conflict: boolean;
  active_job_count: number;
  service_areas: string[];
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

const KANBAN_COLUMNS = [
  { title: "Unassigned", statuses: ["awaiting_assignment"], target: "awaiting_assignment" },
  { title: "Offered", statuses: ["offered"], target: "offered" },
  { title: "Assigned", statuses: ["assigned"], target: "assigned" },
  { title: "In progress", statuses: ["in_progress"], target: "in_progress" },
  { title: "Quality check", statuses: ["quality_check"], target: "quality_check" },
  { title: "Completed", statuses: ["completed", "closed"], target: "completed" },
  { title: "Issues", statuses: ["issue", "cancelled"], target: "issue" },
] as const;
const REQUEST_KANBAN_COLUMNS = [
  { title: "New", statuses: ["new"], target: "new" },
  { title: "Contacted", statuses: ["contacted"], target: "contacted" },
  { title: "Qualified", statuses: ["qualified"], target: "qualified" },
  { title: "Quoted", statuses: ["quoted"], target: "quoted" },
  { title: "Booked", statuses: ["accepted"], target: "accepted" },
  { title: "Closed / Lost", statuses: ["declined", "lost", "cancelled"], target: "lost" },
] as const;

export default function AdminServiceRequests() {
  const location = useLocation();
  const [requests, setRequests] = useState<ManagedRequest[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [customerPayments, setCustomerPayments] = useState<CustomerPayment[]>([]);
  const [cleaners, setCleaners] = useState<Cleaner[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState("active");
  const [requestView, setRequestView] = useState<"list" | "kanban">("kanban");
  const [selected, setSelected] = useState<ManagedRequest | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [customerPrice, setCustomerPrice] = useState("");
  const [cleanerPayout, setCleanerPayout] = useState("");
  const [addOnCatalogue, setAddOnCatalogue] = useState<ServiceAddOn[]>([]);
  const [addOnQuantities, setAddOnQuantities] = useState<Record<string, number>>({});
  const [showAddOns, setShowAddOns] = useState(false);
  const [quoteValidUntil, setQuoteValidUntil] = useState("");
  const [offlinePaymentReference, setOfflinePaymentReference] = useState("");
  const [assignmentChoices, setAssignmentChoices] = useState<
    Record<string, string>
  >({});
  const [dispatchCandidates, setDispatchCandidates] = useState<DispatchCandidate[]>([]);
  const [dispatchReason, setDispatchReason] = useState("");
  const [loadingCandidates, setLoadingCandidates] = useState(false);
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
  const [jobView, setJobView] = useState<"list" | "calendar" | "kanban">("kanban");
  const [jobStatusFilter, setJobStatusFilter] = useState("active");
  const [jobEvents, setJobEvents] = useState<JobEvent[]>([]);
  const [calendarMonth, setCalendarMonth] = useState(() => startOfMonth(new Date()));
  const loadedOnce = useRef(false);
  const selectedRequestIdRef = useRef<string | null>(null);
  const knownJobIdsRef = useRef<Set<string>>(new Set());
  const realtimeRefreshTimerRef = useRef<number | null>(null);
  const [draggedJobId, setDraggedJobId] = useState<string | null>(null);
  const [stageOverride, setStageOverride] = useState<{ job: Job; target: string } | null>(null);
  const [stageReason, setStageReason] = useState("");
  const [draggedRequestId, setDraggedRequestId] = useState<string | null>(null);
  const [requestMove, setRequestMove] = useState<{ request: ManagedRequest; target: string } | null>(null);
  const [requestStageReason, setRequestStageReason] = useState("");

  useEffect(() => {
    const timer = window.setInterval(() => setLiveNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    selectedRequestIdRef.current = selected?.id || null;
  }, [selected?.id]);

  const fetchData = async () => {
    if (!loadedOnce.current) setLoading(true);
    const [requestResult, initialJobResult, cleanerResult, paymentResult, addOnResult] = await Promise.all([
      db
        .from("service_requests")
        .select(
          `
        *,
        customer:customers(id,name,email,phone),
        address:customer_addresses(id,address_line_1,address_line_2,postcode,city,access_notes),
        service_type:service_types(id,name),
        quotes(id,status,customer_amount_pence,cleaner_payout_pence,valid_until,version,scheduled_date,start_time,expected_duration_minutes,requirements,add_ons:quote_addons(id,addon_id,addon_code,addon_name,category,quantity,unit_customer_price_pence,unit_cleaner_payout_pence,unit_duration_minutes))
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
      db
        .from("customer_payments")
        .select("id,job_id,amount_pence,status,provider,provider_reference,paid_at")
        .order("created_at", { ascending: false }),
      db.from("service_addons").select("*").eq("is_active", true).order("display_order"),
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

    if (
      requestResult.error ||
      jobResult.error ||
      cleanerResult.error ||
      paymentResult.error
      || addOnResult.error
    ) {
      toast.error(
          requestResult.error?.message ||
          jobResult.error?.message ||
          cleanerResult.error?.message ||
          paymentResult.error?.message ||
          addOnResult.error?.message ||
          "Could not load managed operations",
      );
    } else {
      const nextRequests = requestResult.data || [];
      const nextJobs = (jobResult.data as unknown as Job[]) || [];
      const newlyConfirmedJob = loadedOnce.current
        ? nextJobs.find(
            (job) =>
              job.service_request_id === selectedRequestIdRef.current &&
              !knownJobIdsRef.current.has(job.id),
          )
        : null;
      setRequests(nextRequests);
      setJobs(nextJobs);
      setCleaners(cleanerResult.data || []);
      setCustomerPayments((paymentResult.data as CustomerPayment[]) || []);
      setAddOnCatalogue((addOnResult.data as ServiceAddOn[]) || []);
      setSelected((current) => current ? nextRequests.find((request) => request.id === current.id) || current : null);
      setSelectedJob((current) => current ? nextJobs.find((job) => job.id === current.id) || current : null);
      knownJobIdsRef.current = new Set(nextJobs.map((job) => job.id));
      if (newlyConfirmedJob) {
        toast.success(
          `Payment received — ${newlyConfirmedJob.reference} was created`,
        );
      }
    }
    loadedOnce.current = true;
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const scheduleRefresh = () => {
      if (realtimeRefreshTimerRef.current) {
        window.clearTimeout(realtimeRefreshTimerRef.current);
      }
      realtimeRefreshTimerRef.current = window.setTimeout(() => {
        fetchData();
      }, 350);
    };
    const channel = supabase
      .channel("admin-managed-agency-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "service_requests" },
        scheduleRefresh,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "quotes" },
        scheduleRefresh,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "jobs" },
        scheduleRefresh,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "customer_payments" },
        scheduleRefresh,
      )
      .subscribe();
    const fallback = window.setInterval(() => {
      if (selectedRequestIdRef.current) fetchData();
    }, 15_000);

    return () => {
      if (realtimeRefreshTimerRef.current) {
        window.clearTimeout(realtimeRefreshTimerRef.current);
      }
      window.clearInterval(fallback);
      supabase.removeChannel(channel);
    };
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
    const priorAddOns = latest?.add_ons || [];
    const priorCustomerAddOns = priorAddOns.reduce((sum, item) => sum + item.quantity * item.unit_customer_price_pence, 0);
    const priorCleanerAddOns = priorAddOns.reduce((sum, item) => sum + item.quantity * item.unit_cleaner_payout_pence, 0);
    setCustomerPrice(latest ? String((latest.customer_amount_pence - priorCustomerAddOns) / 100) : "");
    setCleanerPayout(latest ? String((latest.cleaner_payout_pence - priorCleanerAddOns) / 100) : "");
    setAddOnQuantities(Object.fromEntries(priorAddOns.filter((item) => item.addon_id).map((item) => [item.addon_id as string, item.quantity])));
    setShowAddOns(priorAddOns.length > 0);
    setQuoteValidUntil(
      latest?.valid_until ? latest.valid_until.slice(0, 10) : "",
    );
    setOfflinePaymentReference("");
    setAddressLine1(request.address.address_line_1 || "");
    setAddressLine2(request.address.address_line_2 || "");
    setCity(request.address.city || "");
    setBookingPostcode(request.address.postcode || "");
    setAccessNotes(request.address.access_notes || "");
    setScheduledDate(latest?.scheduled_date || request.preferred_date_from || "");
    setStartTime(latest?.start_time?.slice(0, 5) || "");
    setDurationHours(
      latest?.expected_duration_minutes
        ? String((latest.expected_duration_minutes - priorAddOns.reduce((sum, item) => sum + item.quantity * item.unit_duration_minutes, 0)) / 60)
        : "",
    );
    setJobRequirements((latest?.requirements || request.customer_notes || "").replace(/\n\nSelected add-ons:[\s\S]*$/, ""));
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
    await fetchData();
  };

  const createQuote = async () => {
    if (!selected) return;
    const selectedAddOns = addOnCatalogue.filter((item) => (addOnQuantities[item.id] || 0) > 0);
    const addOnCustomerPence = selectedAddOns.reduce((sum, item) => sum + item.customer_price_pence * addOnQuantities[item.id], 0);
    const addOnCleanerPence = selectedAddOns.reduce((sum, item) => sum + item.cleaner_payout_pence * addOnQuantities[item.id], 0);
    const addOnMinutes = selectedAddOns.reduce((sum, item) => sum + item.duration_minutes * addOnQuantities[item.id], 0);
    const customerPence = Math.round(Number(customerPrice) * 100) + addOnCustomerPence;
    const cleanerPence = Math.round(Number(cleanerPayout) * 100) + addOnCleanerPence;
    if (!customerPence || cleanerPence < 0 || customerPence < cleanerPence) {
      return toast.error(
        "Enter a valid customer price and cleaner payout. The customer price must cover the payout.",
      );
    }
    if (!addressLine1.trim() || !city.trim() || !bookingPostcode.trim()) {
      return toast.error("Confirm the full customer address before sending the quote.");
    }
    if (!scheduledDate || !startTime || !Number(durationHours)) {
      return toast.error(
        "Confirm the job date, start time and expected duration before sending the quote.",
      );
    }
    if (!quoteValidUntil) {
      return toast.error("Choose when the quote expires.");
    }
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
    const nextVersion =
      Math.max(0, ...(selected.quotes || []).map((quote) => quote.version)) + 1;
    const { data: quote, error } = await db
      .from("quotes")
      .insert({
        service_request_id: selected.id,
        version: nextVersion,
        status: "draft",
        customer_amount_pence: customerPence,
        cleaner_payout_pence: cleanerPence,
        valid_until: new Date(`${quoteValidUntil}T23:59:59`).toISOString(),
        address_id: selected.address.id,
        scheduled_date: scheduledDate,
        start_time: startTime,
        expected_duration_minutes: Math.round(Number(durationHours) * 60) + addOnMinutes,
        requirements: [jobRequirements.trim(), selectedAddOns.length ? `Selected add-ons:\n${selectedAddOns.map((item) => `• ${item.name} × ${addOnQuantities[item.id]}`).join("\n")}` : ""].filter(Boolean).join("\n\n") || null,
      })
      .select("id")
      .single();
    if (error || !quote) {
      setSaving(false);
      return toast.error(error?.message || "The quote could not be created.");
    }
    if (selectedAddOns.length) {
      const { error: addOnError } = await db.from("quote_addons").insert(selectedAddOns.map((item) => ({
        quote_id: quote.id, addon_id: item.id, addon_code: item.code, addon_name: item.name, category: item.category,
        quantity: addOnQuantities[item.id], unit_customer_price_pence: item.customer_price_pence,
        unit_cleaner_payout_pence: item.cleaner_payout_pence, unit_duration_minutes: item.duration_minutes,
      })));
      if (addOnError) { setSaving(false); return toast.error(`The quote was created, but its add-ons could not be saved: ${addOnError.message}`); }
    }
    const { error: noteError } = await db
      .from("service_requests")
      .update({ admin_notes: adminNotes })
      .eq("id", selected.id);
    if (noteError) {
      setSaving(false);
      return toast.error(noteError.message);
    }
    const { error: sendError } = await supabase.functions.invoke(
      "send-agency-quote",
      { body: { quoteId: quote.id } },
    );
    setSaving(false);
    if (sendError) {
      toast.error(
        `The quote was saved but the email could not be completed: ${sendError.message}`,
      );
      await fetchData();
      return;
    }
    toast.success("Quote and secure payment link emailed to the customer");
    await fetchData();
  };

  const acceptAndCreateJob = async () => {
    if (!selected) return;
    const latest = [...(selected.quotes || [])]
      .filter((quote) => quote.status === "sent")
      .sort((a, b) => b.version - a.version)[0];
    if (!latest) return toast.error("Create and send a quote first.");
    if (!offlinePaymentReference.trim()) {
      return toast.error("Enter the bank or offline payment reference.");
    }
    setSaving(true);
    const { error: paymentError } = await db.rpc(
      "finalize_agency_quote_payment",
      {
        p_quote_id: latest.id,
        p_payment_reference: offlinePaymentReference.trim(),
        p_payment_intent_id: null,
        p_provider: "bank_transfer",
      },
    );
    setSaving(false);
    if (paymentError) return toast.error(paymentError.message);
    toast.success("Offline payment confirmed and job created");
    setOfflinePaymentReference("");
    await fetchData();
  };

  const loadDispatchCandidates = async (jobId: string) => {
    setLoadingCandidates(true);
    const { data, error } = await db.rpc("get_job_dispatch_candidates", {
      p_job_id: jobId,
    });
    setLoadingCandidates(false);
    if (error) {
      setDispatchCandidates([]);
      return toast.error(error.message);
    }
    setDispatchCandidates((data as DispatchCandidate[]) || []);
  };

  const assignCleaner = async (job: Job) => {
    const cleanerId = assignmentChoices[job.id];
    if (!cleanerId) return toast.error("Choose an approved active cleaner.");
    setSaving(true);
    const { error } = await db.rpc("dispatch_job_to_cleaner", {
      p_job_id: job.id,
      p_cleaner_id: cleanerId,
      p_reason: dispatchReason.trim() || null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Job offered to cleaner");
    setDispatchReason("");
    await fetchData();
    await loadDispatchCandidates(job.id);
  };

  const withdrawOffer = async (job: Job) => {
    if (dispatchReason.trim().length < 5) {
      return toast.error("Enter a brief reason before withdrawing or reassigning the offer.");
    }
    setSaving(true);
    const { error } = await db.rpc("withdraw_job_offer", {
      p_job_id: job.id,
      p_reason: dispatchReason.trim(),
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Cleaner offer withdrawn; job returned to unassigned");
    setDispatchReason("");
    await fetchData();
    await loadDispatchCandidates(job.id);
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
    setAssignmentChoices((current) => ({ ...current, [job.id]: current[job.id] || "" }));
    setDispatchReason("");
    void loadDispatchCandidates(job.id);
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
    // Keep the open job-control dialog in sync with the saved schedule. The
    // dispatch RPC reads the database, so reloading candidates here immediately
    // recalculates availability/conflicts for the new date and time.
    setSelectedJob((current) => current ? {
      ...current,
      scheduled_date: scheduledDate,
      start_time: startTime,
      expected_duration_minutes: Math.round(Number(durationHours) * 60),
      requirements: jobRequirements.trim() || null,
      general_location: bookingPostcode.trim().toUpperCase().split(" ")[0],
      address: {
        ...current.address,
        address_line_1: addressLine1.trim(),
        address_line_2: addressLine2.trim() || null,
        city: city.trim(),
        postcode: bookingPostcode.trim().toUpperCase(),
        access_notes: accessNotes.trim() || null,
      },
    } : current);
    await fetchData();
    await loadDispatchCandidates(selectedJob.id);
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
    await fetchData();
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
    const { data, error } = await db.rpc("admin_review_job_completion", {
      p_job_id: selectedJob.id,
      p_decision: decision,
      p_notes: qualityNotes.trim() || null,
    });
    setSaving(false);
    if (error || !data) return toast.error(error?.message || "Quality review could not be saved");
    toast.success(
      decision === "approved"
        ? "Completion approved and payout released for processing"
        : decision === "rework_required"
          ? "Job returned to cleaner for rework"
          : "Job placed on hold for investigation",
    );
    await fetchData();
    if (selectedJob) await openJob({ ...selectedJob, status: decision === "approved" ? "completed" : decision === "rework_required" ? "in_progress" : "issue" });
  };

  const requestStageOverride = (job: Job, target: string) => {
    if (job.status === target || (target === "completed" && ["completed", "closed"].includes(job.status))) return;
    setStageOverride({ job, target });
    setStageReason("");
  };

  const confirmStageOverride = async () => {
    if (!stageOverride) return;
    if (stageReason.trim().length < 5) return toast.error("Enter an audit reason of at least 5 characters.");
    setSaving(true);
    const { data, error } = await db.rpc("admin_override_job_stage", {
      p_job_id: stageOverride.job.id,
      p_target_status: stageOverride.target,
      p_reason: stageReason.trim(),
    });
    setSaving(false);
    if (error || !data) return toast.error(error?.message || "Job stage could not be changed.");
    toast.success("Job stage updated and recorded in its history.");
    setStageOverride(null);
    setStageReason("");
    await fetchData();
  };

  const requestRequestStageOverride = (request: ManagedRequest, target: string) => {
    if (request.status === target || (target === "lost" && ["declined","lost","cancelled"].includes(request.status))) return;
    setRequestMove({ request, target });
    setRequestStageReason("");
  };

  const confirmRequestStageOverride = async () => {
    if (!requestMove) return;
    if (requestStageReason.trim().length < 5) return toast.error("Enter an audit reason of at least 5 characters.");
    setSaving(true);
    const { data, error } = await db.rpc("admin_override_service_request_stage", {
      p_request_id: requestMove.request.id,
      p_target_status: requestMove.target,
      p_reason: requestStageReason.trim(),
    });
    setSaving(false);
    if (error || !data) return toast.error(error?.message || "Request stage could not be changed.");
    toast.success("Cleaning request stage updated and audited.");
    setRequestMove(null);
    setRequestStageReason("");
    await fetchData();
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
  const selectedBookingJob = selected
    ? jobs.find((job) => job.service_request_id === selected.id) || null
    : null;
  const selectedBookingPayment = selectedBookingJob
    ? customerPayments.find(
        (payment) =>
          payment.job_id === selectedBookingJob.id && payment.status === "paid",
      ) || null
    : null;
  const latestSelectedQuote = selected
    ? [...(selected.quotes || [])].sort((a, b) => b.version - a.version)[0] || null
    : null;
  const awaitingOnlinePayment =
    !selectedBookingJob && latestSelectedQuote?.status === "sent";
  const chosenAddOns = addOnCatalogue.filter((item) => (addOnQuantities[item.id] || 0) > 0);
  const addOnCustomerTotal = chosenAddOns.reduce((sum, item) => sum + item.customer_price_pence * addOnQuantities[item.id], 0);
  const addOnCleanerTotal = chosenAddOns.reduce((sum, item) => sum + item.cleaner_payout_pence * addOnQuantities[item.id], 0);
  const addOnDurationTotal = chosenAddOns.reduce((sum, item) => sum + item.duration_minutes * addOnQuantities[item.id], 0);
  const baseDurationMinutes = Number(durationHours) > 0 ? Math.round(Number(durationHours) * 60) : 0;
  const totalDurationMinutes = baseDurationMinutes + addOnDurationTotal;
  const quoteCustomerTotal = Math.round(Number(customerPrice || 0) * 100) + addOnCustomerTotal;
  const quoteCleanerTotal = Math.round(Number(cleanerPayout || 0) * 100) + addOnCleanerTotal;
  const groupedAddOns = addOnCatalogue.reduce<Record<string, ServiceAddOn[]>>((groups, item) => { (groups[item.category] ||= []).push(item); return groups; }, {});

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
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              {requestView === "list" ? <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-56"><SelectValue /></SelectTrigger>
                <SelectContent>{["active","all","new","contacted","qualified","quoted","accepted","declined","lost","cancelled"].map((status) => <SelectItem key={status} value={status}>{status.replace(/_/g," ")}</SelectItem>)}</SelectContent>
              </Select> : <p className="text-sm text-muted-foreground">Drag cards to valid stages. Booked requires quote acceptance and job creation.</p>}
              <div className="flex rounded-lg border bg-card p-1"><Button size="sm" variant={requestView === "list" ? "secondary" : "ghost"} onClick={() => setRequestView("list")}><List className="mr-2 h-4 w-4" />List</Button><Button size="sm" variant={requestView === "kanban" ? "secondary" : "ghost"} onClick={() => setRequestView("kanban")}><Columns3 className="mr-2 h-4 w-4" />Kanban</Button></div>
            </div>
            {loading ? (
              <Loader2 className="h-7 w-7 animate-spin" />
            ) : requestView === "list" ? (
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
            ) : <div className="overflow-x-auto pb-3"><div className="grid min-w-[1440px] grid-cols-6 gap-3">{REQUEST_KANBAN_COLUMNS.map((column) => { const columnRequests=requests.filter((request)=>(column.statuses as readonly string[]).includes(request.status)); return <section key={column.title} onDragOver={(event)=>event.preventDefault()} onDrop={()=>{const request=requests.find((item)=>item.id===draggedRequestId);if(request)requestRequestStageOverride(request,column.target);setDraggedRequestId(null);}} className="min-h-[420px] rounded-xl border bg-muted/30"><div className="flex items-center justify-between border-b px-3 py-3"><h3 className="font-semibold">{column.title}</h3><Badge variant="outline">{columnRequests.length}</Badge></div><div className="space-y-3 p-3">{columnRequests.map((request)=><button key={request.id} type="button" draggable onDragStart={()=>setDraggedRequestId(request.id)} onDragEnd={()=>setDraggedRequestId(null)} onClick={()=>openRequest(request)} className="w-full cursor-grab rounded-lg border bg-card p-3 text-left shadow-sm transition hover:border-secondary active:cursor-grabbing"><div className="flex items-start justify-between gap-2"><strong className="text-sm">{request.reference}</strong><Badge className={requestStatusClasses[request.status]}>{request.status}</Badge></div><p className="mt-2 text-sm font-medium">{request.customer.name}</p><p className="mt-1 text-xs text-muted-foreground">{request.address.postcode} · {request.service_type.name}</p><p className="mt-2 text-xs">Preferred {request.preferred_date_from || "date not supplied"}</p></button>)}{columnRequests.length===0&&<p className="p-3 text-center text-xs text-muted-foreground">No requests</p>}</div></section>;})}</div></div>}
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
                <Button
                  size="sm"
                  variant={jobView === "kanban" ? "secondary" : "ghost"}
                  onClick={() => setJobView("kanban")}
                >
                  <Columns3 className="mr-2 h-4 w-4" /> Kanban
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
            {jobView === "kanban" && (
              <div className="overflow-x-auto pb-3">
                <div className="grid min-w-[1680px] grid-cols-7 gap-3">
                  {KANBAN_COLUMNS.map((column) => {
                    const columnJobs = visibleJobs.filter((job) => (column.statuses as readonly string[]).includes(job.status));
                    return <section
                      key={column.title}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={() => {
                        const job = jobs.find((item) => item.id === draggedJobId);
                        if (job) requestStageOverride(job, column.target);
                        setDraggedJobId(null);
                      }}
                      className="min-h-[420px] rounded-xl border bg-muted/30"
                    >
                      <div className="flex items-center justify-between border-b px-3 py-3">
                        <h3 className="font-semibold">{column.title}</h3>
                        <Badge variant="outline">{columnJobs.length}</Badge>
                      </div>
                      <div className="space-y-3 p-3">
                        {columnJobs.map((job) => {
                          const assignment = job.assignments?.find((item) => ["offered", "accepted", "completed"].includes(item.status));
                          return <button
                            key={job.id}
                            type="button"
                            draggable
                            onDragStart={() => setDraggedJobId(job.id)}
                            onDragEnd={() => setDraggedJobId(null)}
                            onClick={() => openJob(job)}
                            className="w-full cursor-grab rounded-lg border bg-card p-3 text-left shadow-sm transition hover:border-secondary active:cursor-grabbing"
                          >
                            <div className="flex items-start justify-between gap-2"><strong className="text-sm">{job.reference}</strong><Badge variant="outline" className="text-[10px]">{job.status.replace(/_/g," ")}</Badge></div>
                            <p className="mt-2 text-sm font-medium">{job.customer.name}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{job.address.postcode} · {format(new Date(`${job.scheduled_date}T12:00:00`),"dd MMM")} {job.start_time?.slice(0,5) || "TBC"}</p>
                            <p className="mt-2 truncate text-xs">{assignment?.cleaner?.full_name || "No cleaner assigned"}</p>
                            <p className="mt-2 text-xs font-medium">Cleaner {money(job.cleaner_payout_pence)}</p>
                          </button>;
                        })}
                        {columnJobs.length === 0 && <p className="p-3 text-center text-xs text-muted-foreground">No jobs</p>}
                      </div>
                    </section>;
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
                    <Label>Base cleaning duration (hours)</Label>
                    <Input
                      type="number"
                      min="0.5"
                      step="0.5"
                      value={durationHours}
                      onChange={(event) => setDurationHours(event.target.value)}
                    />
                    <p className="mt-1 text-xs text-muted-foreground">Enter the time for the main clean. Selected add-on time is added automatically.</p>
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
              {selectedBookingJob && (
                <div className="space-y-4 rounded-xl border border-emerald-300 bg-emerald-50 p-5 text-emerald-950">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 font-semibold">
                        <CheckCircle2 className="h-5 w-5" />
                        Booking confirmed
                      </div>
                      <p className="mt-1 text-sm">
                        This request has already been converted into a job. Quote and payment actions are locked.
                      </p>
                    </div>
                    <Badge className="bg-emerald-700 text-white">accepted</Badge>
                  </div>
                  <div className="grid gap-3 text-sm sm:grid-cols-2">
                    <div>
                      <p className="text-emerald-800">Job reference</p>
                      <p className="font-semibold">{selectedBookingJob.reference}</p>
                    </div>
                    <div>
                      <p className="text-emerald-800">Job status</p>
                      <p className="font-semibold">
                        {selectedBookingJob.status.replace(/_/g, " ")}
                      </p>
                    </div>
                    <div>
                      <p className="text-emerald-800">Customer payment</p>
                      <p className="font-semibold">
                        {selectedBookingPayment
                          ? `${money(selectedBookingPayment.amount_pence)} paid via ${selectedBookingPayment.provider || "recorded payment"}`
                          : "Job created — payment record loading"}
                      </p>
                    </div>
                    <div>
                      <p className="text-emerald-800">Payment details</p>
                      <p className="font-semibold">
                        {selectedBookingPayment?.paid_at
                          ? new Date(selectedBookingPayment.paid_at).toLocaleString("en-GB")
                          : "Confirmed"}
                        {selectedBookingPayment?.provider_reference
                          ? ` · ••••${selectedBookingPayment.provider_reference.slice(-4)}`
                          : ""}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => openJob(selectedBookingJob)}
                    className="border-emerald-700 bg-white text-emerald-900 hover:bg-emerald-100"
                  >
                    View job
                  </Button>
                </div>
              )}
              {!selectedBookingJob && (
              <div className="space-y-3 border-t pt-5">
                <h3 className="font-semibold">Quote economics</h3>
                {awaitingOnlinePayment && (
                  <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
                    <p className="font-semibold">Awaiting customer payment</p>
                    <p>
                      The secure Stripe payment link has been sent. A job will be created automatically when Stripe confirms payment.
                    </p>
                  </div>
                )}
                <div className="overflow-hidden rounded-xl border">
                  <button type="button" onClick={() => setShowAddOns((value) => !value)} className="flex w-full items-center justify-between gap-4 bg-muted/30 px-4 py-3 text-left hover:bg-muted/50">
                    <div className="flex items-center gap-3"><span className="rounded-lg bg-emerald-100 p-2 text-emerald-700"><Sparkles className="h-4 w-4" /></span><div><p className="font-semibold">Service add-ons</p><p className="text-xs text-muted-foreground">Ask about relevant extras during the customer call</p></div></div>
                    <div className="flex items-center gap-3">{chosenAddOns.length > 0 && <Badge className="bg-emerald-700 text-white">{chosenAddOns.reduce((sum, item) => sum + addOnQuantities[item.id], 0)} selected</Badge>}<ChevronRight className={`h-4 w-4 transition-transform ${showAddOns ? "rotate-90" : ""}`} /></div>
                  </button>
                  {showAddOns && <div className="space-y-5 border-t p-4">
                    <p className="rounded-lg bg-blue-50 p-3 text-sm text-blue-950">Add only what the customer has agreed to. Prices, cleaner pay and time update automatically.</p>
                    {Object.entries(groupedAddOns).map(([category, items]) => <div key={category}><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{category === "home" ? "Home & furnishings" : category}</p><div className="grid gap-2 lg:grid-cols-2">{items.map((item) => {
                      const quantity = addOnQuantities[item.id] || 0;
                      return <div key={item.id} className={`rounded-lg border p-3 transition ${quantity ? "border-emerald-300 bg-emerald-50/60" : "bg-card"}`}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="font-medium">{item.name}</p><p className="mt-0.5 text-xs text-muted-foreground">{item.description}</p><p className="mt-2 text-xs font-medium">+{money(item.customer_price_pence)} customer · +{money(item.cleaner_payout_pence)} cleaner · +{item.duration_minutes} min</p></div><div className="flex shrink-0 items-center gap-1 rounded-lg border bg-background p-1"><Button type="button" variant="ghost" size="icon" className="h-7 w-7" disabled={!quantity} onClick={() => setAddOnQuantities((current) => ({ ...current, [item.id]: Math.max(0, quantity - 1) }))}><Minus className="h-3.5 w-3.5" /></Button><span className="w-6 text-center text-sm font-semibold">{quantity}</span><Button type="button" variant="ghost" size="icon" className="h-7 w-7" disabled={quantity >= item.max_quantity} onClick={() => setAddOnQuantities((current) => ({ ...current, [item.id]: Math.min(item.max_quantity, quantity + 1) }))}><Plus className="h-3.5 w-3.5" /></Button></div></div>{item.max_quantity > 1 && <p className="mt-2 text-xs text-muted-foreground">Charged per {item.unit_label}</p>}</div>;
                    })}</div></div>)}
                  </div>}
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <Label>Base customer price (£)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={customerPrice}
                      onChange={(event) => setCustomerPrice(event.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Base cleaner payout (£)</Label>
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
                {(customerPrice || cleanerPayout || chosenAddOns.length > 0) && <div className="rounded-xl border bg-muted/20 p-4"><div className="grid gap-3 text-sm sm:grid-cols-4"><div><p className="text-muted-foreground">Customer total</p><p className="text-lg font-semibold">{money(quoteCustomerTotal)}</p></div><div><p className="text-muted-foreground">Cleaner total</p><p className="text-lg font-semibold">{money(quoteCleanerTotal)}</p></div><div><p className="text-muted-foreground">Gross margin</p><p className="text-lg font-semibold text-emerald-700">{money(quoteCustomerTotal - quoteCleanerTotal)}</p></div><div><p className="text-muted-foreground">Total job duration</p><p className="text-lg font-semibold">{baseDurationMinutes > 0 ? `${totalDurationMinutes} min` : "Enter base duration"}</p>{baseDurationMinutes > 0 && <p className="text-xs text-muted-foreground">Main clean {baseDurationMinutes} min{addOnDurationTotal > 0 ? ` + add-ons ${addOnDurationTotal} min` : ""}</p>}</div></div>{chosenAddOns.length > 0 && <div className="mt-3 border-t pt-3 text-xs text-muted-foreground">Base clean plus {chosenAddOns.map((item) => `${item.name} × ${addOnQuantities[item.id]}`).join(", ")}</div>}</div>}
                <div className="flex flex-wrap gap-2">
                  <Button onClick={createQuote} disabled={saving}>
                    {saving && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Send quote & payment link
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={acceptAndCreateJob}
                    disabled={saving}
                  >
                    Confirm offline payment &amp; create job
                  </Button>
                </div>
                <div className="max-w-md">
                  <Label>Offline payment reference</Label>
                  <Input
                    value={offlinePaymentReference}
                    onChange={(event) =>
                      setOfflinePaymentReference(event.target.value)
                    }
                    placeholder="Bank transfer or card-terminal reference"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Online bookings create a job automatically only after Stripe
                  confirms payment. Use the offline option only when Cleanda has
                  received the money outside Stripe. Its payment and job are
                  recorded together.
                </p>
              </div>
              )}
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
              {['awaiting_assignment', 'offered'].includes(selectedJob.status) && (
                <div className="space-y-4 border-t pt-5">
                  <div>
                    <h3 className="font-semibold">Cleaner assignment &amp; dispatch</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Only approved, verified and active cleaners are shown. Availability and schedule conflicts are enforced again when the offer is sent.
                    </p>
                  </div>
                  {loadingCandidates ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Checking cleaner availability…</div>
                  ) : dispatchCandidates.length === 0 ? (
                    <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">No approved active cleaners are currently available for dispatch.</p>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {dispatchCandidates.map((candidate) => {
                        const selectable = candidate.available && !candidate.has_conflict;
                        const selectedCandidate = assignmentChoices[selectedJob.id] === candidate.cleaner_id;
                        return (
                          <button
                            key={candidate.cleaner_id}
                            type="button"
                            disabled={!selectable}
                            onClick={() => setAssignmentChoices((current) => ({ ...current, [selectedJob.id]: candidate.cleaner_id }))}
                            className={`rounded-xl border p-4 text-left transition ${selectedCandidate ? 'border-secondary ring-2 ring-secondary/20' : 'bg-card'} ${selectable ? 'hover:border-secondary' : 'cursor-not-allowed opacity-60'}`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div><p className="font-medium">{candidate.full_name || 'Unnamed cleaner'}</p><p className="text-xs text-muted-foreground">{candidate.postcode || 'No postcode'} · {candidate.has_transport ? 'Has transport' : 'Transport not recorded'}</p></div>
                              <Badge className={selectable ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}>{selectable ? 'Available' : candidate.has_conflict ? 'Conflict' : 'Outside availability'}</Badge>
                            </div>
                            <p className="mt-3 text-xs">Active workload: {candidate.active_job_count} job{candidate.active_job_count === 1 ? '' : 's'}</p>
                            <p className="mt-1 text-xs text-muted-foreground">Areas: {candidate.service_areas.length ? candidate.service_areas.join(', ') : 'No service areas recorded'}</p>
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <div>
                    <Label>Dispatch / reassignment note</Label>
                    <Textarea value={dispatchReason} onChange={(event) => setDispatchReason(event.target.value)} placeholder="Optional for a new offer; required when withdrawing or reassigning." />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={() => assignCleaner(selectedJob)} disabled={saving || !assignmentChoices[selectedJob.id]}>
                      {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {selectedJob.status === 'offered' ? 'Reassign offer' : 'Offer job to cleaner'}
                    </Button>
                    {selectedJob.status === 'offered' && <Button variant="outline" onClick={() => withdrawOffer(selectedJob)} disabled={saving}>Withdraw current offer</Button>}
                  </div>
                  <p className="text-xs text-muted-foreground">The job moves to Offered immediately. When the cleaner accepts, it moves automatically to Assigned and the full address and access instructions become visible to them.</p>
                </div>
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
      <Dialog open={!!stageOverride} onOpenChange={(open) => { if (!open) { setStageOverride(null); setStageReason(""); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Confirm pipeline override</DialogTitle></DialogHeader>
          {stageOverride && <div className="space-y-4">
            <div className="rounded-lg border bg-muted/40 p-4 text-sm">
              <p className="font-medium">{stageOverride.job.reference} · {stageOverride.job.customer.name}</p>
              <p className="mt-1 text-muted-foreground">{stageOverride.job.status.replace(/_/g," ")} → {stageOverride.target.replace(/_/g," ")}</p>
            </div>
            {stageOverride.target === "completed" && <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">Jobs can only enter Completed through the quality-approval controls inside the job.</p>}
            <div><Label htmlFor="stage-reason">Audit reason</Label><Textarea id="stage-reason" value={stageReason} onChange={(event) => setStageReason(event.target.value)} placeholder="Why is this manual stage change required?" /></div>
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setStageOverride(null)}>Cancel</Button><Button onClick={confirmStageOverride} disabled={saving || stageOverride.target === "completed"}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Confirm change</Button></div>
          </div>}
        </DialogContent>
      </Dialog>
      <Dialog open={!!requestMove} onOpenChange={(open) => { if (!open) { setRequestMove(null); setRequestStageReason(""); } }}>
        <DialogContent className="max-w-lg"><DialogHeader><DialogTitle>Confirm request pipeline override</DialogTitle></DialogHeader>{requestMove && <div className="space-y-4"><div className="rounded-lg border bg-muted/40 p-4 text-sm"><p className="font-medium">{requestMove.request.reference} · {requestMove.request.customer.name}</p><p className="mt-1 text-muted-foreground">{requestMove.request.status.replace(/_/g," ")} → {requestMove.target.replace(/_/g," ")}</p></div>{requestMove.target === "accepted" && <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">A request can only become Booked after quote acceptance and job creation.</p>}<div><Label htmlFor="request-stage-reason">Audit reason</Label><Textarea id="request-stage-reason" value={requestStageReason} onChange={(event)=>setRequestStageReason(event.target.value)} placeholder="Why is this manual stage change required?" /></div><div className="flex justify-end gap-2"><Button variant="outline" onClick={()=>setRequestMove(null)}>Cancel</Button><Button onClick={confirmRequestStageOverride} disabled={saving || requestMove.target === "accepted"}>{saving&&<Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Confirm change</Button></div></div>}</DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
