import type { Metadata, Viewport } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import "./globals.css";
import "@fontsource-variable/newsreader";

export const metadata: Metadata = {
  title: { default: "Prep27", template: "%s · Prep27" },
  description:
    "Study planner for the May 2027 Level I exam. Adaptive plan, mistake bank, AI question lab and a knowledge map built on your own study log.",
  applicationName: "Prep27",
};

export const viewport: Viewport = {
  themeColor: "#fbf6ee",
  colorScheme: "light",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable} h-full antialiased`}>
      <body className="min-h-full font-sans text-[15px] leading-relaxed">{children}</body>
    </html>
  );
}
