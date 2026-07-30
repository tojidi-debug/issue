import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "감사·인증 독립성 검토",
  description:
    "사전감리자료와 매출장을 브라우저에서 대사해 독립성 검토 후보를 선별합니다.",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
