import type { Metadata } from "next";
import { Montserrat } from 'next/font/google'
import "./globals.css";
import { ThemeProvider } from '../utils/theme-provider';
import { Toaster } from '../components/ui/sonner';

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ['400', '500', '600', '700'],
  variable: "--font-montserrat",
  display: 'swap',
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
    <html lang="en">
      <body
        className={`${montserrat.variable} antialiased`}
      >
        <ThemeProvider>
          {children}
          <Toaster position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
