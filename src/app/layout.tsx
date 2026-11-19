import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Simple Metrics Dashboard",
  description: "The general condition of the Australian economy, in plain English.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f8fc" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0d14" },
  ],
};

/**
 * Runs before first paint: applies the saved theme, or the system preference,
 * so the page never flashes the wrong theme. With no saved choice it keeps
 * following the system live (e.g. macOS switching to dark at sunset).
 */
const themeScript = `(function(){try{var m=matchMedia("(prefers-color-scheme: dark)"),d=document.documentElement;function saved(){try{var t=localStorage.getItem("theme");return t==="light"||t==="dark"?t:null}catch(e){return null}}d.dataset.theme=saved()||(m.matches?"dark":"light");m.addEventListener("change",function(e){if(!saved())d.dataset.theme=e.matches?"dark":"light"})}catch(e){}})()`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${plusJakartaSans.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="pastel flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}
