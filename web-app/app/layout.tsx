import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Web Explorer Agent",
  description: "Chat with the local Mastra Web Explorer Agent.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
