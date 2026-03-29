import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VARO",
  description: "근거와 맥락을 먼저 보여주는 분석 서비스, VARO",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <head>
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=block" />
      </head>
      <body className="min-h-full flex flex-col bg-[#faf8ff] text-[#191b24]">
        {children}
      </body>
    </html>
  );
}
