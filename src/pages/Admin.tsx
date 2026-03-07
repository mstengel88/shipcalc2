import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Lock, MapPin, Plus, Trash2, Check, Loader2, Store } from "lucide-react";
import {
  verifyAdminPassword,
  fetchOrigins,
  saveOrigin,
  deleteOrigin,
  fetchShopifyLocations,
  type OriginAddress,
  type ShopifyLocation,
} from "@/lib/admin-api";

const Admin = () => {
  const [password, setPassword] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [checking, setChecking] = useState(false);
  const [authError, setAuthError] = useState(false);

  const [origins, setOrigins] = useState<OriginAddress[]>([]);
  const [locations, setLocations] = useState<ShopifyLocation[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [newLabel, setNewLabel] = useState("");
  const [newAddress, setNewAddress] = useState("");

  const handleLogin = async () => {
    setChecking(true);
    setAuthError(false);
    const valid = await verifyAdminPassword(password);
    if (valid) {
      setAuthenticated(true);
      loadData();
    } else {
      setAuthError(true);
    }
    setChecking(false);
  };

  const loadData = async () => {
    setLoading(true);
    const [o, l] = await Promise.all([fetchOrigins(), fetchShopifyLocations()]);
    setOrigins(o);
    setLocations(l);
    setLoading(false);
  };

  const handleSetActive = async (id: string) => {
    const origin = origins.find((o) => o.id === id);
    if (!origin) return;
    setSaving(true);
    await saveOrigin(password, { id, label: origin.label, address: origin.address, is_active: true });
    await loadData();
    setSaving(false);
  };

  const handleAdd = async () => {
    if (!newLabel.trim() || !newAddress.trim()) return;
    setSaving(true);
    await saveOrigin(password, { label: newLabel, address: newAddress, is_active: origins.length === 0 });
    setNewLabel("");
    setNewAddress("");
    await loadData();
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    setSaving(true);
    await deleteOrigin(password, id);
    await loadData();
    setSaving(false);
  };

  const handleImportLocation = (loc: ShopifyLocation) => {
    setNewLabel(loc.name);
    setNewAddress(loc.address);
  };

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-sm border-2">
          <CardHeader className="text-center">
            <Lock className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
            <CardTitle className="font-heading">Admin Access</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Password</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                placeholder="Enter admin password"
              />
              {authError && <p className="text-sm text-destructive">Invalid password</p>}
            </div>
            <Button onClick={handleLogin} disabled={!password || checking} className="w-full">
              {checking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Lock className="mr-2 h-4 w-4" />}
              Unlock
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="mx-auto max-w-2xl space-y-6">
        <h1 className="font-heading text-2xl font-bold">Origin Address Settings</h1>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading…
          </div>
        ) : (
          <>
            {/* Current origins */}
            <Card className="border-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <MapPin className="h-5 w-5 text-primary" /> Origin Addresses
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {origins.length === 0 && (
                  <p className="text-sm text-muted-foreground">No origin addresses configured.</p>
                )}
                {origins.map((o) => (
                  <div
                    key={o.id}
                    className={`flex items-center justify-between rounded-lg border p-3 ${
                      o.is_active ? "border-primary bg-primary/5" : "border-border"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{o.label}</span>
                        {o.is_active && (
                          <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
                            ACTIVE
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{o.address}</p>
                    </div>
                    <div className="flex items-center gap-1 ml-2">
                      {!o.is_active && (
                        <Button size="sm" variant="ghost" onClick={() => handleSetActive(o.id)} disabled={saving}>
                          <Check className="h-4 w-4" />
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(o.id)} disabled={saving}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Add new */}
            <Card className="border-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Plus className="h-5 w-5" /> Add Origin Address
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Label</Label>
                    <Input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="e.g. Warehouse" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Address</Label>
                    <Input value={newAddress} onChange={(e) => setNewAddress(e.target.value)} placeholder="Full address" />
                  </div>
                </div>
                <Button onClick={handleAdd} disabled={!newLabel.trim() || !newAddress.trim() || saving} className="w-full">
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                  Add Address
                </Button>
              </CardContent>
            </Card>

            {/* Shopify locations */}
            {locations.length > 0 && (
              <Card className="border-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Store className="h-5 w-5 text-accent-foreground" /> Shopify Locations
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-xs text-muted-foreground mb-3">
                    Click a location to pre-fill the add form above.
                  </p>
                  {locations.map((loc) => (
                    <button
                      key={loc.id}
                      onClick={() => handleImportLocation(loc)}
                      className="w-full text-left rounded-lg border border-border p-3 hover:bg-muted/50 transition-colors"
                    >
                      <span className="font-medium text-sm">{loc.name}</span>
                      <p className="text-xs text-muted-foreground">{loc.address}</p>
                    </button>
                  ))}
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Admin;
