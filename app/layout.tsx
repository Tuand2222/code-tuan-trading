import type { Metadata, Viewport } from "next";
import { Be_Vietnam_Pro, Geist_Mono } from "next/font/google";
import "./globals.css";
import "./data-hub.css";

const geistSans = Be_Vietnam_Pro({
  variable: "--font-geist-sans",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = "https://tuannhatky.fabledcoot2.chatgpt.site";
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
  return (
    <html lang="vi">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        {children}
      </body>
    </html>
  );
}
