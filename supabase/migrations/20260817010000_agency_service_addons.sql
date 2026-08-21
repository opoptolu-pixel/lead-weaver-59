-- Structured agency add-ons. Catalogue prices can change without altering the
-- price snapshot stored against a quote already sent to a customer.

CREATE TABLE IF NOT EXISTS public.service_addons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  category text NOT NULL CHECK (category IN ('kitchen', 'windows', 'bathroom', 'home', 'premium')),
  description text,
  customer_price_pence integer NOT NULL CHECK (customer_price_pence >= 0),
  cleaner_payout_pence integer NOT NULL CHECK (cleaner_payout_pence >= 0),
  duration_minutes integer NOT NULL DEFAULT 0 CHECK (duration_minutes >= 0),
  unit_label text NOT NULL DEFAULT 'item',
  max_quantity integer NOT NULL DEFAULT 1 CHECK (max_quantity BETWEEN 1 AND 50),
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (customer_price_pence >= cleaner_payout_pence)
);

CREATE TABLE IF NOT EXISTS public.quote_addons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  addon_id uuid REFERENCES public.service_addons(id),
  addon_code text NOT NULL,
  addon_name text NOT NULL,
  category text NOT NULL,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_customer_price_pence integer NOT NULL CHECK (unit_customer_price_pence >= 0),
  unit_cleaner_payout_pence integer NOT NULL CHECK (unit_cleaner_payout_pence >= 0),
  unit_duration_minutes integer NOT NULL DEFAULT 0 CHECK (unit_duration_minutes >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (quote_id, addon_id),
  CHECK (unit_customer_price_pence >= unit_cleaner_payout_pence)
);

CREATE INDEX IF NOT EXISTS quote_addons_quote_id_idx ON public.quote_addons(quote_id);

ALTER TABLE public.service_addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_addons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage service add-ons" ON public.service_addons;
CREATE POLICY "Admins manage service add-ons" ON public.service_addons
FOR ALL TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins manage quote add-ons" ON public.quote_addons;
CREATE POLICY "Admins manage quote add-ons" ON public.quote_addons
FOR ALL TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Assigned cleaners view job add-ons" ON public.quote_addons;
CREATE POLICY "Assigned cleaners view job add-ons" ON public.quote_addons
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1
  FROM public.jobs j
  JOIN public.job_assignments ja ON ja.job_id = j.id
  JOIN public.cleaner_profiles cp ON cp.id = ja.cleaner_id
  WHERE j.accepted_quote_id = quote_addons.quote_id
    AND cp.user_id = auth.uid()
    AND ja.status IN ('offered', 'accepted', 'completed')
));

INSERT INTO public.service_addons
  (code, name, category, description, customer_price_pence, cleaner_payout_pence, duration_minutes, unit_label, max_quantity, display_order)
VALUES
  ('single_oven', 'Single oven clean', 'kitchen', 'Interior oven, racks and accessible glass', 4500, 2500, 60, 'oven', 3, 10),
  ('double_oven', 'Double oven clean', 'kitchen', 'Both oven cavities, racks and accessible glass', 6500, 3800, 90, 'oven', 2, 20),
  ('fridge_freezer', 'Fridge / freezer interior', 'kitchen', 'Empty appliance interior, shelves and drawers', 2500, 1500, 35, 'appliance', 2, 30),
  ('inside_cupboards', 'Inside kitchen cupboards', 'kitchen', 'Empty cupboard interiors and shelves', 3500, 2200, 60, 'kitchen', 1, 40),
  ('interior_windows', 'Interior window cleaning', 'windows', 'Glass, accessible frames and sills', 500, 300, 10, 'window', 30, 50),
  ('carpet_room', 'Carpet cleaning', 'home', 'Machine clean for one standard room', 3500, 2200, 45, 'room', 10, 60),
  ('upholstery_seat', 'Upholstery cleaning', 'home', 'Machine clean per sofa or chair seat', 1800, 1100, 20, 'seat', 12, 70),
  ('bathroom_restoration', 'Limescale and grout deep clean', 'bathroom', 'Detailed bathroom descaling and grout attention', 3000, 1800, 45, 'bathroom', 5, 80),
  ('inside_wardrobe', 'Inside wardrobes', 'home', 'Empty wardrobe interiors, shelves and rails', 1500, 900, 20, 'wardrobe', 10, 90),
  ('linen_change', 'Bed linen change', 'premium', 'Remove used linen and remake with customer-provided linen', 1000, 700, 15, 'bed', 10, 100)
ON CONFLICT (code) DO NOTHING;

-- Add an itemised add-on block to the editable quote email without replacing
-- any other customisations the team may already have made.
UPDATE public.email_templates
SET body = replace(
      body,
      '<p style="font-size:17px;line-height:1.6">Your booking is confirmed only after payment.</p>',
      '{{addons_summary}}<p style="font-size:17px;line-height:1.6">Your booking is confirmed only after payment.</p>'
    ),
    variables = CASE WHEN NOT ('addons_summary' = ANY(variables)) THEN array_append(variables, 'addons_summary') ELSE variables END,
    updated_at = now()
WHERE name = 'agency_quote_payment_link'
  AND body NOT LIKE '%{{addons_summary}}%';

INSERT INTO public.platform_schema_versions(version, description)
VALUES ('20260817010000', 'Structured managed-agency service add-ons and quote price snapshots')
ON CONFLICT (version) DO NOTHING;
