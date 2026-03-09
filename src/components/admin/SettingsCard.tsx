import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Settings, Save, Loader2 } from "lucide-react";
import { saveSetting, type AppSetting } from "@/lib/admin-api";

interface SettingsCardProps {
  settings: AppSetting[];
  password: string;
  onSaved: () => void;
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

  const getValue = (s: AppSetting) =>
    edits[s.key] !== undefined ? edits[s.key] : s.value;

  const isDirty = (s: AppSetting) =>
    edits[s.key] !== undefined && edits[s.key] !== s.value;

  return (
    <Card className="border-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Settings className="h-5 w-5 text-primary" /> Delivery Settings
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {settings.length === 0 && (
          <p className="text-sm text-muted-foreground">No settings found.</p>
        )}
        {settings.map((s) => (
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
  );
};

export default SettingsCard;
