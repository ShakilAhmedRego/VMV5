// @ts-nocheck
'use client'

import { useEffect, useState } from 'react'
import { X, Lock } from 'lucide-react'
import type { ReactNode } from 'react'

interface DrawerTab {
  label: string
  content: ReactNode
}

interface DrawerProps {
  open: boolean
  onClose: () => void
  title: string
  isUnlocked: boolean
  onUnlock?: () => void
  unlocking?: boolean
  tabs: DrawerTab[]
}

export default function Drawer({
  open,
  onClose,
  title,
  isUnlocked,
  onUnlock,
  unlocking,
  tabs,
}: DrawerProps) {
  const [activeTab, setActiveTab] = useState(0)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  useEffect(() => {
    setActiveTab(0)
  }, [title])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div
        className="flex-1 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Panel */}
      <div className="w-[480px] bg-white dark:bg-gray-950 shadow-2xl flex flex-col animate-slide-in-right border-l border-gray-200 dark:border-gray-800">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-gray-100 dark:border-gray-800">
          <div className="flex-1 min-w-0 pr-4">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 truncate">
              {title}
            </h2>
            <div className="mt-1.5 flex items-center gap-2">
              {isUnlocked ? (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded-full">
                  ✓ Unlocked
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">
                  <Lock className="w-3 h-3" /> Locked
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isUnlocked && onUnlock && (
              <button
                onClick={onUnlock}
                disabled={unlocking}
                className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
              >
                <Lock className="w-3 h-3" />
                {unlocking ? 'Unlocking…' : 'Unlock · 1 credit'}
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 dark:border-gray-800 px-6">
          {tabs.map((tab, i) => (
            <button
              key={tab.label}
              onClick={() => setActiveTab(i)}
              className={`text-sm py-3 px-1 mr-6 border-b-2 transition-colors ${
                activeTab === i
                  ? 'border-blue-600 text-blue-600 font-medium'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {tabs[activeTab]?.content}
        </div>
      </div>
    </div>
  )
}

// Helper components for drawer content
export function DrawerField({
  label,
  value,
  masked = false,
}: {
  label: string
  value: ReactNode
  masked?: boolean
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
        {label}
      </span>
      <span className={`text-sm text-gray-900 dark:text-gray-100 ${masked ? 'blur-sm select-none' : ''}`}>
        {masked ? '●●●●●●●●●●●●' : (value ?? '—')}
      </span>
    </div>
  )
}

export function DrawerSection({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
        {title}
      </h3>
      <div className="grid grid-cols-2 gap-4">{children}</div>
    </div>
  )
}
