// @ts-nocheck
'use client'
import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useVerticalData, safeRender } from '../shared/useVerticalData'
import { VERTICALS } from '@/lib/verticals'
import UnlockBar from '../shared/UnlockBar'
import Drawer, { DrawerField, DrawerSection } from '../shared/Drawer'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { Lock, Search, Download, BookmarkPlus, Factory, AlertTriangle, Wrench, CheckCircle, Gauge, Clock, Zap } from 'lucide-react'
import type { ReactNode } from 'react'

const vertical = VERTICALS.industrialintel
const STATUS_COLORS: Record<string,string> = { normal:'#10b981', watch:'#f59e0b', critical:'#ef4444', offline:'#dc2626', maintenance:'#6b7280' }
function oeeColor(v: number) { return v >= 80 ? '#10b981' : v >= 60 ? '#f59e0b' : '#ef4444' }
function statusBg(row: Record<string,unknown>) { return STATUS_COLORS[String(row.operational_status||row.status||'normal')]||'#6b7280' }

export default function IndustrialIntelDashboard() {
  const [userId, setUserId] = useState<string|undefined>()
  useEffect(() => { supabase.auth.getUser().then(({data}) => setUserId(data.user?.id)) }, [])
  const d = useVerticalData(vertical, userId)
  const [search, setSearch] = useState('')
  const [segment, setSegment] = useState<'all'|'normal'|'watch'|'critical'>('all')
  const [sort, setSort] = useState<'oee'|'downtime'|'name'>('oee')
  const [savedViews, setSavedViews] = useState<{name:string;segment:string;search:string}[]>([])
  const [saveViewName, setSaveViewName] = useState('')
  useEffect(() => { try { const sv = localStorage.getItem('vm-sv-industrialintel'); if (sv) setSavedViews(JSON.parse(sv)) } catch {} }, [])

  const filtered = useMemo(() => {
    let rows = d.rows
    if (search) rows = rows.filter(r => String(r.facility_name||'').toLowerCase().includes(search.toLowerCase()) || String(r.location||r.region||'').toLowerCase().includes(search.toLowerCase()))
    if (segment === 'normal') rows = rows.filter(r => (r.operational_status||r.status) === 'normal')
    else if (segment === 'watch') rows = rows.filter(r => (r.operational_status||r.status) === 'watch')
    else if (segment === 'critical') rows = rows.filter(r => (r.operational_status||r.status) === 'critical')
    return [...rows].sort((a,b) => {
      if (sort === 'oee') return (Number(b.oee||b.overall_equipment_effectiveness||0)) - (Number(a.oee||a.overall_equipment_effectiveness||0))
      if (sort === 'downtime') return (Number(b.downtime_hours||b.downtime||0)) - (Number(a.downtime_hours||a.downtime||0))
      return String(a.facility_name||'').localeCompare(String(b.facility_name||''))
    })
  }, [d.rows, search, segment, sort])

  const avgOEE = useMemo(() => { const vals = d.rows.map(r => Number(r.oee||r.overall_equipment_effectiveness||0)).filter(n=>n>0); return vals.length ? (vals.reduce((s,n)=>s+n,0)/vals.length).toFixed(1) : '0' }, [d.rows])
  const criticalCount = useMemo(() => d.rows.filter(r => (r.operational_status||r.status) === 'critical').length, [d.rows])
  const totalDowntime = useMemo(() => d.rows.reduce((s,r) => s + Number(r.downtime_hours||r.downtime||0), 0).toFixed(0), [d.rows])
  const alerts = useMemo(() => [...d.rows].filter(r => r.maintenance_due === true || r.maintenance_status === 'due' || Number(r.downtime_hours||0) > 8).sort((a,b) => Number(b.downtime_hours||0) - Number(a.downtime_hours||0)).slice(0,6), [d.rows])
  const downtimeData = useMemo(() => [...d.rows].sort((a,b) => Number(b.downtime_hours||0)-Number(a.downtime_hours||0)).slice(0,7).map(r => ({ name: String(r.facility_name||'?').substring(0,12), hours: Number(r.downtime_hours||r.downtime||0) })), [d.rows])
  const insights = useMemo(() => { if (!d.rows.length) return []; return [`Avg OEE ${avgOEE}% across ${d.rows.length} facilities`, criticalCount > 0 ? `${criticalCount} critical facilities need attention` : null, alerts.length > 0 ? `${alerts.length} maintenance alerts pending` : null].filter(Boolean) as string[] }, [d.rows, avgOEE, criticalCount, alerts])

  function OEEGauge({ value }: { value: number }) {
    const pct = Math.min(100, Math.max(0, value)) / 100
    const cx = 90, cy = 78, r = 62
    const angle = pct * 180 - 90; const rad = angle * (Math.PI / 180)
    const x = cx + r * Math.cos(rad), y = cy + r * Math.sin(rad)
    const color = oeeColor(value)
    return <svg viewBox="0 0 180 95" className="w-full h-24">
      <path d="M28 78 A 62 62 0 0 1 152 78" fill="none" stroke="#f3f4f6" strokeWidth={13} strokeLinecap="round"/>
      <path d="M28 78 A 62 62 0 0 1 152 78" fill="none" stroke={color} strokeWidth={13} strokeLinecap="round" strokeDasharray={`${pct*195} 195`}/>
      <line x1={cx} y1={cy} x2={x} y2={y} stroke={color} strokeWidth={2.5} strokeLinecap="round"/>
      <circle cx={cx} cy={cy} r={5} fill={color}/>
      <text x={cx} y={cy+13} textAnchor="middle" fontSize={18} fontWeight="bold" fill={color}>{value}%</text>
      <text x={cx} y={cy+26} textAnchor="middle" fontSize={8} fill="#9ca3af">AVG OEE</text>
    </svg>
  }

  function saveView() { if (!saveViewName.trim()) return; const nv = [...savedViews, {name:saveViewName,segment,search}]; setSavedViews(nv); localStorage.setItem('vm-sv-industrialintel', JSON.stringify(nv)); setSaveViewName('') }
  function exportCSV() { const rows = filtered.filter(r => d.unlockedIds.has(String(r.id))); if (!rows.length) return; const cols = ['facility_name','location','oee','operational_status','downtime_hours','capacity_utilization']; const csv = [cols.join(','), ...rows.map(r => cols.map(c => JSON.stringify(safeRender(r[c])??'')).join(','))].join('\n'); const a = document.createElement('a'); a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv); a.download = 'industrialintel-unlocked.csv'; a.click() }

  function tabs(row: Record<string,unknown>, unlocked: boolean): {label:string;content:ReactNode}[] {
    const m = !unlocked
    return [
      { label:'Facility', content:<div className="space-y-5"><DrawerSection title="Facility"><DrawerField label="Name" value={safeRender(row.facility_name)}/><DrawerField label="Location" value={safeRender(row.location||row.region)}/><DrawerField label="Type" value={safeRender(row.facility_type)}/><DrawerField label="Employees" value={safeRender(row.employee_count)}/></DrawerSection></div> },
      { label:'Output', content:<div className="space-y-5"><DrawerSection title="Production"><DrawerField label="OEE" value={safeRender(row.oee)}/><DrawerField label="Capacity" value={safeRender(row.capacity_utilization)}/><DrawerField label="Units/Day" value={safeRender(row.units_per_day)} masked={m}/><DrawerField label="Cycle Time" value={safeRender(row.cycle_time)}/></DrawerSection></div> },
      { label:'Compliance', content:<div className="space-y-5"><DrawerSection title="Regulatory"><DrawerField label="ISO Cert" value={safeRender(row.iso_certification)}/><DrawerField label="OSHA Status" value={safeRender(row.osha_status)}/><DrawerField label="Last Audit" value={safeRender(row.last_audit_date)}/><DrawerField label="Violations" value={safeRender(row.violation_count)} masked={m}/></DrawerSection></div> },
      { label:'Maintenance', content:<div className="space-y-5"><DrawerSection title="Maintenance"><DrawerField label="Downtime (hrs)" value={safeRender(row.downtime_hours||row.downtime)}/><DrawerField label="MTTR" value={safeRender(row.mttr)}/><DrawerField label="Next Maintenance" value={safeRender(row.next_maintenance_date)}/><DrawerField label="Maint. Cost" value={safeRender(row.maintenance_cost)} masked={m}/></DrawerSection></div> },
    ]
  }

  return (
    <div className="h-full bg-gray-50 dark:bg-gray-950 flex flex-col">
      <div className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-6 py-4">
        <div className="flex items-center justify-between mb-3">
          <div><h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">🏭 Operations Console</h1>{insights[0] && <p className="text-xs text-amber-600 mt-0.5 flex items-center gap-1"><Zap className="w-3 h-3"/>{insights[0]}</p>}</div>
          <div className="flex items-center gap-2">
            <button onClick={exportCSV} className="flex items-center gap-1 text-xs border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-1.5 text-gray-600 hover:text-amber-600 hover:border-amber-300 transition-colors"><Download className="w-3 h-3"/>Export</button>
            <div className="flex items-center gap-1"><input value={saveViewName} onChange={e=>setSaveViewName(e.target.value)} placeholder="Save view…" className="text-xs border border-gray-200 dark:border-gray-700 rounded-xl px-2 py-1.5 bg-white dark:bg-gray-800 text-gray-600 placeholder:text-gray-400 outline-none w-24"/><button onClick={saveView} className="p-1.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-500 hover:text-amber-600 hover:border-amber-300 transition-colors"><BookmarkPlus className="w-3.5 h-3.5"/></button></div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search facilities…" className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 placeholder:text-gray-400 outline-none w-44"/></div>
          {(['all','normal','watch','critical'] as const).map(s => <button key={s} onClick={()=>setSegment(s)} className={`flex items-center gap-1 text-xs px-3 py-1 rounded-full font-medium transition-colors capitalize ${segment===s?'bg-amber-600 text-white':'text-gray-500 hover:text-gray-900 dark:hover:text-gray-100'}`}>{s==='normal'&&<CheckCircle className="w-3 h-3"/>}{s==='watch'&&<Clock className="w-3 h-3"/>}{s==='critical'&&<AlertTriangle className="w-3 h-3"/>}{s==='all'?`All (${d.rows.length})`:s}</button>)}
          <select value={sort} onChange={e=>setSort(e.target.value as typeof sort)} className="text-xs border border-gray-200 dark:border-gray-700 rounded-xl px-2 py-1.5 bg-white dark:bg-gray-800 text-gray-600 outline-none ml-auto"><option value="oee">Sort: OEE</option><option value="downtime">Sort: Downtime</option><option value="name">Sort: Name</option></select>
        </div>
        {savedViews.length > 0 && <div className="flex gap-1.5 mt-2 flex-wrap">{savedViews.map((v,i) => <button key={i} onClick={()=>{setSegment(v.segment as typeof segment);setSearch(v.search)}} className="text-xs px-2 py-0.5 bg-amber-50 dark:bg-amber-900/20 text-amber-600 rounded-full border border-amber-100 hover:bg-amber-100 transition-colors">{v.name}</button>)}</div>}
      </div>

      {d.error && <div className="mx-6 mt-4 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-600">{d.error}</div>}

      <div className="flex-1 overflow-hidden flex">
        <div className="w-72 shrink-0 border-r border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-y-auto p-4 space-y-4">
          <div><div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1"><Gauge className="w-3 h-3"/>OEE Gauge</div><OEEGauge value={Number(avgOEE)||0}/></div>
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-2 text-center"><div className="text-lg font-bold text-amber-600">{criticalCount}</div><div className="text-[10px] text-gray-400">Critical</div></div>
            <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-2 text-center"><div className="text-lg font-bold text-red-600">{totalDowntime}h</div><div className="text-[10px] text-gray-400">Downtime</div></div>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-2 text-center"><div className="text-lg font-bold text-gray-600">{alerts.length}</div><div className="text-[10px] text-gray-400">Alerts</div></div>
          </div>
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Downtime by Facility</div>
            {downtimeData.some(d => d.hours > 0) ? <ResponsiveContainer width="100%" height={130}><BarChart data={downtimeData} layout="vertical"><XAxis type="number" tick={{fontSize:9}} axisLine={false} tickLine={false}/><YAxis type="category" dataKey="name" tick={{fontSize:9}} width={70} axisLine={false} tickLine={false}/><Tooltip contentStyle={{fontSize:10,borderRadius:6}} formatter={(v:number)=>`${v}h`}/><Bar dataKey="hours" fill="#ef4444" radius={[0,3,3,0]}/></BarChart></ResponsiveContainer> : <div className="h-28 flex items-center justify-center text-gray-300 dark:text-gray-700 text-xs">No downtime data</div>}
          </div>
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1"><Wrench className="w-3 h-3 text-amber-500"/>Maintenance Alerts</div>
            {alerts.length > 0 ? alerts.map(row => {
              const unlocked = d.unlockedIds.has(String(row.id))
              return <div key={String(row.id)} onClick={()=>d.setDrawerRow(row)} className="flex items-center gap-2 mb-2 p-2 rounded-xl border border-amber-100 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-900/10 cursor-pointer hover:border-amber-300 transition-colors">
                <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0"/>
                <div className="flex-1 min-w-0">{!unlocked&&<Lock className="w-2.5 h-2.5 text-gray-400 inline mr-0.5"/>}<span className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">{safeRender(row.facility_name)||'—'}</span><div className="text-[10px] text-gray-400">{Number(row.downtime_hours||0)>0?`${Number(row.downtime_hours||0)}h downtime`:'Maintenance due'}</div></div>
              </div>
            }) : <div className="flex items-center gap-2 text-xs text-gray-400 p-2"><CheckCircle className="w-4 h-4 text-emerald-400"/>All nominal</div>}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {d.loading ? <div className="p-5 space-y-2">{[...Array(7)].map((_,i) => <div key={i} className="h-12 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse"/>)}</div> : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16"><Factory className="w-10 h-10 text-gray-300 dark:text-gray-700 mb-3"/><div className="text-sm font-medium text-gray-500">No facilities found</div><button onClick={()=>{setSearch('');setSegment('all')}} className="mt-3 text-xs text-amber-600 font-medium">Clear filters</button></div>
          ) : (
            <div className="overflow-x-auto"><table className="w-full text-sm">
              <thead><tr className="bg-gray-50 dark:bg-gray-800/50 sticky top-0 z-10">
                <th className="px-4 py-3 w-8"><input type="checkbox" onChange={e=>e.target.checked?d.selectAll():d.clearSelection()}/></th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Facility</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Location</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">OEE</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Capacity</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Downtime</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
              </tr></thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                {filtered.map(row => {
                  const id = String(row.id); const unlocked = d.unlockedIds.has(id); const selected = d.selectedIds.has(id)
                  const oee = Number(row.oee||row.overall_equipment_effectiveness||0); const sc = statusBg(row)
                  const st = String(row.operational_status||row.status||'normal')
                  return <tr key={id} onClick={()=>d.setDrawerRow(row)} className={`cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors ${selected?'bg-amber-50/50 dark:bg-amber-900/10':''} ${st==='critical'?'border-l-2 border-red-400':''}`}>
                    <td className="px-4 py-3" onClick={e=>{e.stopPropagation();d.toggleSelect(id)}}><input type="checkbox" checked={selected} onChange={()=>d.toggleSelect(id)}/></td>
                    <td className="px-4 py-3"><div className="flex items-center gap-1.5">{!unlocked&&<Lock className="w-3 h-3 text-gray-400 shrink-0"/>}<span className="font-medium text-gray-900 dark:text-gray-100">{safeRender(row.facility_name)||'—'}</span>{unlocked&&<span className="text-[10px] text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 px-1 rounded-full">✓</span>}</div></td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{safeRender(row.location||row.region)||'—'}</td>
                    <td className="px-4 py-3"><div className="flex items-center gap-1.5"><div className="w-10 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden"><div className="h-full rounded-full" style={{width:`${oee}%`,background:oeeColor(oee)}}/></div><span className="text-xs font-bold" style={{color:oeeColor(oee)}}>{oee}%</span></div></td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400 text-xs">{safeRender(row.capacity_utilization)||'—'}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400 text-xs">{safeRender(row.downtime_hours||row.downtime)||'0'}h</td>
                    <td className="px-4 py-3"><span className="text-[10px] px-2 py-0.5 rounded-full font-medium capitalize" style={{background:sc+'20',color:sc}}>{st}</span></td>
                  </tr>
                })}
              </tbody>
            </table></div>
          )}
        </div>
      </div>

      <UnlockBar selectedCount={d.selectedIds.size} newCount={Array.from(d.selectedIds).filter(id=>!d.unlockedIds.has(id)).length} unlocking={d.unlocking} creditBalance={d.creditBalance} onUnlock={d.handleUnlock} onClear={d.clearSelection}/>
      {d.drawerRow && <Drawer open={!!d.drawerRow} onClose={()=>d.setDrawerRow(null)} title={String(d.drawerRow.facility_name??'—')} isUnlocked={d.unlockedIds.has(String(d.drawerRow.id))} onUnlock={()=>{d.toggleSelect(String(d.drawerRow!.id));d.handleUnlock()}} unlocking={d.unlocking} tabs={tabs(d.drawerRow, d.unlockedIds.has(String(d.drawerRow.id)))}/>}
    </div>
  )
}
