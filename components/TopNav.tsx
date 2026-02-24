// @ts-nocheck
'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Moon, Sun, Coins, Shield, LogOut } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { getUserRole } from '@/lib/auth'
import { getCreditBalance } from '@/lib/credits'
import VerticalSwitcher from './VerticalSwitcher'
import { VERTICALS } from '@/lib/verticals'
import Image from 'next/image'

export default function TopNav() {
  const pathname = usePathname()
  const router = useRouter()
  const [dark, setDark] = useState(false)
  const [credits, setCredits] = useState(0)
  const [isAdmin, setIsAdmin] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)

  const segments = pathname.split('/')
  const verticalKey = segments[2] ?? 'dealflow'
  const vertical = VERTICALS[verticalKey]

  useEffect(() => {
    const stored = localStorage.getItem('vm-dark')
    if (stored === 'true') {
      document.documentElement.classList.add('dark')
      setDark(true)
    }
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      const uid = data.session?.user?.id
      if (!uid) return
      setUserId(uid)
      const [role, balance] = await Promise.all([
        getUserRole(uid),
        getCreditBalance(uid),
      ])
      setIsAdmin(role === 'admin')
      setCredits(balance)
    })
  }, [pathname])

  function toggleDark() {
    const next = !dark
    setDark(next)
    document.documentElement.classList.toggle('dark', next)
    localStorage.setItem('vm-dark', String(next))
  }

  async function signOut() {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  return (
    <header className="sticky top-0 z-40 h-14 flex items-center border-b border-gray-100 dark:border-gray-800 bg-white/95 dark:bg-gray-950/95 backdrop-blur-sm px-4 gap-4">
      {/* Logo */}
      <div className="flex items-center gap-2.5 shrink-0">
        <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center overflow-hidden">
          <Image
            src="/vm-logo.png"
            alt="VM"
            width={32}
            height={32}
            className="w-full h-full object-cover"
            onError={() => {}}
          />
        </div>
        <span className="text-sm font-bold text-gray-900 dark:text-gray-100 hidden sm:block">
          VerifiedMeasure
        </span>
      </div>

      <div className="w-px h-5 bg-gray-200 dark:bg-gray-700 shrink-0" />

      {/* Vertical Switcher */}
      <VerticalSwitcher currentKey={verticalKey} />

      {/* Breadcrumb */}
      {vertical && (
        <span className="text-sm text-gray-400 dark:text-gray-500 hidden md:block">
          / {vertical.label}
        </span>
      )}

      <div className="flex-1" />

      {/* Right controls */}
      <div className="flex items-center gap-2">
        {/* Credit balance */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
          <Coins className="w-3.5 h-3.5 text-amber-600" />
          <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">
            {credits.toLocaleString()}
          </span>
        </div>

        {/* Admin link */}
        {isAdmin && (
          <button
            onClick={() => router.push('/dashboard/debug')}
            className="p-2 rounded-xl text-gray-400 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors"
            title="Admin"
          >
            <Shield className="w-4 h-4" />
          </button>
        )}

        {/* Dark mode */}
        <button
          onClick={toggleDark}
          className="p-2 rounded-xl text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* Sign out */}
        <button
          onClick={signOut}
          className="p-2 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          title="Sign out"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  )
}
