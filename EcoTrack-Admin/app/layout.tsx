import React from "react";
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import AppShell from "@/components/AppShell";
import ServiceWorkerCleanup from "@/components/ServiceWorkerCleanup";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: "#1F7A37",
};

export const metadata: Metadata = {
  title: "EcoTrack",
  description: "Admin dashboard for residential waste management",
  keywords: ["ecotrack", "waste", "monitoring"],
  authors: [{ name: "EcoTrack Team" }],
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/icon.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head></head>
      <body className="min-h-full bg-gray-50">
        <ServiceWorkerCleanup />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
