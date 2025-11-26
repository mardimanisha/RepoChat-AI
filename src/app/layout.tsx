import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { ThemeProvider } from '../utils/theme-provider';
import { Toaster } from '../components/ui/sonner';

const montserrat = localFont({
  src: [
    {
      path: "../fonts/montserrat/Montserrat-Regular.ttf",
      weight: "400",
    },
    {
      path: "../fonts/montserrat/Montserrat-Bold.ttf",
      weight: "700",
    },
  ],
  variable: "--font-montserrat",
});

export const metadata: Metadata = {
  title: "RepoChat AI",
  description: "Chat with your GitHub repositories using AI",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`dark ${montserrat.className}`}>
      <body
        className="antialiased"
      >
        <ThemeProvider>
          {children}
          <Toaster position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
