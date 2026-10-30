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
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <aside
      className={cn(
        "flex flex-col h-full border-r border-border bg-card/50 backdrop-blur-sm transition-all duration-300",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo */}
      <div className={cn(
        "flex items-center gap-3 px-4 py-5 border-b border-border",
        collapsed && "justify-center px-0"
      )}>
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
          const isActive = pathname === item.href ||
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
        ) : (
          <button
            onClick={() => {
              if (theme === "dark") setTheme("light");
              else if (theme === "light") setTheme("system");
              else setTheme("dark");
            }}
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
  );
}
