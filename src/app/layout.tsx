import type { Metadata } from "next";
import "./globals.css";
import Script from "next/script";

export const metadata: Metadata = {
  title: "Nexus",
  description: "Advanced metric visualization and reporting application.",
  icons: {
    icon: "/favicon.ico",
  },
};

import Sidebar from "@/components/Sidebar";
import { ThemeProvider } from "@/components/ThemeProvider";
import StyledJsxRegistry from "@/lib/registry";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
        <Script id="theme-init" strategy="beforeInteractive">{`
          (function () {
            try {
              var stored = localStorage.getItem('theme');
              if (stored === 'light' || stored === 'amoled') {
                document.documentElement.setAttribute('data-theme', stored);
                document.documentElement.style.colorScheme = stored === 'amoled' ? 'dark' : 'light';
              }
            } catch (e) {
              // no-op
            }
          })();
        `}</Script>
      </head>
      <body>
        <StyledJsxRegistry>
          <ThemeProvider>
            <div className="app-container">
              <Sidebar />
              <main className="main-content">
                {children}
              </main>
            </div>
          </ThemeProvider>
        </StyledJsxRegistry>
      </body>
    </html>
  );
}
