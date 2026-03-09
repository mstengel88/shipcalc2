
CREATE TABLE public.app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read settings"
ON public.app_settings FOR SELECT
TO anon, authenticated
USING (true);

INSERT INTO public.app_settings (key, value, label, description) VALUES
  ('rate_per_minute', '2.08', 'Rate Per Minute', 'Dollar rate charged per minute of round-trip drive time'),
  ('max_qty_per_truck', '22', 'Max Qty Per Truck', 'Maximum quantity of items per truck load'),
  ('max_miles', '50', 'Max Delivery Miles', 'Maximum one-way delivery distance in miles'),
  ('phone_number', '(262) 345-4001', 'Contact Phone', 'Phone number shown when delivery is outside service area'),
  ('default_origin', 'W185 N7487, Narrow Ln, Menomonee Falls, WI 53051', 'Default Origin Address', 'Fallback origin address when no active origin is set');
