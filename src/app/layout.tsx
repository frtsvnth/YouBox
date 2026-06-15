import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "YouBox",
  description: "Self-hosted video downloader",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ru" className="h-full antialiased dark">
      <body className="min-h-full flex flex-col">
        {children}
      </body>
    </html>
  )
}
