-- Complete the common Cleanda visual system on the quote template while
-- preserving the green card and CTA layout already validated in production.
UPDATE public.email_templates
SET
  body = '<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#102235"><div style="border-bottom:4px solid #16a765;padding:0 0 18px;margin-bottom:28px"><strong style="font-size:24px">Cleanda</strong></div><h1 style="font-size:34px;line-height:1.2;margin:0 0 28px">Your Cleanda quote</h1><p style="font-size:18px;line-height:1.6">Hello {{customer_name}},</p><p style="font-size:18px;line-height:1.6">We have confirmed your requirements for <strong>{{service_name}}</strong>.</p><div style="padding:20px;background:#f4faf7;border-radius:12px;margin:24px 0"><p style="font-size:17px;line-height:1.6"><strong>Price:</strong> {{customer_price}}</p><p style="font-size:17px;line-height:1.6"><strong>Date:</strong> {{scheduled_date}} at {{start_time}}</p><p style="font-size:17px;line-height:1.6"><strong>Reference:</strong> {{request_reference}}</p></div><p style="font-size:17px;line-height:1.6">Your booking is confirmed only after payment.</p><p><a href="{{payment_url}}" style="display:inline-block;background:#16a765;color:white;padding:14px 24px;border-radius:8px;text-decoration:none;font-size:17px;font-weight:bold">Accept and pay securely</a></p><p style="font-size:15px;line-height:1.6;color:#526173">This secure payment link expires in 24 hours.</p></div>',
  updated_at = now()
WHERE name = 'agency_quote_payment_link';

INSERT INTO public.platform_schema_versions(version, description)
VALUES ('20260816313200', 'Aligned agency quote with common Cleanda email header')
ON CONFLICT (version) DO UPDATE SET description = excluded.description;

NOTIFY pgrst, 'reload schema';