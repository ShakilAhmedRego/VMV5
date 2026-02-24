// @ts-nocheck
'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Search, ChevronDown, X } from 'lucide-react'
import { VERTICAL_LIST } from '@/lib/verticals'

interface VerticalSwitcherProps {
  currentKey: string
}

export default function VerticalSwitcher({ currentKey }: VerticalSwitcherProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const router = useRouter()
  const ref = useRef<HTMLDivElement>(null)
  const current = VERTICAL_LIST.find(v => v.key === currentKey)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setSearch('')
      }
    }
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpen(false); setSearch('') }
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('keydown', keyHandler)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('keydown', keyHandler)
    }
  }, [])

  const filtered = VERTICAL_LIST.filter(v =>
    v.label.toLowerCase().includes(search.toLowerCase()) ||
    v.description.toLowerCase().includes(search.toLowerCase())
  )

  function navigate(key: string) {
    router.push(`/dashboard/${key}`)
    setOpen(false)
    setSearch('')
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-sm font-medium text-gray-700 dark:text-gray-200"
      >
        <span>{current?.icon ?? '📊'}</span>
        <span>{current?.shortLabel ?? 'Select Vertical'}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-2 w-[680px] bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-800 z-50 animate-fade-in">
          {/* Search */}
          <div className="p-4 border-b border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 rounded-xl px-3 py-2">
              <Search className="w-4 h-4 text-gray-400 shrink-0" />
              <input
                autoFocus
                type="text"
                placeholder="Search verticals…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="flex-1 bg-transparent text-sm text-gray-700 dark:text-gray-200 placeholder:text-gray-400 outline-none"
              />
              {search && (
                <button onClick={() => setSearch('')}>
                  <X className="w-3.5 h-3.5 text-gray-400 hover:text-gray-600" />
                </button>
              )}
            </div>
          </div>

          {/* Grid */}
          <div className="p-4 grid grid-cols-4 gap-2 max-h-[420px] overflow-y-auto">
            {filtered.map(v => (
              <button
                key={v.key}
                onClick={() => navigate(v.key)}
                className={`flex flex-col items-start gap-1.5 p-3 rounded-xl text-left transition-all hover:scale-[1.02] ${
                  v.key === currentKey
                    ? 'bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-800 border border-transparent'
                }`}
              >
                <span className="text-xl">{v.icon}</span>
                <span className="text-xs font-semibold text-gray-800 dark:text-gray-200 leading-tight">
                  {v.shortLabel}
                </span>
                <span className="text-[10px] text-gray-400 dark:text-gray-500 leading-tight line-clamp-2">
                  {v.description}
                </span>
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="col-span-4 py-8 text-center text-sm text-gray-400">
                No verticals match &ldquo;{search}&rdquo;
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
