import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Settings, Save, Loader2 } from "lucide-react";
import { saveSetting, type AppSetting } from "@/lib/admin-api";

interface SettingsCardProps {
  settings: AppSetting[];
  password: string;
  onSaved: () => void;
}

const TOGGLE_KEYS = new Set([
  "show_origin",
  "show_distance",
  "show_destination",
  "show_drive_time",
  "show_rate_breakdown",
]);

function isToggle(key: string) {
  return TOGGLE_KEYS.has(key);
}

const SettingsCard = ({ settings, password, onSaved }: SettingsCardProps) => {
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);

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
      console.error("Failed to save setting:", err);
    } finally {
      setSavingKey(null);
    }
  };

  const handleToggle = async (setting: AppSetting) => {
    const current = setting.value === "true";
    const newValue = current ? "false" : "true";
    setSavingKey(setting.key);
    try {
      await saveSetting(password, setting.key, newValue);
      onSaved();
    } catch (err) {
      console.error("Failed to save setting:", err);
    } finally {
      setSavingKey(null);
    }
  };

  const getValue = (s: AppSetting) =>
    edits[s.key] !== undefined ? edits[s.key] : s.value;

  const isDirty = (s: AppSetting) =>
    edits[s.key] !== undefined && edits[s.key] !== s.value;

  const toggleSettings = settings.filter((s) => isToggle(s.key));
  const inputSettings = settings.filter((s) => !isToggle(s.key));

  return (
    <div className="space-y-6">
      {/* Regular input settings */}
      <Card className="border-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Settings className="h-5 w-5 text-primary" /> Delivery Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {inputSettings.length === 0 && (
            <p className="text-sm text-muted-foreground">No settings found.</p>
          )}
          {inputSettings.map((s) => (
            <div key={s.key} className="space-y-1">
              <Label className="text-xs font-semibold">{s.label}</Label>
              <p className="text-[11px] text-muted-foreground">{s.description}</p>
              <div className="flex items-center gap-2">
                <Input
                  value={getValue(s)}
                  onChange={(e) => handleChange(s.key, e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSave(s)}
                  className="font-mono text-sm"
                />
                <Button
                  size="sm"
                  variant={isDirty(s) ? "default" : "ghost"}
                  disabled={!isDirty(s) || savingKey === s.key}
                  onClick={() => handleSave(s)}
                >
                  {savingKey === s.key ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Toggle settings */}
      {toggleSettings.length > 0 && (
        <Card className="border-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Settings className="h-5 w-5 text-primary" /> Display Toggles
            </CardTitle>
            <p className="text-xs text-muted-foreground">Control what customers see on the delivery calculator</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {toggleSettings.map((s) => (
              <div key={s.key} className="flex items-center justify-between rounded-lg border border-border p-3">
                <div className="space-y-0.5 pr-4">
                  <Label className="text-sm font-semibold">{s.label}</Label>
                  <p className="text-[11px] text-muted-foreground">{s.description}</p>
                </div>
                <div className="flex items-center gap-2">
                  {savingKey === s.key ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  ) : (
                    <Switch
                      checked={s.value === "true"}
                      onCheckedChange={() => handleToggle(s)}
                    />
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default SettingsCard;
