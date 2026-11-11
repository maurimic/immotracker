import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/toaster";
import { Sidebar } from "@/components/layout/sidebar";

const inter = { className: "font-sans antialiased" };

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: {
    default: "Poggel-Micciché Imperium – Immobilienverwaltung",
    template: "%s | Poggel-Micciché Imperium",
  },
  description: "Professionelles Mietverwaltungs-Tool mit KI-gestütztem Buchungsabgleich, Tilgungsrechner und Zinsbindungs-Ampel",
  keywords: ["Immobilien", "Mietverwaltung", "Nebenkostenabrechnung", "Tilgungsplan", "Zinsbindung"],
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <div className="flex flex-col md:flex-row h-[100dvh] overflow-hidden bg-background">
            <Sidebar />
            <main className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden">
              {children}
            </main>
          </div>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
