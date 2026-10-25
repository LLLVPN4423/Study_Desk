import type { Metadata } from "next";
import { Figtree, Fraunces, JetBrains_Mono, Noto_Sans_JP } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";

const figtree = Figtree({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-ui",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin", "latin-ext"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin", "latin-ext"],
  weight: ["500", "600"],
  variable: "--font-mono",
  display: "swap",
});

const notoJp = Noto_Sans_JP({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-jp",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Study Desk",
  description:
    "Bàn học song ngữ JP/EN — desk, SRS, culture. Unofficial practice. Chạy local miễn phí.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="vi"
      className={`${figtree.variable} ${fraunces.variable} ${jetbrains.variable} ${notoJp.variable}`}
    >
      <body className="app-root">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
