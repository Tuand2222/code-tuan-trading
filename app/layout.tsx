import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { getBuildInfo } from "../lib/build-info";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = "https://trading-plan-pro.tuann7260.chatgpt.site";
const siteDescription = "Trading Plan Pro giúp nhà đầu tư Việt Nam ghi nhật ký giao dịch, đo hiệu suất, quản trị rủi ro và định giá doanh nghiệp minh bạch theo dữ liệu.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Trading Plan Pro · Nhật ký giao dịch & Quản trị rủi ro",
    template: "%s · Trading Plan Pro",
  },
  description: siteDescription,
  keywords: [
    "nhật ký giao dịch",
    "trading journal",
    "quản trị rủi ro",
    "phân tích hiệu suất giao dịch",
    "hàng hóa phái sinh",
    "định giá doanh nghiệp",
  ],
  authors: [{ name: "Tuan Trader" }],
  creator: "Tuan Trader",
  publisher: "Tuan Trader",
  category: "finance",
  manifest: "/site.webmanifest",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "vi_VN",
    url: siteUrl,
    siteName: "Trading Plan Pro",
    title: "Trading Plan Pro · Nhật ký giao dịch có kỷ luật",
    description: siteDescription,
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Trading Plan Pro — Nhật ký giao dịch và quản trị rủi ro" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Trading Plan Pro · Nhật ký giao dịch có kỷ luật",
    description: siteDescription,
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
  other: {
    "codex-preview": "development",
    "theme-color": "#090c11",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  colorScheme: "dark",
  themeColor: "#090c11",
};

const structuredData = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Trading Plan Pro",
  url: siteUrl,
  description: siteDescription,
  applicationCategory: "FinanceApplication",
  operatingSystem: "Web",
  inLanguage: "vi-VN",
  creator: { "@type": "Person", name: "Tuan Trader" },
  featureList: [
    "Nhật ký giao dịch đa thị trường",
    "Phân tích hiệu suất có kiểm soát cỡ mẫu",
    "Quản trị rủi ro và sụt giảm vốn",
    "Định giá doanh nghiệp đa mô hình",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const buildInfo = getBuildInfo();

  return (
    <html lang="vi">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        data-build-commit={buildInfo.commit}
        data-build-time={buildInfo.builtAt}
      >
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        {children}
        <a
          href="/version.json"
          aria-label={`Phiên bản build ${buildInfo.shortCommit}`}
          title={`Commit ${buildInfo.commit} · Build ${buildInfo.builtAt}`}
          style={{
            position: "fixed",
            right: 8,
            bottom: 8,
            zIndex: 9999,
            padding: "4px 7px",
            border: "1px solid rgba(148, 163, 184, 0.22)",
            borderRadius: 6,
            background: "rgba(9, 12, 17, 0.78)",
            color: "rgba(203, 213, 225, 0.58)",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            fontSize: 9,
            lineHeight: 1,
            textDecoration: "none",
            backdropFilter: "blur(8px)",
          }}
        >
          build {buildInfo.shortCommit}
        </a>
      </body>
    </html>
  );
}
