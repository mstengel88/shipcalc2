CREATE TABLE public.origin_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL DEFAULT 'Default',
  address text NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.origin_addresses ENABLE ROW LEVEL SECURITY;

-- Public read for active address (edge functions need this)
CREATE POLICY "Anyone can read active origin" ON public.origin_addresses
  FOR SELECT USING (true);

-- No public insert/update/delete - managed via service role from edge function
-- Insert default origin
INSERT INTO public.origin_addresses (label, address, is_active)
VALUES ('Menomonee Falls', 'W185 N7487, Narrow Ln, Menomonee Falls, WI 53051', true);