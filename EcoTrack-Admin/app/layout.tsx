import React from "react";
import type { Metadata } from "next";
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

export const metadata: Metadata = {
  title: "EcoTrack Admin Dashboard",
  description: "Admin dashboard for residential waste management",
  keywords: ["ecotrack", "waste", "monitoring"],
  authors: [{ name: "EcoTrack Team" }],
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
