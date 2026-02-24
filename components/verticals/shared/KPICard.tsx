// @ts-nocheck
import type { ReactNode } from 'react'

interface KPICardProps {
  label: string
  value: ReactNode
  sub?: ReactNode
  icon?: ReactNode
  trend?: 'up' | 'down' | 'neutral'
  accentColor?: string
}

export default function KPICard({ label, value, sub, icon, trend }: KPICardProps) {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5 flex flex-col gap-2 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{label}</span>
        {icon && <span className="text-gray-400">{icon}</span>}
      </div>
      <div className="text-2xl font-bold text-gray-900 dark:text-gray-100 leading-none">{value}</div>
      {sub && (
        <div className={`text-xs flex items-center gap-1 ${
          trend === 'up' ? 'text-emerald-600' :
          trend === 'down' ? 'text-red-500' :
          'text-gray-500 dark:text-gray-400'
        }`}>
          {trend === 'up' && '↑'}
          {trend === 'down' && '↓'}
          {sub}
        </div>
      )}
    </div>
  )
}
