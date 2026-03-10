INSERT INTO app_settings (key, value, label, description) VALUES
  ('style_font', 'Space Grotesk', 'Font Family', 'Google Font name for the calculator UI'),
  ('style_bg_color', '#ffffff', 'Background Color', 'Background color of the calculator card'),
  ('style_text_color', '#1a1a2e', 'Text Color', 'Main text color in the calculator'),
  ('style_button_color', '#e85d04', 'Button Color', 'Background color of the calculate button'),
  ('style_button_text_color', '#ffffff', 'Button Text Color', 'Text color on the calculate button'),
  ('style_accent_color', '#e85d04', 'Accent Color', 'Color for highlights and the total price')
ON CONFLICT (key) DO NOTHING;