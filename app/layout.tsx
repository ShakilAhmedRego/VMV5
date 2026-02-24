// @ts-nocheck
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'VerifiedMeasure — Data Intelligence Platform',
  description: 'The leading Database-as-a-Service platform for verified business intelligence.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">{children}</body>
    </html>
  )
}
