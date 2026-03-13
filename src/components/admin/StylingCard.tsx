import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Palette, Save, Loader2, RotateCcw } from "lucide-react";
import { saveSetting, type AppSetting } from "@/lib/admin-api";

const STYLE_KEYS = [
  "style_font",
  "style_bg_color",
  "style_text_color",
  "style_button_color",
  "style_button_text_color",
  "style_accent_color",
];

const DEFAULTS: Record<string, string> = {
  style_font: "Space Grotesk",
  style_bg_color: "#ffffff",
  style_text_color: "#1a1a2e",
  style_button_color: "#e85d04",
  style_button_text_color: "#ffffff",
  style_accent_color: "#e85d04",
};

interface StylingCardProps {
  settings: AppSetting[];
  password: string;
  onSaved: () => void;
}

const FONT_OPTIONS = [
  "Space Grotesk",
  "Inter",
  "Roboto",
  "Open Sans",
  "Lato",
  "Montserrat",
  "Poppins",
  "Nunito",
  "Raleway",
  "Source Sans 3",
  "DM Sans",
  "Outfit",
  "Manrope",
  "Plus Jakarta Sans",
  "Sora",
  "Urbanist",
  "Figtree",
  "Geist",
  "Bricolage Grotesque",
  "Red Hat Display",
  "Instrument Sans",
  "General Sans",
  "Satoshi",
  "Work Sans",
  "Lexend",
];

function isColor(key: string) {
  return key.includes("color");
}

const StylingCard = ({ settings, password, onSaved }: StylingCardProps) => {
  const styleSettings = settings.filter((s) => STYLE_KEYS.includes(s.key));
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const getValue = (s: AppSetting) => edits[s.key] ?? s.value;
  const isDirty = (s: AppSetting) => edits[s.key] !== undefined && edits[s.key] !== s.value;

  const handleChange = (key: string, value: string) => {
    setEdits((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async (setting: AppSetting) => {
    const newValue = edits[setting.key];
    if (newValue === undefined || newValue === setting.value) return;
    setSavingKey(setting.key);
    try {
      await saveSetting(password, setting.key, newValue);
      setEdits((prev) => {
        const next = { ...prev };
        delete next[setting.key];
        return next;
      });
      onSaved();
    } catch (err) {
      console.error("Failed to save styling:", err);
    } finally {
      setSavingKey(null);
    }
  };

  const handleReset = async (setting: AppSetting) => {
    const defaultVal = DEFAULTS[setting.key];
    if (!defaultVal || defaultVal === setting.value) return;
    setSavingKey(setting.key);
    try {
      await saveSetting(password, setting.key, defaultVal);
      setEdits((prev) => {
        const next = { ...prev };
        delete next[setting.key];
        return next;
      });
      onSaved();
    } catch (err) {
      console.error("Failed to reset styling:", err);
    } finally {
      setSavingKey(null);
    }
  };

  // Build preview styles from current values
  const previewStyles: Record<string, string> = {};
  for (const s of styleSettings) {
    const val = getValue(s);
    if (s.key === "style_bg_color") previewStyles.backgroundColor = val;
    if (s.key === "style_text_color") previewStyles.color = val;
    if (s.key === "style_font") previewStyles.fontFamily = `'${val}', sans-serif`;
  }

  const buttonBg = getValue(styleSettings.find((s) => s.key === "style_button_color") || { key: "style_button_color", value: DEFAULTS.style_button_color } as AppSetting);
  const buttonText = getValue(styleSettings.find((s) => s.key === "style_button_text_color") || { key: "style_button_text_color", value: DEFAULTS.style_button_text_color } as AppSetting);
  const accentColor = getValue(styleSettings.find((s) => s.key === "style_accent_color") || { key: "style_accent_color", value: DEFAULTS.style_accent_color } as AppSetting);

  const fontSetting = styleSettings.find((s) => s.key === "style_font");
  const colorSettings = styleSettings.filter((s) => isColor(s.key));

  if (styleSettings.length === 0) return null;

  return (
    <Card className="border-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Palette className="h-5 w-5 text-primary" /> Styling
        </CardTitle>
        <p className="text-xs text-muted-foreground">Customize the look of the customer-facing calculator</p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Font selector */}
        {fontSetting && (
          <div className="space-y-1">
            <Label className="text-xs font-semibold">{fontSetting.label}</Label>
            <p className="text-[11px] text-muted-foreground">{fontSetting.description}</p>
            <div className="flex items-center gap-2">
              <select
                value={getValue(fontSetting)}
                onChange={(e) => handleChange(fontSetting.key, e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {FONT_OPTIONS.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
              <Button
                size="sm"
                variant={isDirty(fontSetting) ? "default" : "ghost"}
                disabled={!isDirty(fontSetting) || savingKey === fontSetting.key}
                onClick={() => handleSave(fontSetting)}
              >
                {savingKey === fontSetting.key ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={savingKey === fontSetting.key}
                onClick={() => handleReset(fontSetting)}
                title="Reset to default"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Color pickers */}
        <div className="grid gap-4 sm:grid-cols-2">
          {colorSettings.map((s) => (
            <div key={s.key} className="space-y-1">
              <Label className="text-xs font-semibold">{s.label}</Label>
              <p className="text-[11px] text-muted-foreground">{s.description}</p>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <input
                    type="color"
                    value={getValue(s)}
                    onChange={(e) => handleChange(s.key, e.target.value)}
                    className="h-10 w-10 cursor-pointer rounded-md border border-input p-0.5"
                  />
                </div>
                <Input
                  value={getValue(s)}
                  onChange={(e) => handleChange(s.key, e.target.value)}
                  className="font-mono text-sm flex-1"
                  placeholder="#000000"
                />
                <Button
                  size="sm"
                  variant={isDirty(s) ? "default" : "ghost"}
                  disabled={!isDirty(s) || savingKey === s.key}
                  onClick={() => handleSave(s)}
                >
                  {savingKey === s.key ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={savingKey === s.key}
                  onClick={() => handleReset(s)}
                  title="Reset to default"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        {/* Live preview */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold">Live Preview</Label>
          <div
            className="rounded-lg border-2 border-border p-4 space-y-3"
            style={previewStyles}
          >
            <p className="text-lg font-bold" style={{ fontFamily: previewStyles.fontFamily }}>
              Delivery Cost Calculator
            </p>
            <p className="text-sm opacity-70" style={{ fontFamily: previewStyles.fontFamily }}>123 Main St, Milwaukee, WI 53202</p>
            <button
              className="w-full rounded-md px-4 py-2 text-sm font-semibold"
              style={{ backgroundColor: buttonBg, color: buttonText, fontFamily: previewStyles.fontFamily }}
            >
              Get Delivery Quote
            </button>
            <div className="flex justify-between items-center pt-2 border-t" style={{ borderColor: `${accentColor}33` }}>
              <span className="text-sm font-bold" style={{ fontFamily: previewStyles.fontFamily }}>Total Cost</span>
              <span className="text-xl font-bold" style={{ color: accentColor, fontFamily: previewStyles.fontFamily }}>$125.00</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default StylingCard;
