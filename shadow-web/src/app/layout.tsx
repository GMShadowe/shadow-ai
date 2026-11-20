import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const geist = localFont({
  src: "./fonts/Geist-Variable.woff2",
  variable: "--font-geist",
  weight: "100 900",
  display: "swap",
});

const geistMono = localFont({
  src: "./fonts/GeistMono-Variable.woff2",
  variable: "--font-geist-mono",
  weight: "100 900",
  display: "swap",
});

const geistSerif = localFont({
  src: "./fonts/GeistSerif-Regular.woff2",
  variable: "--font-geist-serif",
  weight: "400",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Shadow: an AI assistant that runs on your computer",
  description:
    "Shadow is a local-first AI assistant. Models run through Ollama, your chats stay in SQLite on your machine, and only the searches and pages you ask for go online.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geist.variable} ${geistMono.variable} ${geistSerif.variable} antialiased`}
    >
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
