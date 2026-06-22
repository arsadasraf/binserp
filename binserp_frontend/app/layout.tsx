import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import StoreProvider from "@/src/store/Providers";
// import { ThemeProvider } from "@/src/providers/ThemeProvider";
import AxiosInterceptorProvider from "@/src/providers/AxiosInterceptorProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BinsErp - Intelligent Manufacturing ERP",
  description: "Advanced ERP solution for modern manufacturing businesses. Manage Machines, Manpower, and Materials efficiently.",
  icons: {
    icon: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <StoreProvider>
          {/* <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          > */}
          <AxiosInterceptorProvider>
            {children}
          </AxiosInterceptorProvider>
          {/* </ThemeProvider> */}
        </StoreProvider>
      </body>
    </html>
  );
}
