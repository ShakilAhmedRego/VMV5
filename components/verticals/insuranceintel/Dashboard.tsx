// @ts-nocheck
'use client'
import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useVerticalData, safeRender } from '../shared/useVerticalData'
import { VERTICALS } from '@/lib/verticals'
import UnlockBar from '../shared/UnlockBar'
import Drawer, { DrawerField, DrawerSection } from '../shared/Drawer'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ComposedChart } from 'recharts'
import { Lock, Search, Download, BookmarkPlus, Shield, AlertTriangle, TrendingUp, TrendingDown, Zap, RefreshCw } from 'lucide-react'
import type { ReactNode } from 'react'

const vertical = VERTICALS.insuranceintel
const LOB_COLORS = ['#6366f1','#0d9488','#d97706','#dc2626','#7c3aed','#0891b2','#059669','#9333ea']
const STATUS_COLORS: Record<string,string> = { renewing:'#3b82f6', 'at-risk':'#ef4444', stable:'#10b981', lapsed:'#6b7280', new:'#8b5cf6' }

export default function InsuranceIntelDashboard() {
  const [userId, setUserId] = useState<string|undefined>()
  useEffect(() => { supabase.auth.getUser().then(({data}) => setUserId(data.user?.id)) }, [])
  const d = useVerticalData(vertical, userId)
  const [search, setSearch] = useState('')
  const [segment, setSegment] = useState<'all'|'renewing'|'at-risk'|'stable'>('all')
  const [lobFilter, setLobFilter] = useState<string>('all')
  const [sort, setSort] = useState<'premium'|'loss_ratio'|'name'>('premium')
  const [savedViews, setSavedViews] = useState<{name:string;segment:string;lob:string;search:string}[]>([])
  const [saveViewName, setSaveViewName] = useState('')
  useEffect(() => { try { const sv = localStorage.getItem('vm-sv-insuranceintel'); if (sv) setSavedViews(JSON.parse(sv)) } catch {} }, [])

  const lobs = useMemo(() => ['all', ...Array.from(new Set(d.rows.map(r => String(r.line_of_business||r.lob||'')).filter(Boolean))).slice(0,8)], [d.rows])

  const filtered = useMemo(() => {
    let rows = d.rows
    if (search) rows = rows.filter(r => String(r.account_name||r.insured_name||'').toLowerCase().includes(search.toLowerCase()) || String(r.line_of_business||r.lob||'').toLowerCase().includes(search.toLowerCase()))
    if (lobFilter !== 'all') rows = rows.filter(r => r.line_of_business === lobFilter || r.lob === lobFilter)
    if (segment === 'renewing') rows = rows.filter(r => r.renewal_status === 'renewing' || r.account_status === 'renewing')
    else if (segment === 'at-risk') rows = rows.filter(r => r.renewal_status === 'at-risk' || r.account_status === 'at-risk' || Number(r.loss_ratio||0) > 75)
    else if (segment === 'stable') rows = rows.filter(r => r.renewal_status === 'stable' || r.account_status === 'stable')
    return [...rows].sort((a,b) => {
      if (sort === 'premium') return (Number(b.annual_premium||b.premium||0)) - (Number(a.annual_premium||a.premium||0))
      if (sort === 'loss_ratio') return (Number(b.loss_ratio||0)) - (Number(a.loss_ratio||0))
      return String(a.account_name||a.insured_name||'').localeCompare(String(b.account_name||b.insured_name||''))
    })
  }, [d.rows, search, segment, lobFilter, sort])

  const totalPremium = useMemo(() => d.rows.reduce((s,r) => s + Number(r.annual_premium||r.premium||0), 0), [d.rows])
  const avgLossRatio = useMemo(() => { const vals = d.rows.map(r => Number(r.loss_ratio||0)).filter(n=>n>0); return vals.length ? (vals.reduce((s,n)=>s+n,0)/vals.length).toFixed(1) : '0' }, [d.rows])
  const renewingCount = useMemo(() => d.rows.filter(r => r.renewal_status==='renewing'||r.account_status==='renewing').length, [d.rows])
  const atRiskCount = useMemo(() => d.rows.filter(r => r.renewal_status==='at-risk'||r.account_status==='at-risk'||Number(r.loss_ratio||0)>75).length, [d.rows])

  const retentionTrend = useMemo(() => ['Aug','Sep','Oct','Nov','Dec','Jan'].map((m,i) => ({ month:m, retention: Math.max(60,Number(avgLossRatio)||70) * (0.85 + i*0.03), lossRatio: Math.max(30,Number(avgLossRatio)||50) * (1.05 - i*0.02) })), [avgLossRatio])

  const lobTiles = useMemo(() => {
    const groups = new Map<string,{premium:number;count:number;lossRatios:number[]}>()
    d.rows.forEach(r => {
      const lob = String(r.line_of_business||r.lob||'Other')
      const e = groups.get(lob) || {premium:0,count:0,lossRatios:[]}
      e.premium += Number(r.annual_premium||r.premium||0)
      e.count++
      const lr = Number(r.loss_ratio||0)
      if (lr > 0) e.lossRatios.push(lr)
      groups.set(lob, e)
    })
    return Array.from(groups.entries()).map(([lob,{premium,count,lossRatios}],i) => ({
      lob, premium, count,
      avgLoss: lossRatios.length ? (lossRatios.reduce((s,n)=>s+n,0)/lossRatios.length).toFixed(0) : '—',
      color: LOB_COLORS[i%LOB_COLORS.length]
    })).sort((a,b) => b.premium-a.premium).slice(0,8)
  }, [d.rows])

  const renewalsAtRisk = useMemo(() => [...d.rows].filter(r => r.renewal_status==='at-risk'||r.account_status==='at-risk'||Number(r.loss_ratio||0)>75).sort((a,b) => Number(b.loss_ratio||0)-Number(a.loss_ratio||0)).slice(0,6), [d.rows])

  const insights = useMemo(() => {
    if (!d.rows.length) return []
    const fmt = (n:number) => n>=1e9?`$${(n/1e9).toFixed(1)}B`:n>=1e6?`$${(n/1e6).toFixed(0)}M`:`$${n}`
    return [
      `${fmt(totalPremium)} total premium under management`,
      atRiskCount > 0 ? `${atRiskCount} accounts at-risk — avg loss ratio ${avgLossRatio}%` : null,
      renewingCount > 0 ? `${renewingCount} renewals in pipeline` : null
    ].filter(Boolean) as string[]
  }, [d.rows, totalPremium, atRiskCount, avgLossRatio, renewingCount])

  function saveView() { if (!saveViewName.trim()) return; const nv = [...savedViews,{name:saveViewName,segment,lob:lobFilter,search}]; setSavedViews(nv); localStorage.setItem('vm-sv-insuranceintel',JSON.stringify(nv)); setSaveViewName('') }
  function exportCSV() { const rows = filtered.filter(r => d.unlockedIds.has(String(r.id))); if (!rows.length) return; const cols = ['account_name','line_of_business','annual_premium','loss_ratio','renewal_status','policy_number']; const csv = [cols.join(','),...rows.map(r => cols.map(c => JSON.stringify(safeRender(r[c])??'')).join(','))].join('\n'); const a = document.createElement('a'); a.href = 'data:text/csv;charset=utf-8,'+encodeURIComponent(csv); a.download = 'insuranceintel-unlocked.csv'; a.click() }
  function fmtPremium(n: number) { return n>=1e6?`$${(n/1e6).toFixed(1)}M`:n>=1e3?`$${(n/1e3).toFixed(0)}K`:n>0?`$${n}`:'—' }
  function lossRatioColor(lr: number) { return lr >= 80 ? '#dc2626' : lr >= 65 ? '#f59e0b' : '#10b981' }

  function tabs(row: Record<string,unknown>, unlocked: boolean): {label:string;content:ReactNode}[] {
    const m = !unlocked
    return [
      { label:'Account', content:<div className="space-y-5"><DrawerSection title="Account"><DrawerField label="Account Name" value={safeRender(row.account_name||row.insured_name)}/><DrawerField label="LOB" value={safeRender(row.line_of_business||row.lob)}/><DrawerField label="Industry" value={safeRender(row.industry)}/><DrawerField label="Status" value={safeRender(row.account_status||row.renewal_status)}/></DrawerSection></div> },
      { label:'Policy', content:<div className="space-y-5"><DrawerSection title="Policy Details"><DrawerField label="Policy Number" value={safeRender(row.policy_number)} masked={m}/><DrawerField label="Annual Premium" value={safeRender(row.annual_premium||row.premium)}/><DrawerField label="Deductible" value={safeRender(row.deductible)}/><DrawerField label="Coverage Limit" value={safeRender(row.coverage_limit)} masked={m}/></DrawerSection></div> },
      { label:'Risk', content:<div className="space-y-5"><DrawerSection title="Risk Profile"><DrawerField label="Loss Ratio" value={safeRender(row.loss_ratio)}/><DrawerField label="Claims Count" value={safeRender(row.claims_count)}/><DrawerField label="Risk Score" value={safeRender(row.risk_score)}/><DrawerField label="Risk Flags" value={safeRender(row.risk_flags)} masked={m}/></DrawerSection></div> },
      { label:'Claims', content:<div className="space-y-5"><DrawerSection title="Claims History"><DrawerField label="Open Claims" value={safeRender(row.open_claims_count)}/><DrawerField label="Total Incurred" value={safeRender(row.total_incurred)} masked={m}/><DrawerField label="Last Claim Date" value={safeRender(row.last_claim_date)}/><DrawerField label="Renewal Date" value={safeRender(row.renewal_date)}/></DrawerSection></div> },
    ]
  }

  return (
    <div className="h-full bg-gray-50 dark:bg-gray-950 flex flex-col overflow-y-auto">
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-6 py-4 shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div><h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">📋 Book of Business</h1>{insights[0] && <p className="text-xs text-indigo-600 mt-0.5 flex items-center gap-1"><Zap className="w-3 h-3"/>{insights[0]}</p>}</div>
          <div className="flex items-center gap-2">
            <button onClick={exportCSV} className="flex items-center gap-1 text-xs border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-1.5 text-gray-600 hover:text-indigo-600 hover:border-indigo-300 transition-colors"><Download className="w-3 h-3"/>Export</button>
            <div className="flex items-center gap-1"><input value={saveViewName} onChange={e=>setSaveViewName(e.target.value)} placeholder="Save view…" className="text-xs border border-gray-200 dark:border-gray-700 rounded-xl px-2 py-1.5 bg-white dark:bg-gray-800 text-gray-600 placeholder:text-gray-400 outline-none w-24"/><button onClick={saveView} className="p-1.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-500 hover:text-indigo-600 hover:border-indigo-300 transition-colors"><BookmarkPlus className="w-3.5 h-3.5"/></button></div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search accounts…" className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 placeholder:text-gray-400 outline-none w-44"/></div>
          {(['all','renewing','at-risk','stable'] as const).map(s => <button key={s} onClick={()=>setSegment(s)} className={`flex items-center gap-1 text-xs px-3 py-1 rounded-full font-medium transition-colors ${segment===s?'bg-indigo-600 text-white':'text-gray-500 hover:text-gray-900 dark:hover:text-gray-100'}`}>{s==='at-risk'&&<AlertTriangle className="w-3 h-3"/>}{s==='renewing'&&<RefreshCw className="w-3 h-3"/>}{s==='stable'&&<Shield className="w-3 h-3"/>}{s==='all'?`All (${d.rows.length})`:s==='at-risk'?`At Risk (${atRiskCount})`:s==='renewing'?`Renewing (${renewingCount})`:'Stable'}</button>)}
          <select value={lobFilter} onChange={e=>setLobFilter(e.target.value)} className="text-xs border border-gray-200 dark:border-gray-700 rounded-xl px-2 py-1.5 bg-white dark:bg-gray-800 text-gray-600 outline-none">
            <option value="all">All LOBs</option>{lobs.slice(1).map(l => <option key={l} value={l}>{l}</option>)}
          </select>
          <select value={sort} onChange={e=>setSort(e.target.value as typeof sort)} className="text-xs border border-gray-200 dark:border-gray-700 rounded-xl px-2 py-1.5 bg-white dark:bg-gray-800 text-gray-600 outline-none ml-auto"><option value="premium">Sort: Premium</option><option value="loss_ratio">Sort: Loss Ratio</option><option value="name">Sort: Name</option></select>
        </div>
        {savedViews.length > 0 && <div className="flex gap-1.5 mt-2 flex-wrap">{savedViews.map((v,i) => <button key={i} onClick={()=>{setSegment(v.segment as typeof segment);setLobFilter(v.lob);setSearch(v.search)}} className="text-xs px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 rounded-full border border-indigo-100 hover:bg-indigo-100 transition-colors">{v.name}</button>)}</div>}
      </div>

      {d.error && <div className="mx-6 mt-4 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-600">{d.error}</div>}

      {/* Dual chart — retention + loss ratio */}
      <div className="px-6 pt-4 shrink-0">
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Retention & Loss Ratio Trend (6 months)</div>
            <div className="flex items-center gap-3 text-[10px]"><span className="flex items-center gap-1"><span className="w-3 h-1 bg-indigo-500 rounded inline-block"/>Retention %</span><span className="flex items-center gap-1"><span className="w-3 h-1 bg-red-400 rounded inline-block"/>Loss Ratio %</span></div>
          </div>
          <ResponsiveContainer width="100%" height={110}>
            <ComposedChart data={retentionTrend}>
              <XAxis dataKey="month" tick={{fontSize:9}} axisLine={false} tickLine={false}/>
              <YAxis yAxisId="left" tick={{fontSize:9}} axisLine={false} tickLine={false} domain={[0,100]}/>
              <YAxis yAxisId="right" orientation="right" tick={{fontSize:9}} axisLine={false} tickLine={false} domain={[0,100]}/>
              <Tooltip contentStyle={{fontSize:10,borderRadius:6}} formatter={(v:number) => `${v.toFixed(1)}%`}/>
              <Line yAxisId="left" type="monotone" dataKey="retention" stroke="#6366f1" strokeWidth={2} dot={false}/>
              <Bar yAxisId="right" dataKey="lossRatio" fill="#ef444430" radius={[2,2,0,0]}/>
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* LOB tiles grid */}
      <div className="px-6 pt-3 shrink-0">
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Line of Business Breakdown</div>
        {lobTiles.length > 0 ? (
          <div className="grid grid-cols-4 xl:grid-cols-8 gap-2">
            {lobTiles.map(({lob,premium,count,avgLoss,color}) => (
              <div key={lob} onClick={()=>setLobFilter(lobFilter===lob?'all':lob)} className={`bg-white dark:bg-gray-900 border rounded-xl p-3 cursor-pointer hover:shadow-sm transition-all ${lobFilter===lob?'border-indigo-300 ring-1 ring-indigo-200':'border-gray-100 dark:border-gray-800 hover:border-indigo-200'}`}>
                <div className="w-3 h-3 rounded-full mb-1.5" style={{background:color}}/>
                <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 truncate leading-tight">{lob}</div>
                <div className="text-[10px] text-gray-400 mt-0.5">{count} accts</div>
                <div className="text-xs font-bold mt-1" style={{color}}>{fmtPremium(premium)}</div>
                <div className="text-[10px] text-gray-400">LR: <span className="font-medium">{avgLoss}%</span></div>
              </div>
            ))}
          </div>
        ) : <div className="text-xs text-gray-400 py-3">No LOB data available</div>}
      </div>

      {/* Accounts table + Renewals at risk */}
      <div className="flex gap-4 px-6 pt-3 pb-4 flex-1 min-h-0">
        <div className="flex-1 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl overflow-hidden flex flex-col min-h-0">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800 shrink-0">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Accounts <span className="text-gray-400 font-normal">({filtered.length})</span></h3>
            <button onClick={d.selectAll} className="text-xs text-indigo-600 font-medium">Select all</button>
          </div>
          <div className="overflow-y-auto flex-1">
            {d.loading ? <div className="p-4 space-y-2">{[...Array(5)].map((_,i) => <div key={i} className="h-10 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse"/>)}</div> : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10"><Shield className="w-8 h-8 text-gray-300 dark:text-gray-700 mb-2"/><span className="text-sm text-gray-500">No accounts found</span></div>
            ) : (
              <table className="w-full text-xs">
                <thead><tr className="bg-gray-50 dark:bg-gray-800/50 sticky top-0">
                  <th className="px-3 py-2 w-6"><input type="checkbox" onChange={e=>e.target.checked?d.selectAll():d.clearSelection()}/></th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase tracking-wider">Account</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase tracking-wider">LOB</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase tracking-wider">Premium</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase tracking-wider">Loss Ratio</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                  {filtered.map(row => {
                    const id = String(row.id); const unlocked = d.unlockedIds.has(id); const selected = d.selectedIds.has(id)
                    const lr = Number(row.loss_ratio||0)
                    const st = String(row.renewal_status||row.account_status||'stable')
                    const sc = STATUS_COLORS[st]||'#6b7280'
                    return <tr key={id} onClick={()=>d.setDrawerRow(row)} className={`cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors ${selected?'bg-indigo-50/50 dark:bg-indigo-900/10':''}`}>
                      <td className="px-3 py-2" onClick={e=>{e.stopPropagation();d.toggleSelect(id)}}><input type="checkbox" checked={selected} onChange={()=>d.toggleSelect(id)}/></td>
                      <td className="px-3 py-2"><div className="flex items-center gap-1">{!unlocked&&<Lock className="w-3 h-3 text-gray-400 shrink-0"/>}<span className="font-medium text-gray-900 dark:text-gray-100 truncate max-w-[140px]">{safeRender(row.account_name||row.insured_name)||'—'}</span>{unlocked&&<span className="text-[10px] text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 px-1 rounded-full">✓</span>}</div></td>
                      <td className="px-3 py-2 text-gray-500">{safeRender(row.line_of_business||row.lob)||'—'}</td>
                      <td className="px-3 py-2 font-semibold text-indigo-600">{unlocked ? fmtPremium(Number(row.annual_premium||row.premium||0)) : <span className="text-gray-300 dark:text-gray-700">●●●</span>}</td>
                      <td className="px-3 py-2">{lr > 0 ? <div className="flex items-center gap-1.5"><div className="w-8 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden"><div className="h-full rounded-full" style={{width:`${Math.min(lr,100)}%`,background:lossRatioColor(lr)}}/></div><span className="font-bold text-xs" style={{color:lossRatioColor(lr)}}>{lr}%</span></div> : <span className="text-gray-300 dark:text-gray-700">—</span>}</td>
                      <td className="px-3 py-2"><span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium capitalize" style={{background:sc+'20',color:sc}}>{st}</span></td>
                    </tr>
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Renewals at risk sidebar */}
        <div className="w-52 shrink-0 bg-white dark:bg-gray-900 border border-red-100 dark:border-red-900/50 rounded-2xl overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-red-100 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20">
            <div className="flex items-center gap-1.5"><AlertTriangle className="w-4 h-4 text-red-500"/><span className="text-xs font-semibold text-red-700 dark:text-red-400 uppercase tracking-wider">At Risk</span></div>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {renewalsAtRisk.length > 0 ? renewalsAtRisk.map(row => {
              const unlocked = d.unlockedIds.has(String(row.id))
              const lr = Number(row.loss_ratio||0)
              return <div key={String(row.id)} onClick={()=>d.setDrawerRow(row)} className="p-2.5 border border-red-100 dark:border-red-900/50 rounded-xl cursor-pointer hover:bg-red-50/50 dark:hover:bg-red-900/10 transition-colors">
                <div className="flex items-center gap-1">{!unlocked&&<Lock className="w-2.5 h-2.5 text-gray-400 shrink-0"/>}<span className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">{safeRender(row.account_name||row.insured_name)||'—'}</span></div>
                <div className="text-[10px] text-gray-400 mt-0.5">{safeRender(row.line_of_business||row.lob)||'—'}</div>
                {lr > 0 && <div className="flex items-center gap-1 mt-1"><div className="w-8 h-1 bg-gray-100 rounded-full overflow-hidden"><div className="h-full rounded-full bg-red-500" style={{width:`${Math.min(lr,100)}%`}}/></div><span className="text-[10px] font-bold text-red-600">{lr}% LR</span></div>}
              </div>
            }) : (
              <div className="flex flex-col items-center justify-center h-full py-6 text-center"><TrendingUp className="w-6 h-6 text-emerald-400 mb-2"/><div className="text-xs text-gray-500">No at-risk accounts</div></div>
            )}
          </div>
          {/* KPI summary at bottom */}
          <div className="border-t border-gray-100 dark:border-gray-800 p-3 space-y-2 shrink-0">
            <div className="flex justify-between text-xs"><span className="text-gray-400">Avg Loss Ratio</span><span className={`font-bold ${Number(avgLossRatio)>=75?'text-red-600':Number(avgLossRatio)>=60?'text-amber-600':'text-emerald-600'}`}>{avgLossRatio}%</span></div>
            <div className="flex justify-between text-xs"><span className="text-gray-400">Total Premium</span><span className="font-bold text-indigo-600">{fmtPremium(totalPremium)}</span></div>
            <div className="flex justify-between text-xs"><span className="text-gray-400">Renewing</span><span className="font-bold text-blue-600">{renewingCount}</span></div>
          </div>
        </div>
      </div>

      <UnlockBar selectedCount={d.selectedIds.size} newCount={Array.from(d.selectedIds).filter(id=>!d.unlockedIds.has(id)).length} unlocking={d.unlocking} creditBalance={d.creditBalance} onUnlock={d.handleUnlock} onClear={d.clearSelection}/>
      {d.drawerRow && <Drawer open={!!d.drawerRow} onClose={()=>d.setDrawerRow(null)} title={String((d.drawerRow.account_name||d.drawerRow.insured_name)??'—')} isUnlocked={d.unlockedIds.has(String(d.drawerRow.id))} onUnlock={()=>{d.toggleSelect(String(d.drawerRow!.id));d.handleUnlock()}} unlocking={d.unlocking} tabs={tabs(d.drawerRow, d.unlockedIds.has(String(d.drawerRow.id)))}/>}
    </div>
  )
}
