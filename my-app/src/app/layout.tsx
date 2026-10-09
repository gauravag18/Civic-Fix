import type { Metadata } from "next";
import { Public_Sans } from "next/font/google";
import { cn } from "cn";
import { AuthProviders } from "@/app/providers";
import "./globals.css";

const publicSans = Public_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-public-sans",
});

export const metadata: Metadata = {
  title: "CivicFix",
  description:
    "Community-powered civic issue reporting and resolution platform.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={cn(publicSans.variable, "h-full antialiased")}>
      <body className="flex min-h-full flex-col bg-background font-sans text-foreground">
        <AuthProviders>{children}</AuthProviders>
      </body>
    </html>
  );
}
