import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "next-themes";
import { WebSocketProvider } from "@/components/websocket-provider";

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(defaultUrl),
  title: "Slideo - AI slide builder",
  description: "Build beautiful presentations with AI-powered slide creation and design tools",
  keywords: ["presentations", "slides", "AI", "design", "presentation builder", "slide creation"],
  authors: [{ name: "Slideo Team" }],
  creator: "Slideo",
  publisher: "Slideo Tech, Inc.",
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico', sizes: 'any' }
    ],
    shortcut: '/favicon.ico',
    apple: '/icon.svg',
  },
  openGraph: {
  title: "Slideo - AI slide builder",
    description: "Build beautiful presentations with AI-powered slide creation and design tools",
    type: "website",
    url: defaultUrl,
  siteName: "Slideo",
    images: [
      {
        url: "/opengraph-image.png",
        width: 1200,
        height: 630,
  alt: "Slideo - AI-Powered Presentation Builder",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
  title: "Slideo - AI slide builder",
    description: "Build beautiful presentations with AI-powered slide creation and design tools",
    images: ["/twitter-image.png"],
  },
};

// Display/sans family similar to modern editorial in the reference: Plus Jakarta Sans
const displaySans = Plus_Jakarta_Sans({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

// Note: keep import only for potential future usage; avoid unused var lint

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="apple-touch-icon" href="/icon.svg" />
      </head>
      <body className={`${displaySans.className} antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <WebSocketProvider>
            {children}
          </WebSocketProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
