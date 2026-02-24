// @ts-nocheck
'use client'

import AuthGuard from '@/components/AuthGuard'
import TopNav from '@/components/TopNav'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
        <TopNav />
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </AuthGuard>
  )
}
