import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { ThemeProvider } from "next-themes";
import "./globals.css";

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(defaultUrl),
  title: "SlideFlip - Create Stunning Presentations",
  description: "Build beautiful presentations with AI-powered slide creation and design tools",
  keywords: ["presentations", "slides", "AI", "design", "presentation builder", "slide creation"],
  authors: [{ name: "SlideFlip Team" }],
  creator: "SlideFlip",
  publisher: "SlideFlip Tech, Inc.",
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico', sizes: 'any' }
    ],
    shortcut: '/favicon.ico',
    apple: '/icon.svg',
  },
  openGraph: {
    title: "SlideFlip - Create Stunning Presentations",
    description: "Build beautiful presentations with AI-powered slide creation and design tools",
    type: "website",
    url: defaultUrl,
    siteName: "SlideFlip",
    images: [
      {
        url: "/opengraph-image.png",
        width: 1200,
        height: 630,
        alt: "SlideFlip - AI-Powered Presentation Builder",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "SlideFlip - Create Stunning Presentations",
    description: "Build beautiful presentations with AI-powered slide creation and design tools",
    images: ["/twitter-image.png"],
  },
};

const geistSans = Geist({
  variable: "--font-geist-sans",
  display: "swap",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="apple-touch-icon" href="/icon.svg" />
      </head>
      <body className={`${geistSans.className} antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
