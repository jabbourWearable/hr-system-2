import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import "./globals.css";
import { ThemeScript } from "@/components/theme/theme-script";
import { ThemeToggle } from "@/components/theme/theme-toggle";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Editorial display serif per DESIGN.md — Instrument Serif stands in for
// the proprietary Domaine Display (see DESIGN.md "Note on Font Substitutes").
const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  weight: "400",
  subsets: ["latin"],
});

// Generic placeholder name/branding per spec §11 Q6 — no custom branding
// work is in scope for this project.
export const metadata: Metadata = {
  title: "HR System",
  description: "HR management & geo-attendance",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable} h-full antialiased`}
    >
      <head>
        <ThemeScript />
      </head>
      <body className="min-h-full flex flex-col bg-canvas text-body">
        <header className="flex h-16 items-center justify-between border-b border-hairline px-6">
          <Link href="/" className="display-serif text-xl">
            HR System
          </Link>
          <ThemeToggle />
        </header>
        <div className="flex flex-1 flex-col">{children}</div>
        <footer className="flex items-center justify-between gap-4 border-t border-hairline px-6 py-5">
          <span className="section-label">HR System</span>
          <span className="font-mono text-xs text-ash">
            People · Attendance · Leave · Recognition
          </span>
        </footer>
      </body>
    </html>
  );
}
