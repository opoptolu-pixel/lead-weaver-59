-- Customer-resolution audit trail for an operational cleaner no-show.
-- This migration does not alter existing bookings or payments.

ALTER TABLE public.customer_payments
  ADD COLUMN IF NOT EXISTS refund_status text NOT NULL DEFAULT 'not_requested'
    CHECK (refund_status IN ('not_requested','manual_due','processing','refunded','failed')),
  ADD COLUMN IF NOT EXISTS refund_amount_pence integer NOT NULL DEFAULT 0 CHECK (refund_amount_pence >= 0),
  ADD COLUMN IF NOT EXISTS refund_reference text,
  ADD COLUMN IF NOT EXISTS refund_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS refunded_at timestamptz;

CREATE INDEX IF NOT EXISTS customer_payments_refund_status_idx
  ON public.customer_payments(refund_status)
  WHERE refund_status <> 'not_requested';

-- Used after a bank transfer, cash or terminal refund has actually been sent.
-- Stripe refunds are completed directly by the no-show resolution function.
CREATE OR REPLACE FUNCTION public.record_manual_customer_refund(
  p_payment_id uuid,
  p_reference text,
  p_refunded_at timestamptz DEFAULT now()
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment public.customer_payments%ROWTYPE;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  IF length(trim(coalesce(p_reference, ''))) < 3 THEN
    RAISE EXCEPTION 'Enter the bank, cash or terminal refund reference';
  END IF;

  SELECT * INTO v_payment
  FROM public.customer_payments
  WHERE id = p_payment_id
  FOR UPDATE;

  IF v_payment.id IS NULL THEN
    RAISE EXCEPTION 'Customer payment not found';
  END IF;
  IF v_payment.status <> 'paid' OR v_payment.refund_status <> 'manual_due' THEN
    RAISE EXCEPTION 'This payment is not awaiting a manual refund';
  END IF;

  UPDATE public.customer_payments
  SET status = 'refunded',
      refund_status = 'refunded',
      refund_reference = trim(p_reference),
      refunded_at = coalesce(p_refunded_at, now()),
      updated_at = now()
  WHERE id = v_payment.id;

  INSERT INTO public.job_events(job_id, actor_user_id, event_type, details)
  VALUES (
    v_payment.job_id,
    auth.uid(),
    'manual_customer_refund_completed',
    jsonb_build_object(
      'payment_id', v_payment.id,
      'refund_amount_pence', v_payment.refund_amount_pence,
      'refund_reference', trim(p_reference)
    )
  );

  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.record_manual_customer_refund(uuid, text, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_manual_customer_refund(uuid, text, timestamptz) TO authenticated;

INSERT INTO public.email_templates(name,subject,body,description,variables,is_active) VALUES
  ('agency_no_show_cover_update','An update on your Cleanda booking — {{job_reference}}',
   '<h1>We are arranging cover</h1><p>Hello {{customer_name}},</p><p>We are sorry: the cleaner assigned to your {{service_name}} was unable to attend.</p><p>Our team is actively arranging a replacement. Your booking and payment remain protected, and we will update you as soon as we have confirmed cover.</p><p><strong>Booking:</strong> {{scheduled_date}} at {{start_time}}<br><strong>Reference:</strong> {{job_reference}}</p><p>If you need to discuss your booking, reply to this email or contact Cleanda.</p>',
   'Customer update when Cleanda is sourcing replacement cover after a cleaner no-show',
   ARRAY['customer_name','service_name','scheduled_date','start_time','job_reference'],true),
  ('agency_no_show_rescheduled','Your Cleanda booking has been rescheduled — {{job_reference}}',
   '<h1>Your booking has been rescheduled</h1><p>Hello {{customer_name}},</p><p>We are sorry for the disruption. We have moved your {{service_name}} booking while we arrange the right cleaner.</p><p><strong>New date:</strong> {{scheduled_date}} at {{start_time}}<br><strong>Duration:</strong> {{duration}}<br><strong>Reference:</strong> {{job_reference}}</p><p>Your payment remains secure with Cleanda. Please reply to this email if the new time does not work for you.</p>',
   'Customer reschedule confirmation after a cleaner no-show',
   ARRAY['customer_name','service_name','scheduled_date','start_time','duration','job_reference'],true),
  ('agency_no_show_refund','Your Cleanda refund update — {{job_reference}}',
   '<h1>Your booking has been cancelled</h1><p>Hello {{customer_name}},</p><p>We are sorry that we could not complete your {{service_name}} booking.</p><p><strong>Refund:</strong> {{refund_amount}}<br>{{refund_timing}}<br><strong>Reference:</strong> {{job_reference}}</p><p>Please reply to this email if you need any further help.</p>',
   'Customer cancellation and refund outcome after a cleaner no-show',
   ARRAY['customer_name','service_name','refund_amount','refund_timing','job_reference'],true)
ON CONFLICT(name) DO UPDATE SET
  description = excluded.description,
  variables = excluded.variables;

INSERT INTO public.platform_schema_versions(version,description)
VALUES ('20260819090000','No-show customer resolution and refund audit fields')
ON CONFLICT(version) DO UPDATE SET description=excluded.description;

NOTIFY pgrst, 'reload schema';
