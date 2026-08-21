import { useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, Loader2, TriangleAlert } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { SEOHead } from "@/components/SEOHead";
import { supabase } from "@/integrations/supabase/client";

type ConfirmationState = "checking" | "confirmed" | "error";

export default function BookingConfirmed() {
  const [searchParams] = useSearchParams();
  const [state, setState] = useState<ConfirmationState>("checking");
  const [reference, setReference] = useState("");

  useEffect(() => {
    const sessionId = searchParams.get("session_id");
    if (!sessionId) {
      setState("error");
      return;
    }

    let active = true;
    supabase.functions
      .invoke("confirm-agency-payment", { body: { sessionId } })
      .then(({ data, error }) => {
        if (!active) return;
        if (error || !data?.confirmed) {
          setState("error");
          return;
        }
        setReference(data.jobReference || "");
        setState("confirmed");
      });

    return () => {
      active = false;
    };
  }, [searchParams]);

  return (
    <>
      <SEOHead
        title="Booking Confirmed | Cleanda"
        description="Your payment has been received and your Cleanda cleaning booking is confirmed."
        canonical="https://cleanda.co.uk/booking-confirmed"
        noIndex
      />
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-4">
        <section className="w-full max-w-lg rounded-3xl border bg-white p-8 text-center shadow-xl">
          {state === "checking" && (
            <>
              <Loader2 className="mx-auto h-16 w-16 animate-spin text-emerald-600" />
              <h1 className="mt-6 text-3xl font-bold">Confirming your payment</h1>
              <p className="mt-3 text-muted-foreground">
                Please keep this page open while Cleanda secures your booking.
              </p>
            </>
          )}

          {state === "confirmed" && (
            <>
              <CheckCircle2 className="mx-auto h-20 w-20 text-emerald-600" />
              <h1 className="mt-6 text-4xl font-bold">Booking confirmed</h1>
              <p className="mt-3 text-lg text-muted-foreground">
                Payment received. Cleanda has secured your cleaning booking and
                will arrange your vetted cleaner.
              </p>
              {reference && (
                <div className="mt-6 rounded-xl bg-emerald-50 p-4">
                  <p className="text-sm text-muted-foreground">Job reference</p>
                  <p className="font-semibold">{reference}</p>
                </div>
              )}
              <p className="mt-5 text-sm text-muted-foreground">
                We will contact you if we need any further access or scheduling
                information.
              </p>
            </>
          )}

          {state === "error" && (
            <>
              <TriangleAlert className="mx-auto h-16 w-16 text-amber-500" />
              <h1 className="mt-6 text-3xl font-bold">Payment received for review</h1>
              <p className="mt-3 text-muted-foreground">
                We could not finish confirming the booking on this page. Please
                do not pay again. Cleanda will reconcile your payment and contact
                you if anything else is needed.
              </p>
            </>
          )}

          {state !== "checking" && (
            <Button asChild className="mt-8">
              <Link to="/">
                Back to Cleanda <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          )}
        </section>
      </main>
    </>
  );
}
