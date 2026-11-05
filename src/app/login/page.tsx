"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Building2, Lock, User, ArrowRight, Eye, EyeOff, ShieldCheck, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") || "/";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (res.ok) {
        // Erfolgreich eingeloggt -> Weiterleiten
        window.location.href = from;
      } else {
        setError(data.error || "Zugangsdaten nicht korrekt. Bitte erneut versuchen.");
      }
    } catch {
      setError("Verbindungsfehler zum Server. Bitte versuchen Sie es erneut.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-gradient-to-br from-background via-muted/40 to-background">
      <Card className="w-full max-w-md shadow-2xl border-border/80 backdrop-blur-md bg-card/90">
        <CardHeader className="space-y-3 text-center pb-4">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 via-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
            <Building2 className="h-7 w-7 text-white" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold tracking-tight">
              Poggel & Micciché
            </CardTitle>
            <p className="text-xs uppercase tracking-wider text-primary font-semibold mt-1">
              Immobilienverwaltung
            </p>
            <CardDescription className="text-xs text-muted-foreground mt-2">
              Geschützter Bereich. Bitte melden Sie sich mit Ihren Zugangsdaten an.
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="pt-2">
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-destructive/15 border border-destructive/30 text-destructive flex items-center gap-2 text-xs animate-in fade-in">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="username" className="text-xs font-medium">
                Benutzername
              </Label>
              <div className="relative">
                <Input
                  id="username"
                  type="text"
                  placeholder="Benutzername eingeben"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="pl-9 h-10 text-sm"
                  autoFocus
                  required
                />
                <User className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-medium flex items-center justify-between">
                <span>Passwort</span>
                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <ShieldCheck className="h-3 w-3 text-emerald-500" /> Ende-zu-Ende gesichert
                </span>
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Passwort eingeben"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-9 pr-10 h-10 font-mono text-sm"
                  required
                />
                <Lock className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                  tabIndex={-1}
                  aria-label={showPassword ? "Passwort verbergen" : "Passwort anzeigen"}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-10 gap-2 font-medium bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-md shadow-indigo-500/20"
              disabled={loading || !username || !password}
            >
              {loading ? (
                <span>Wird überprüft...</span>
              ) : (
                <>
                  <Lock className="h-4 w-4" />
                  <span>Anmelden</span>
                  <ArrowRight className="h-4 w-4 ml-auto" />
                </>
              )}
            </Button>
          </form>

          <div className="mt-6 pt-4 border-t border-border/50 text-center text-[11px] text-muted-foreground">
            Immotracker Portfolio System · Stand 2026
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Laden...</div>}>
      <LoginForm />
    </Suspense>
  );
}
