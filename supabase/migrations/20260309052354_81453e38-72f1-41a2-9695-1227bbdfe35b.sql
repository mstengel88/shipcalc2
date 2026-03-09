INSERT INTO public.app_settings (key, value, label, description) VALUES
  ('show_origin', 'true', 'Show Origin Address', 'Display the origin address below the delivery address input'),
  ('show_distance', 'true', 'Show Distance', 'Display the distance (miles) in the quote results'),
  ('show_destination', 'true', 'Show Destination', 'Display the destination address in the quote results'),
  ('show_drive_time', 'false', 'Show Drive Time', 'Display the one-way drive time in the quote results'),
  ('show_rate_breakdown', 'false', 'Show Rate Breakdown', 'Display the per-minute rate and round-trip minutes in the quote results')
ON CONFLICT (key) DO NOTHING;