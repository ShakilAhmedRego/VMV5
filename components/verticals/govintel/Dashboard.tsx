// @ts-nocheck
'use client'
import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useVerticalData, safeRender } from '../shared/useVerticalData'
import { VERTICALS } from '@/lib/verticals'
import UnlockBar from '../shared/UnlockBar'
import Drawer, { DrawerField, DrawerSection } from '../shared/Drawer'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { Lock, Search, Download, BookmarkPlus, Building2, Clock, AlertTriangle, CheckCircle, Zap, Flag, Timer } from 'lucide-react'
import type { ReactNode } from 'react'

const vertical = VERTICALS.govintel

function daysUntil(dateStr: unknown): number {
  if (!dateStr) return 999
  const d = new Date(String(dateStr))
  if (isNaN(d.getTime())) return 999
  return Math.ceil((d.getTime() - Date.now()) / 86400000)
}
function urgencyLevel(days: number): 'urgent' | 'soon' | 'later' {
  if (days <= 7) return 'urgent'
  if (days <= 30) return 'soon'
  return 'later'
}
const URGENCY_COLORS = { urgent: '#dc2626', soon: '#f59e0b', later: '#6b7280' }

export default function GovIntelDashboard() {
  const [userId, setUserId] = useState<string|undefined>()
  useEffect(() => { supabase.auth.getUser().then(({data}) => setUserId(data.user?.id)) }, [])
  const d = useVerticalData(vertical, userId)
  const [search, setSearch] = useState('')
  const [segment, setSegment] = useState<'all'|'urgent'|'soon'|'later'>('all')
  const [agencyFilter, setAgencyFilter] = useState<string>('all')
  const [sort, setSort] = useState<'deadline'|'value'|'title'>('deadline')
  const [savedViews, setSavedViews] = useState<{name:string;segment:string;agency:string;search:string}[]>([])
  const [saveViewName, setSaveViewName] = useState('')
  useEffect(() => { try { const sv = localStorage.getItem('vm-sv-govintel'); if (sv) setSavedViews(JSON.parse(sv)) } catch {} }, [])

  const agencies = useMemo(() => ['all', ...Array.from(new Set(d.rows.map(r => String(r.agency||r.issuing_agency||'')).filter(Boolean))).slice(0,8)], [d.rows])

  const filtered = useMemo(() => {
    let rows = d.rows.map(r => ({ ...r, _days: daysUntil(r.deadline_date||r.due_date||r.close_date), _urgency: urgencyLevel(daysUntil(r.deadline_date||r.due_date||r.close_date)) }))
    if (search) rows = rows.filter(r => String(r.opportunity_title||'').toLowerCase().includes(search.toLowerCase()) || String(r.agency||r.issuing_agency||'').toLowerCase().includes(search.toLowerCase()))
    if (agencyFilter !== 'all') rows = rows.filter(r => r.agency === agencyFilter || r.issuing_agency === agencyFilter)
    if (segment !== 'all') rows = rows.filter(r => r._urgency === segment)
    return [...rows].sort((a,b) => {
      if (sort === 'deadline') return (a._days as number) - (b._days as number)
      if (sort === 'value') return (Number(b.contract_value||b.estimated_value||0)) - (Number(a.contract_value||a.estimated_value||0))
      return String(a.opportunity_title||'').localeCompare(String(b.opportunity_title||''))
    })
  }, [d.rows, search, segment, agencyFilter, sort])

  const urgentCount = useMemo(() => d.rows.filter(r => daysUntil(r.deadline_date||r.due_date||r.close_date) <= 7).length, [d.rows])
  const soonCount = useMemo(() => d.rows.filter(r => { const days = daysUntil(r.deadline_date||r.due_date||r.close_date); return days > 7 && days <= 30 }).length, [d.rows])
  const totalValue = useMemo(() => d.rows.reduce((s,r) => s + Number(r.contract_value||r.estimated_value||0), 0), [d.rows])
  const agencySpend = useMemo(() => Array.from(d.rows.reduce((m,r) => { const a = String(r.agency||r.issuing_agency||'Unknown').substring(0,14); m.set(a,(m.get(a)||0)+Number(r.contract_value||r.estimated_value||0)); return m }, new Map<string,number>())).map(([agency,value]) => ({agency,value})).sort((a,b) => b.value-a.value).slice(0,7), [d.rows])
  const next7Days = useMemo(() => filtered.filter(r => (r._days as number) <= 7).slice(0,5), [filtered])
  const insights = useMemo(() => { if (!d.rows.length) return []; const fmt = (n:number) => n>=1e9?`$${(n/1e9).toFixed(1)}B`:n>=1e6?`$${(n/1e6).toFixed(0)}M`:`$${n}`; return [urgentCount > 0 ? `${urgentCount} opportunities close within 7 days` : null, `$${totalValue>=1e9?(totalValue/1e9).toFixed(1)+'B':totalValue>=1e6?(totalValue/1e6).toFixed(0)+'M':totalValue} total contract value tracked`, `${agencies.length-1} agencies monitored`].filter(Boolean) as string[] }, [d.rows, urgentCount, totalValue, agencies])

  function saveView() { if (!saveViewName.trim()) return; const nv = [...savedViews,{name:saveViewName,segment,agency:agencyFilter,search}]; setSavedViews(nv); localStorage.setItem('vm-sv-govintel',JSON.stringify(nv)); setSaveViewName('') }
  function exportCSV() { const rows = filtered.filter(r => d.unlockedIds.has(String(r.id))); if (!rows.length) return; const cols = ['opportunity_title','agency','deadline_date','contract_value','naics_code','set_aside']; const csv = [cols.join(','),...rows.map(r => cols.map(c => JSON.stringify(safeRender(r[c])??'')).join(','))].join('\n'); const a = document.createElement('a'); a.href = 'data:text/csv;charset=utf-8,'+encodeURIComponent(csv); a.download = 'govintel-unlocked.csv'; a.click() }
  function fmtVal(n: number) { if (n >= 1e9) return `$${(n/1e9).toFixed(1)}B`; if (n >= 1e6) return `$${(n/1e6).toFixed(0)}M`; if (n >= 1e3) return `$${(n/1e3).toFixed(0)}K`; return n > 0 ? `$${n}` : '—' }

  function tabs(row: Record<string,unknown>, unlocked: boolean): {label:string;content:ReactNode}[] {
    const m = !unlocked
    return [
      { label:'RFP', content:<div className="space-y-5"><DrawerSection title="Opportunity"><DrawerField label="Title" value={safeRender(row.opportunity_title)}/><DrawerField label="Type" value={safeRender(row.opportunity_type)}/><DrawerField label="NAICS Code" value={safeRender(row.naics_code)}/><DrawerField label="Set-Aside" value={safeRender(row.set_aside)}/></DrawerSection></div> },
      { label:'Agency', content:<div className="space-y-5"><DrawerSection title="Issuing Agency"><DrawerField label="Agency" value={safeRender(row.agency||row.issuing_agency)}/><DrawerField label="Office" value={safeRender(row.office)}/><DrawerField label="Contact Name" value={safeRender(row.contact_name)} masked={m}/><DrawerField label="Contact Email" value={safeRender(row.contact_email)} masked={m}/></DrawerSection></div> },
      { label:'Budget', content:<div className="space-y-5"><DrawerSection title="Contract Value"><DrawerField label="Estimated Value" value={safeRender(row.contract_value||row.estimated_value)}/><DrawerField label="Award Type" value={safeRender(row.award_type)}/><DrawerField label="Incumbent" value={safeRender(row.incumbent)} masked={m}/><DrawerField label="Budget Account" value={safeRender(row.budget_account)} masked={m}/></DrawerSection></div> },
      { label:'Timeline', content:<div className="space-y-5"><DrawerSection title="Dates"><DrawerField label="Posted Date" value={safeRender(row.posted_date)}/><DrawerField label="Close/Deadline" value={safeRender(row.deadline_date||row.due_date||row.close_date)}/><DrawerField label="Award Date" value={safeRender(row.award_date)}/><DrawerField label="Period of Performance" value={safeRender(row.period_of_performance)}/></DrawerSection></div> },
    ]
  }

  return (
    <div className="h-full bg-gray-50 dark:bg-gray-950 flex flex-col">
      {/* Urgency command header */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-6 py-4">
        <div className="flex items-center justify-between mb-3">
          <div><h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">🏛️ Deadline Command Center</h1>{insights[0] && <p className="text-xs text-blue-600 mt-0.5 flex items-center gap-1"><Zap className="w-3 h-3"/>{insights[0]}</p>}</div>
          <div className="flex items-center gap-2">
            <button onClick={exportCSV} className="flex items-center gap-1 text-xs border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-1.5 text-gray-600 hover:text-blue-600 hover:border-blue-300 transition-colors"><Download className="w-3 h-3"/>Export</button>
            <div className="flex items-center gap-1"><input value={saveViewName} onChange={e=>setSaveViewName(e.target.value)} placeholder="Save view…" className="text-xs border border-gray-200 dark:border-gray-700 rounded-xl px-2 py-1.5 bg-white dark:bg-gray-800 text-gray-600 placeholder:text-gray-400 outline-none w-24"/><button onClick={saveView} className="p-1.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-500 hover:text-blue-600 hover:border-blue-300 transition-colors"><BookmarkPlus className="w-3.5 h-3.5"/></button></div>
          </div>
        </div>
        {/* Next 7 days countdown chips */}
        {next7Days.length > 0 && (
          <div className="flex gap-2 flex-wrap mb-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/50 rounded-xl">
            <div className="flex items-center gap-1 w-full mb-1"><Timer className="w-3.5 h-3.5 text-red-500"/><span className="text-xs font-semibold text-red-700 dark:text-red-400">Closing within 7 days:</span></div>
            {next7Days.map(row => {
              const days = row._days as number
              const id = String(row.id); const unlocked = d.unlockedIds.has(id)
              return <div key={id} onClick={()=>d.setDrawerRow(row)} className="flex items-center gap-2 bg-white dark:bg-gray-900 border border-red-200 dark:border-red-800 rounded-xl px-3 py-1.5 cursor-pointer hover:border-red-400 hover:shadow-sm transition-all">
                {!unlocked && <Lock className="w-3 h-3 text-gray-400 shrink-0"/>}
                <span className="text-xs font-medium text-gray-800 dark:text-gray-200 max-w-[180px] truncate">{safeRender(row.opportunity_title)||'—'}</span>
                <span className="text-xs font-bold text-red-600 shrink-0">{days === 0 ? 'TODAY' : `${days}d`}</span>
              </div>
            })}
          </div>
        )}
        {/* Filter row */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search opportunities…" className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 placeholder:text-gray-400 outline-none w-52"/></div>
          {(['all','urgent','soon','later'] as const).map(s => <button key={s} onClick={()=>setSegment(s)} className={`flex items-center gap-1 text-xs px-3 py-1 rounded-full font-medium transition-colors capitalize ${segment===s?'bg-blue-700 text-white':'text-gray-500 hover:text-gray-900 dark:hover:text-gray-100'}`}>{s==='urgent'&&<AlertTriangle className="w-3 h-3 text-red-400"/>}{s==='soon'&&<Clock className="w-3 h-3 text-amber-400"/>}{s==='later'&&<CheckCircle className="w-3 h-3 text-gray-400"/>}{s==='all'?`All (${d.rows.length})`:s==='urgent'?`Urgent ≤7d (${urgentCount})`:s==='soon'?`Soon 8-30d (${soonCount})`:'Later'}</button>)}
          <select value={agencyFilter} onChange={e=>setAgencyFilter(e.target.value)} className="text-xs border border-gray-200 dark:border-gray-700 rounded-xl px-2 py-1.5 bg-white dark:bg-gray-800 text-gray-600 outline-none">
            <option value="all">All Agencies</option>{agencies.slice(1).map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <select value={sort} onChange={e=>setSort(e.target.value as typeof sort)} className="text-xs border border-gray-200 dark:border-gray-700 rounded-xl px-2 py-1.5 bg-white dark:bg-gray-800 text-gray-600 outline-none ml-auto"><option value="deadline">Sort: Deadline</option><option value="value">Sort: Value</option><option value="title">Sort: Title</option></select>
        </div>
        {savedViews.length > 0 && <div className="flex gap-1.5 mt-2 flex-wrap">{savedViews.map((v,i) => <button key={i} onClick={()=>{setSegment(v.segment as typeof segment);setAgencyFilter(v.agency);setSearch(v.search)}} className="text-xs px-2 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-full border border-blue-100 hover:bg-blue-100 transition-colors">{v.name}</button>)}</div>}
      </div>

      {d.error && <div className="mx-6 mt-4 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-600">{d.error}</div>}

      <div className="flex-1 overflow-hidden flex">
        {/* Main — urgency list */}
        <div className="flex-1 overflow-y-auto">
          {d.loading ? (<div className="p-5 space-y-2">{[...Array(8)].map((_,i) => <div key={i} className="h-20 rounded-2xl bg-gray-100 dark:bg-gray-800 animate-pulse"/>)}</div>) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16"><Building2 className="w-10 h-10 text-gray-300 dark:text-gray-700 mb-3"/><div className="text-sm font-medium text-gray-500">No opportunities found</div><button onClick={()=>{setSearch('');setSegment('all');setAgencyFilter('all')}} className="mt-3 text-xs text-blue-600 font-medium">Clear filters</button></div>
          ) : filtered.map(row => {
            const id = String(row.id); const unlocked = d.unlockedIds.has(id); const selected = d.selectedIds.has(id)
            const days = row._days as number; const urg = row._urgency as string
            const urgColor = URGENCY_COLORS[urg as keyof typeof URGENCY_COLORS] || '#6b7280'
            const value = Number(row.contract_value||row.estimated_value||0)
            return <div key={id} onClick={()=>d.setDrawerRow(row)} className={`flex items-start gap-3 px-5 py-4 border-b border-gray-50 dark:border-gray-800 hover:bg-white dark:hover:bg-gray-900 cursor-pointer transition-colors group ${selected?'bg-blue-50/50 dark:bg-blue-900/10':''}`}>
              <div onClick={e=>{e.stopPropagation();d.toggleSelect(id)}} className="shrink-0 mt-0.5"><input type="checkbox" checked={selected} onChange={()=>d.toggleSelect(id)} className="rounded"/></div>
              {/* Days badge */}
              <div className="shrink-0 w-14 flex flex-col items-center justify-center rounded-xl py-2" style={{background:urgColor+'15',border:`1px solid ${urgColor}30`}}>
                <span className="text-lg font-black" style={{color:urgColor}}>{days >= 999 ? '—' : days}</span>
                <span className="text-[9px] font-medium uppercase" style={{color:urgColor}}>{days >= 999 ? 'N/A' : days === 0 ? 'TODAY' : days === 1 ? 'DAY' : 'DAYS'}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {!unlocked && <Lock className="w-3 h-3 text-gray-400 shrink-0"/>}
                  <span className="font-semibold text-sm text-gray-900 dark:text-gray-100 leading-snug">{safeRender(row.opportunity_title)||'—'}</span>
                  {unlocked && <span className="text-[10px] text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded-full">✓</span>}
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium capitalize" style={{background:urgColor+'20',color:urgColor}}>{urg}</span>
                </div>
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  <span className="text-xs text-gray-500 flex items-center gap-0.5"><Building2 className="w-3 h-3"/>{safeRender(row.agency||row.issuing_agency)||'—'}</span>
                  {value > 0 && <span className="text-xs font-semibold text-blue-600">{fmtVal(value)}</span>}
                  {!!row.naics_code && <span className="text-xs text-gray-400">NAICS: {safeRender(row.naics_code)}</span>}
                  {!!row.set_aside && <span className="text-xs px-1.5 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-full">{safeRender(row.set_aside)}</span>}
                </div>
                {row.deadline_date||row.due_date||row.close_date ? <div className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-0.5"><Clock className="w-2.5 h-2.5"/>Closes: {safeRender(row.deadline_date||row.due_date||row.close_date)}</div> : null}
              </div>
            </div>
          })}
        </div>

        {/* Right — agency spend + summary */}
        <div className="w-64 shrink-0 border-l border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-y-auto p-4 space-y-5">
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Agency Pipeline ($)</div>
            {agencySpend.length > 0 && agencySpend.some(a => a.value > 0) ? <ResponsiveContainer width="100%" height={170}><BarChart data={agencySpend} layout="vertical"><XAxis type="number" tick={{fontSize:9}} axisLine={false} tickLine={false} tickFormatter={(v:number)=>v>=1e6?`$${(v/1e6).toFixed(0)}M`:v>=1e3?`$${(v/1e3).toFixed(0)}K`:`$${v}`}/><YAxis type="category" dataKey="agency" tick={{fontSize:9}} width={80} axisLine={false} tickLine={false}/><Tooltip contentStyle={{fontSize:10,borderRadius:6}} formatter={(v:number)=>fmtVal(v)}/><Bar dataKey="value" fill="#1d4ed8" radius={[0,3,3,0]}>{agencySpend.map((_,i)=><Cell key={i} fill={`hsl(${220+i*10},70%,${55-i*4}%)`}/>)}</Bar></BarChart></ResponsiveContainer> : <div className="h-36 flex items-center justify-center text-gray-300 dark:text-gray-700 text-xs">No value data available</div>}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-2.5 text-center"><div className="text-xl font-bold text-red-600">{urgentCount}</div><div className="text-[10px] text-gray-400">Urgent (≤7d)</div></div>
            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-2.5 text-center"><div className="text-xl font-bold text-amber-600">{soonCount}</div><div className="text-[10px] text-gray-400">Soon (8-30d)</div></div>
            <div className="col-span-2 bg-blue-50 dark:bg-blue-900/20 rounded-xl p-2.5 text-center"><div className="text-xl font-bold text-blue-600">{totalValue>=1e9?`$${(totalValue/1e9).toFixed(1)}B`:totalValue>=1e6?`$${(totalValue/1e6).toFixed(0)}M`:'—'}</div><div className="text-[10px] text-gray-400">Total Pipeline Value</div></div>
          </div>
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Insights</div>
            {insights.map((ins,i) => <div key={i} className="flex items-start gap-1.5 mb-2"><Flag className="w-3 h-3 text-blue-500 mt-0.5 shrink-0"/><span className="text-xs text-gray-500">{ins}</span></div>)}
          </div>
        </div>
      </div>

      <UnlockBar selectedCount={d.selectedIds.size} newCount={Array.from(d.selectedIds).filter(id=>!d.unlockedIds.has(id)).length} unlocking={d.unlocking} creditBalance={d.creditBalance} onUnlock={d.handleUnlock} onClear={d.clearSelection}/>
      {d.drawerRow && <Drawer open={!!d.drawerRow} onClose={()=>d.setDrawerRow(null)} title={String(d.drawerRow.opportunity_title??'—')} isUnlocked={d.unlockedIds.has(String(d.drawerRow.id))} onUnlock={()=>{d.toggleSelect(String(d.drawerRow!.id));d.handleUnlock()}} unlocking={d.unlocking} tabs={tabs(d.drawerRow, d.unlockedIds.has(String(d.drawerRow.id)))}/>}
    </div>
  )
}
