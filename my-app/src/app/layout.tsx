import type { Metadata } from "next";
import { Public_Sans } from "next/font/google";
import { getServerSession } from "next-auth";
import { cn } from "cn";
import { AuthProviders } from "@/app/providers";
import { authOptions } from "@/lib/auth/options";
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

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const session = await getServerSession(authOptions);

  return (
    <html lang="en" className={cn(publicSans.variable, "h-full antialiased")}>
      <body className="flex min-h-full flex-col bg-background font-sans text-foreground">
        <a
          href="#content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-card focus:px-3 focus:py-2"
        >
          Skip to content
        </a>
        <AuthProviders session={session}>{children}</AuthProviders>
      </body>
    </html>
  );
}
