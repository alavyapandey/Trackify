import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

export const metadata = {
  title: "Trackify",
  description: "Buy products at low price",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        {children}
        <Toaster richColors />
      </body>
    </html>
  );
}
