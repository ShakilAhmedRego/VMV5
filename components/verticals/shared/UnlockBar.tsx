// @ts-nocheck
'use client'

import { Lock } from 'lucide-react'

interface UnlockBarProps {
  selectedCount: number
  newCount: number
  unlocking: boolean
  creditBalance: number
  onUnlock: () => void
  onClear: () => void
}

export default function UnlockBar({
  selectedCount,
  newCount,
  unlocking,
  creditBalance,
  onUnlock,
  onClear,
}: UnlockBarProps) {
  if (selectedCount === 0) return null

  const canAfford = creditBalance >= newCount

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-fade-in">
      <div className="flex items-center gap-4 bg-gray-900 dark:bg-gray-950 text-white rounded-2xl px-6 py-3 shadow-2xl border border-gray-700">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-300">{selectedCount} selected</span>
          {newCount > 0 && (
            <>
              <span className="text-gray-600">·</span>
              <span className="text-amber-400">{newCount} new</span>
              <span className="text-gray-600">·</span>
              <span className={canAfford ? 'text-emerald-400' : 'text-red-400'}>
                {newCount} credit{newCount !== 1 ? 's' : ''}
              </span>
            </>
          )}
          {newCount === 0 && (
            <span className="text-emerald-400 text-xs">Already unlocked</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onClear}
            className="text-xs text-gray-400 hover:text-white transition-colors px-2 py-1"
          >
            Clear
          </button>
          {newCount > 0 && (
            <button
              onClick={onUnlock}
              disabled={unlocking || !canAfford}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
            >
              <Lock className="w-3.5 h-3.5" />
              {unlocking ? 'Unlocking…' : `Unlock ${newCount}`}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
