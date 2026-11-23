import type { Metadata, Viewport } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Back Office",
    template: "%s · Back Office",
  },
  description: "Espace client — suivi de projets et retours",
  robots: { index: false, follow: false },
  // PWA : plein écran une fois ajoutée à l'écran d'accueil iOS.
  appleWebApp: {
    capable: true,
    title: "Back Office",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#059669",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
      // next-themes pose la classe du thème sur <html> avant l'hydratation.
      suppressHydrationWarning
    >
      {/* Hauteur figée + overflow hidden : le document ne scrolle jamais, chaque layout gère son propre scroll. */}
      <body className="h-full overflow-hidden flex flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
