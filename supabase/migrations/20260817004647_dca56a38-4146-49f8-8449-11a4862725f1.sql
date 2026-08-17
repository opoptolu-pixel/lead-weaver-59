REVOKE ALL ON public.service_addons FROM anon;
REVOKE ALL ON public.quote_addons FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_addons TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quote_addons TO authenticated;
GRANT ALL ON public.service_addons TO service_role;
GRANT ALL ON public.quote_addons TO service_role;