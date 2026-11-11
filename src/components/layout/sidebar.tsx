"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Building2,
  CreditCard,
  Landmark,
  Wrench,
  Sun,
  Moon,
  Monitor,
  FileBarChart,
  ReceiptText,
  Download,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";

const navItems = [
  { href: "/", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/wohnungen", icon: Building2, label: "Wohnungen" },
  { href: "/zahlungen", icon: CreditCard, label: "Zahlungen" },
  { href: "/kredite", icon: Landmark, label: "Kredite & Tilgung" },
  { href: "/instandhaltung", icon: Wrench, label: "Instandhaltung" },
  { href: "/nebenkosten", icon: FileBarChart, label: "Nebenkosten" },
  { href: "/steuern", icon: ReceiptText, label: "Steuern & Anlage V" },
  { href: "/backup", icon: Download, label: "Backup & Export" },
];

export function Sidebar() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Mobile-Menü bei Seitenwechsel automatisch schließen
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  if (pathname === "/login") {
    return null;
  }

  const currentNav = navItems.find(
    (item) => pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href))
  );

  const cycleTheme = () => {
    if (theme === "dark") setTheme("light");
    else if (theme === "light") setTheme("system");
    else setTheme("dark");
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  };

  const renderThemeSwitcher = () => (
    <div className="p-1 bg-muted/60 rounded-lg border border-border/50 text-xs">
      <div className="flex items-center justify-between gap-1">
        <button
          type="button"
          onClick={() => setTheme("light")}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md transition-all font-medium text-xs",
            mounted && theme === "light"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
          title="Heller Modus"
        >
          <Sun className="h-3.5 w-3.5" />
          <span>Hell</span>
        </button>
        <button
          type="button"
          onClick={() => setTheme("dark")}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md transition-all font-medium text-xs",
            mounted && theme === "dark"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
          title="Dunkler Modus"
        >
          <Moon className="h-3.5 w-3.5" />
          <span>Dunkel</span>
        </button>
        <button
          type="button"
          onClick={() => setTheme("system")}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md transition-all font-medium text-xs",
            mounted && theme === "system"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
          title="System-Einstellung übernehmen"
        >
          <Monitor className="h-3.5 w-3.5" />
          <span>System</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* ── Mobile Top Header (< md) ─────────────────────────────────────────── */}
      <header className="md:hidden flex items-center justify-between px-3.5 h-14 border-b border-border bg-card/95 backdrop-blur-md shrink-0 z-30">
        <Link href="/" className="flex items-center gap-2.5 min-w-0">
          <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md shadow-blue-500/20">
            <Building2 className="h-4 w-4 text-white" />
          </div>
          <div className="min-w-0">
            <p className="font-bold text-sm leading-tight truncate">
              {currentNav?.label || "Poggel & Micciché"}
            </p>
            <p className="text-[11px] text-muted-foreground leading-tight truncate">
              Poggel & Micciché
            </p>
          </div>
        </Link>

        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={cycleTheme}
            className="h-9 w-9"
            title="Design wechseln"
            aria-label="Design wechseln"
          >
            {!mounted ? (
              <div className="h-4 w-4" />
            ) : theme === "dark" ? (
              <Moon className="h-4 w-4" />
            ) : theme === "light" ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Monitor className="h-4 w-4" />
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => setMobileOpen(true)}
            className="h-9 w-9"
            aria-label="Menü öffnen"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </div>
      </header>

      {/* ── Mobile Slide-Over Navigation Drawer (< md) ──────────────────────── */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative w-72 max-w-[85vw] h-full bg-card border-r border-border flex flex-col shadow-2xl animate-in slide-in-from-left duration-200 z-10">
            <div className="flex items-center justify-between px-4 py-4 border-b border-border">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
                  <Building2 className="h-5 w-5 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-sm leading-tight truncate">
                    Poggel & Micciché
                  </p>
                  <p className="text-xs text-muted-foreground">Immobilienverwaltung</p>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setMobileOpen(false)}
                className="h-8 w-8 shrink-0"
                aria-label="Menü schließen"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
              {navItems.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/" && pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "sidebar-item py-2.5 text-sm",
                      isActive && "active"
                    )}
                  >
                    <item.icon className="h-4 w-4 flex-shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="px-3 py-4 border-t border-border space-y-2.5">
              {renderThemeSwitcher()}
              <button
                type="button"
                onClick={handleLogout}
                className="sidebar-item w-full py-2.5 text-muted-foreground hover:text-destructive transition-colors"
              >
                <LogOut className="h-4 w-4 flex-shrink-0" />
                <span>Abmelden</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* ── Desktop Sidebar (>= md) ─────────────────────────────────────────── */}
      <aside
        className={cn(
          "hidden md:flex flex-col h-full border-r border-border bg-card/50 backdrop-blur-sm transition-all duration-300 shrink-0",
          collapsed ? "w-16" : "w-64"
        )}
      >
        {/* Logo */}
        <div
          className={cn(
            "flex items-center gap-3 px-4 py-5 border-b border-border",
            collapsed && "justify-center px-0"
          )}
        >
          <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
            <Building2 className="h-5 w-5 text-white" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="font-bold text-sm leading-tight truncate" title="Poggel-Micciché Imperium">
                Poggel & Micciché
              </p>
              <p className="text-xs text-muted-foreground">Immobilienverwaltung</p>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "sidebar-item",
                  isActive && "active",
                  collapsed && "justify-center px-2"
                )}
                title={collapsed ? item.label : undefined}
              >
                <item.icon className="h-4 w-4 flex-shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-3 py-4 border-t border-border space-y-2">
          {!collapsed ? (
            renderThemeSwitcher()
          ) : (
            <button
              onClick={cycleTheme}
              className="sidebar-item w-full justify-center px-2"
              title={
                !mounted
                  ? "Design"
                  : theme === "dark"
                  ? "Dunkel (Klick für Hell)"
                  : theme === "light"
                  ? "Hell (Klick für System)"
                  : "System (Klick für Dunkel)"
              }
            >
              {!mounted ? (
                <div className="h-4 w-4 flex-shrink-0" />
              ) : theme === "dark" ? (
                <Moon className="h-4 w-4 flex-shrink-0" />
              ) : theme === "light" ? (
                <Sun className="h-4 w-4 flex-shrink-0" />
              ) : (
                <Monitor className="h-4 w-4 flex-shrink-0" />
              )}
            </button>
          )}

          <button
            onClick={handleLogout}
            className={cn(
              "sidebar-item w-full text-muted-foreground hover:text-destructive transition-colors",
              collapsed && "justify-center px-2"
            )}
            title="Abmelden"
          >
            <LogOut className="h-4 w-4 flex-shrink-0" />
            {!collapsed && <span>Abmelden</span>}
          </button>

          <button
            onClick={() => setCollapsed(!collapsed)}
            className={cn(
              "sidebar-item w-full",
              collapsed && "justify-center px-2"
            )}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4 flex-shrink-0" />
            ) : (
              <>
                <ChevronLeft className="h-4 w-4 flex-shrink-0" />
                <span>Einklappen</span>
              </>
            )}
          </button>
        </div>
      </aside>
    </>
  );
}
