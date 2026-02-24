// @ts-nocheck
'use client'

import dynamic from 'next/dynamic'
import { VERTICALS } from '@/lib/verticals'

function LoadingSkeleton() {
  return (
    <div className="p-6 space-y-6 animate-pulse">
      <div className="grid grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-28 rounded-2xl bg-gray-100 dark:bg-gray-800" />
        ))}
      </div>
      <div className="h-64 rounded-2xl bg-gray-100 dark:bg-gray-800" />
      <div className="h-96 rounded-2xl bg-gray-100 dark:bg-gray-800" />
    </div>
  )
}

const dashboards: Record<string, React.ComponentType> = {
  dealflow: dynamic(() => import('./dealflow/Dashboard'), { loading: () => <LoadingSkeleton /> }),
  salesintel: dynamic(() => import('./salesintel/Dashboard'), { loading: () => <LoadingSkeleton /> }),
  supplyintel: dynamic(() => import('./supplyintel/Dashboard'), { loading: () => <LoadingSkeleton /> }),
  clinicalintel: dynamic(() => import('./clinicalintel/Dashboard'), { loading: () => <LoadingSkeleton /> }),
  legalintel: dynamic(() => import('./legalintel/Dashboard'), { loading: () => <LoadingSkeleton /> }),
  marketresearch: dynamic(() => import('./marketresearch/Dashboard'), { loading: () => <LoadingSkeleton /> }),
  academicintel: dynamic(() => import('./academicintel/Dashboard'), { loading: () => <LoadingSkeleton /> }),
  creatorintel: dynamic(() => import('./creatorintel/Dashboard'), { loading: () => <LoadingSkeleton /> }),
  gamingintel: dynamic(() => import('./gamingintel/Dashboard'), { loading: () => <LoadingSkeleton /> }),
  realestateintel: dynamic(() => import('./realestateintel/Dashboard'), { loading: () => <LoadingSkeleton /> }),
  privatecreditintel: dynamic(() => import('./privatecreditintel/Dashboard'), { loading: () => <LoadingSkeleton /> }),
  cyberintel: dynamic(() => import('./cyberintel/Dashboard'), { loading: () => <LoadingSkeleton /> }),
  biopharmintel: dynamic(() => import('./biopharmintel/Dashboard'), { loading: () => <LoadingSkeleton /> }),
  industrialintel: dynamic(() => import('./industrialintel/Dashboard'), { loading: () => <LoadingSkeleton /> }),
  govintel: dynamic(() => import('./govintel/Dashboard'), { loading: () => <LoadingSkeleton /> }),
  insuranceintel: dynamic(() => import('./insuranceintel/Dashboard'), { loading: () => <LoadingSkeleton /> }),
}

export default function VerticalRenderer({ verticalKey }: { verticalKey: string }) {
  const validKey = VERTICALS[verticalKey] ? verticalKey : 'dealflow'
  const Dashboard = dashboards[validKey] ?? dashboards['dealflow']
  return <Dashboard />
}
