// @ts-nocheck
'use client'
import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useVerticalData, safeRender } from '../shared/useVerticalData'
import { VERTICALS } from '@/lib/verticals'
import UnlockBar from '../shared/UnlockBar'
import Drawer, { DrawerField, DrawerSection } from '../shared/Drawer'
import { Lock, Search, Download, BookmarkPlus, Scale, AlertCircle, Flame, Clock, CheckCircle, XCircle, Filter } from 'lucide-react'
import type { ReactNode } from 'react'

const vertical = VERTICALS.legalintel
const SEV_COLORS:Record<string,string>={critical:'#dc2626',high:'#ef4444',medium:'#f59e0b',low:'#6b7280'}
const STATUS_COLORS:Record<string,string>={open:'#ef4444',closed:'#6b7280',settled:'#10b981',pending:'#f59e0b',dismissed:'#9ca3af'}

function severityScore(row:Record<string,unknown>){const sev=String(row.severity||row.case_severity||'');if(sev==='critical')return 4;if(sev==='high')return 3;if(sev==='medium')return 2;return 1}

export default function LegalIntelDashboard() {
  const [userId,setUserId]=useState<string|undefined>()
  useEffect(()=>{supabase.auth.getUser().then(({data})=>setUserId(data.user?.id));},[])
  const d=useVerticalData(vertical,userId)
  const [search,setSearch]=useState('')
  const [statusFilter,setStatusFilter]=useState<string>('all')
  const [jurisdictionFilter,setJurisdictionFilter]=useState<string>('all')
  const [typeFilter,setTypeFilter]=useState<string>('all')
  const [severityFilter,setSeverityFilter]=useState<string>('all')
  const [sort,setSort]=useState<'severity'|'date'|'title'>('severity')
  const [savedViews,setSavedViews]=useState<{name:string;status:string;search:string;sort:string}[]>([])
  const [saveViewName,setSaveViewName]=useState('')

  useEffect(()=>{try{const sv=localStorage.getItem('vm-sv-legalintel');if(sv)setSavedViews(JSON.parse(sv))}catch{}},[])

  const jurisdictions=useMemo(()=>['all',...Array.from(new Set(d.rows.map(r=>String(r.jurisdiction||'')).filter(Boolean))).slice(0,8)],[d.rows])
  const types=useMemo(()=>['all',...Array.from(new Set(d.rows.map(r=>String(r.case_type||r.type||'')).filter(Boolean))).slice(0,8)],[d.rows])

  const filtered=useMemo(()=>{
    let rows=d.rows
    if(search)rows=rows.filter(r=>String(r.case_title||'').toLowerCase().includes(search.toLowerCase())||String(r.plaintiff||'').toLowerCase().includes(search.toLowerCase())||String(r.defendant||'').toLowerCase().includes(search.toLowerCase()))
    if(statusFilter!=='all')rows=rows.filter(r=>r.status===statusFilter||r.case_status===statusFilter)
    if(jurisdictionFilter!=='all')rows=rows.filter(r=>r.jurisdiction===jurisdictionFilter)
    if(typeFilter!=='all')rows=rows.filter(r=>r.case_type===typeFilter||r.type===typeFilter)
    if(severityFilter!=='all')rows=rows.filter(r=>r.severity===severityFilter||r.case_severity===severityFilter)
    return[...rows].sort((a,b)=>{
      if(sort==='severity')return severityScore(b)-severityScore(a)
      if(sort==='date')return String(b.filing_date||b.date||'').localeCompare(String(a.filing_date||a.date||''))
      return String(a.case_title||'').localeCompare(String(b.case_title||''))
    })
  },[d.rows,search,statusFilter,jurisdictionFilter,typeFilter,severityFilter,sort])

  const openCount=useMemo(()=>d.rows.filter(r=>r.status==='open'||r.case_status==='open').length,[d.rows])
  const criticalCount=useMemo(()=>d.rows.filter(r=>r.severity==='critical'||r.case_severity==='critical').length,[d.rows])
  const hotCases=useMemo(()=>[...d.rows].sort((a,b)=>severityScore(b)-severityScore(a)).slice(0,5),[d.rows])
  const insights=useMemo(()=>{if(!d.rows.length)return[];const high=d.rows.filter(r=>['critical','high'].includes(String(r.severity||r.case_severity||''))).length;return[`${openCount} open cases — ${criticalCount} critical priority`,high>0?`${high} high/critical cases require immediate attention`:null,`${jurisdictions.length-1} jurisdictions tracked`].filter(Boolean) as string[]},[d.rows,openCount,criticalCount,jurisdictions])

  function saveView(){if(!saveViewName.trim())return;const nv=[...savedViews,{name:saveViewName,status:statusFilter,search,sort}];setSavedViews(nv);localStorage.setItem('vm-sv-legalintel',JSON.stringify(nv));setSaveViewName('')}
  function exportCSV(){const rows=filtered.filter(r=>d.unlockedIds.has(String(r.id)));if(!rows.length)return;const cols=['case_title','case_type','jurisdiction','severity','status','filing_date','damages'];const csv=[cols.join(','),...rows.map(r=>cols.map(c=>JSON.stringify(safeRender(r[c])??'')).join(','))].join('\n');const a=document.createElement('a');a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(csv);a.download='legalintel-unlocked.csv';a.click()}

  function tabs(row:Record<string,unknown>,unlocked:boolean):{label:string;content:ReactNode}[]{
    const m=!unlocked
    return[
      {label:'Summary',content:<div className="space-y-5"><DrawerSection title="Case"><DrawerField label="Title" value={safeRender(row.case_title)}/><DrawerField label="Type" value={safeRender(row.case_type||row.type)}/><DrawerField label="Jurisdiction" value={safeRender(row.jurisdiction)}/><DrawerField label="Severity" value={safeRender(row.severity||row.case_severity)}/><DrawerField label="Status" value={safeRender(row.status||row.case_status)}/></DrawerSection></div>},
      {label:'Parties',content:<div className="space-y-5"><DrawerSection title="Parties"><DrawerField label="Plaintiff" value={safeRender(row.plaintiff)} masked={m}/><DrawerField label="Defendant" value={safeRender(row.defendant)} masked={m}/><DrawerField label="Plaintiff Counsel" value={safeRender(row.plaintiff_counsel)} masked={m}/><DrawerField label="Defense Counsel" value={safeRender(row.defense_counsel)} masked={m}/></DrawerSection></div>},
      {label:'Timeline',content:<div className="space-y-5"><DrawerSection title="Key Dates"><DrawerField label="Filing Date" value={safeRender(row.filing_date||row.date)}/><DrawerField label="Trial Date" value={safeRender(row.trial_date)} masked={m}/><DrawerField label="Settlement Date" value={safeRender(row.settlement_date)}/><DrawerField label="Last Activity" value={safeRender(row.last_activity)}/></DrawerSection></div>},
      {label:'Documents',content:<div className="space-y-5"><DrawerSection title="Damages & Docs"><DrawerField label="Damages Claimed" value={safeRender(row.damages)} masked={m}/><DrawerField label="Settlement Amount" value={safeRender(row.settlement_amount)} masked={m}/><DrawerField label="Documents" value={safeRender(row.document_count)}/><DrawerField label="Court" value={safeRender(row.court)}/></DrawerSection></div>},
    ]
  }

  function statusBadge(row:Record<string,unknown>){const s=String(row.status||row.case_status||'unknown');return<span className="text-xs px-2 py-0.5 rounded-full font-medium capitalize" style={{background:(STATUS_COLORS[s]||'#9ca3af')+'20',color:STATUS_COLORS[s]||'#9ca3af'}}>{s}</span>}
  function severityBadge(row:Record<string,unknown>){const s=String(row.severity||row.case_severity||'');if(!s)return null;return<span className="text-xs px-2 py-0.5 rounded-full font-bold capitalize" style={{background:(SEV_COLORS[s]||'#9ca3af')+'20',color:SEV_COLORS[s]||'#9ca3af'}}>{s}</span>}

  return(
    <div className="h-full bg-gray-50 dark:bg-gray-950 flex flex-col">
      {/* Header + status chips */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-6 py-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">⚖️ Docket Intelligence</h1>
            {insights.length>0&&<p className="text-xs text-purple-600 dark:text-purple-400 mt-0.5">{insights[0]}</p>}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={exportCSV} className="flex items-center gap-1 text-xs border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-1.5 text-gray-600 hover:text-purple-600 hover:border-purple-300 transition-colors"><Download className="w-3 h-3"/>Export</button>
            <div className="flex items-center gap-1"><input value={saveViewName} onChange={e=>setSaveViewName(e.target.value)} placeholder="Save view…" className="text-xs border border-gray-200 dark:border-gray-700 rounded-xl px-2 py-1.5 bg-white dark:bg-gray-800 text-gray-600 placeholder:text-gray-400 outline-none w-24"/><button onClick={saveView} className="p-1.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-500 hover:text-purple-600 hover:border-purple-300 transition-colors"><BookmarkPlus className="w-3.5 h-3.5"/></button></div>
          </div>
        </div>
        {/* Status chips */}
        <div className="flex flex-wrap gap-2 mb-2">
          {['all','open','closed','settled','pending'].map(s=>{
            const count=s==='all'?d.rows.length:d.rows.filter(r=>r.status===s||r.case_status===s).length
            return<button key={s} onClick={()=>setStatusFilter(s)} className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded-full font-medium border transition-all capitalize ${statusFilter===s?'border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300':'border-gray-200 dark:border-gray-700 text-gray-500 hover:border-purple-300'}`}>
              {s==='open'&&<AlertCircle className="w-3 h-3 text-red-500"/>}{s==='closed'&&<CheckCircle className="w-3 h-3 text-gray-400"/>}{s==='settled'&&<CheckCircle className="w-3 h-3 text-emerald-500"/>}
              {s==='all'?`All Cases (${count})`:s} {s!=='all'&&<span className="font-normal">({count})</span>}
            </button>
          })}
          {criticalCount>0&&<div className="flex items-center gap-1 text-xs px-3 py-1.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-full text-red-600 font-medium"><Flame className="w-3 h-3"/>{criticalCount} Critical</div>}
        </div>
        {savedViews.length>0&&<div className="flex gap-1.5 flex-wrap">{savedViews.map((v,i)=><button key={i} onClick={()=>{setStatusFilter(v.status);setSearch(v.search);setSort(v.sort as typeof sort)}} className="text-xs px-2 py-0.5 bg-purple-50 dark:bg-purple-900/20 text-purple-600 rounded-full border border-purple-100 dark:border-purple-800">{v.name}</button>)}</div>}
      </div>

      {d.error&&<div className="mx-6 mt-4 bg-red-50 dark:bg-red-900/20 border border-red-200 rounded-xl p-3 text-sm text-red-600">{d.error}</div>}

      {/* Main layout — filter rail + docket + hotlist */}
      <div className="flex-1 overflow-hidden flex">
        {/* Filter rail */}
        <div className="w-48 shrink-0 border-r border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-y-auto p-4 space-y-4">
          <div><div className="relative"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search cases…" className="w-full pl-7 pr-2 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-700 placeholder:text-gray-400 outline-none"/></div></div>
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1"><Filter className="w-3 h-3"/>Severity</div>
            {['all','critical','high','medium','low'].map(s=><button key={s} onClick={()=>setSeverityFilter(s)} className={`w-full text-left text-xs px-2 py-1.5 rounded-lg mb-0.5 capitalize transition-colors ${severityFilter===s?'bg-purple-50 dark:bg-purple-900/20 text-purple-600 font-medium':'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>{s==='all'?'All Severity':s}</button>)}
          </div>
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Jurisdiction</div>
            {jurisdictions.map(j=><button key={j} onClick={()=>setJurisdictionFilter(j)} className={`w-full text-left text-xs px-2 py-1.5 rounded-lg mb-0.5 truncate transition-colors ${jurisdictionFilter===j?'bg-purple-50 dark:bg-purple-900/20 text-purple-600 font-medium':'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>{j==='all'?'All Jurisdictions':j}</button>)}
          </div>
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Case Type</div>
            {types.slice(0,6).map(t=><button key={t} onClick={()=>setTypeFilter(t)} className={`w-full text-left text-xs px-2 py-1.5 rounded-lg mb-0.5 truncate transition-colors ${typeFilter===t?'bg-purple-50 dark:bg-purple-900/20 text-purple-600 font-medium':'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>{t==='all'?'All Types':t}</button>)}
          </div>
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Sort By</div>
            {(['severity','date','title'] as const).map(s=><button key={s} onClick={()=>setSort(s)} className={`w-full text-left text-xs px-2 py-1.5 rounded-lg mb-0.5 capitalize transition-colors ${sort===s?'bg-purple-50 dark:bg-purple-900/20 text-purple-600 font-medium':'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>{s==='severity'?'Severity (high first)':s==='date'?'Filing Date':'Case Title'}</button>)}
          </div>
        </div>

        {/* Docket table */}
        <div className="flex-1 overflow-y-auto min-w-0">
          {d.loading?<div className="p-6 space-y-2">{[...Array(7)].map((_,i)=><div key={i} className="h-12 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse"/>)}</div>:filtered.length===0?(
            <div className="flex flex-col items-center justify-center py-16"><div className="text-4xl mb-3">⚖️</div><div className="text-sm font-medium text-gray-500">No cases found</div><button onClick={()=>{setSearch('');setStatusFilter('all');setSeverityFilter('all')}} className="mt-3 text-xs text-purple-600 font-medium">Clear filters</button></div>
          ):(
            <div className="overflow-x-auto"><table className="w-full text-sm">
              <thead><tr className="bg-gray-50 dark:bg-gray-800/50 sticky top-0 z-10">
                <th className="px-4 py-3 w-8"><input type="checkbox" onChange={e=>e.target.checked?d.selectAll():d.clearSelection()}/></th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-left">Case</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-left">Type</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-left">Jurisdiction</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-left">Severity</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-left">Status</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-left">Filed</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-left">Damages</th>
              </tr></thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                {filtered.map(row=>{
                  const id=String(row.id);const unlocked=d.unlockedIds.has(id);const selected=d.selectedIds.has(id)
                  const sev=String(row.severity||row.case_severity||'')
                  return<tr key={id} onClick={()=>d.setDrawerRow(row)} className={`cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors ${selected?'bg-purple-50/50 dark:bg-purple-900/10':''} ${sev==='critical'?'border-l-2 border-red-500 dark:border-red-500':''}`}>
                    <td className="px-4 py-3" onClick={e=>{e.stopPropagation();d.toggleSelect(id)}}><input type="checkbox" checked={selected} onChange={()=>d.toggleSelect(id)}/></td>
                    <td className="px-4 py-3 max-w-[200px]"><div className="flex items-center gap-2">{!unlocked&&<Lock className="w-3 h-3 text-gray-400 shrink-0"/>}<span className="font-medium text-gray-900 dark:text-gray-100 truncate">{safeRender(row.case_title)||'—'}</span>{unlocked&&<span className="text-[10px] text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 px-1 py-0.5 rounded-full shrink-0">✓</span>}</div></td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{safeRender(row.case_type||row.type)||'—'}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{safeRender(row.jurisdiction)||'—'}</td>
                    <td className="px-4 py-3">{severityBadge(row)||<span className="text-gray-300 text-xs">—</span>}</td>
                    <td className="px-4 py-3">{statusBadge(row)}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{safeRender(row.filing_date||row.date)||'—'}</td>
                    <td className="px-4 py-3 font-medium text-gray-700 dark:text-gray-300">{unlocked&&row.damages?String(safeRender(row.damages)):<span className="text-gray-300 dark:text-gray-700">●●●</span>}</td>
                  </tr>
                })}
              </tbody>
            </table></div>
          )}
        </div>

        {/* Hot cases */}
        <div className="w-56 shrink-0 border-l border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-y-auto p-4">
          <div className="flex items-center gap-1.5 mb-3"><Flame className="w-4 h-4 text-orange-500"/><span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Hot Cases</span></div>
          {hotCases.length>0?hotCases.map((row,i)=>{
            const sev=String(row.severity||row.case_severity||'medium')
            const unlocked=d.unlockedIds.has(String(row.id))
            return<div key={String(row.id)} onClick={()=>d.setDrawerRow(row)} className="flex flex-col gap-1 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer mb-2 border border-gray-50 dark:border-gray-800 hover:border-purple-200 transition-all">
              <div className="flex items-center justify-between gap-1"><span className="text-[10px] font-bold text-gray-400">#{i+1}</span>{severityBadge(row)}</div>
              <div className="flex items-center gap-1">{!unlocked&&<Lock className="w-2.5 h-2.5 text-gray-400 shrink-0"/>}<span className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">{safeRender(row.case_title)||'—'}</span></div>
              <div className="text-[10px] text-gray-400 truncate">{safeRender(row.jurisdiction)||'—'}</div>
            </div>
          }):<div className="flex flex-col items-center justify-center py-8 text-gray-300 dark:text-gray-700"><Scale className="w-8 h-8 mb-2"/><span className="text-xs">No cases yet</span></div>}
          <div className="mt-4 space-y-2">
            <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-3 text-center"><div className="text-xl font-bold text-red-600">{openCount}</div><div className="text-[10px] text-gray-500">Open Cases</div></div>
            <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-3 text-center"><div className="text-xl font-bold text-purple-600">{criticalCount}</div><div className="text-[10px] text-gray-500">Critical</div></div>
          </div>
        </div>
      </div>

      <UnlockBar selectedCount={d.selectedIds.size} newCount={Array.from(d.selectedIds).filter(id=>!d.unlockedIds.has(id)).length} unlocking={d.unlocking} creditBalance={d.creditBalance} onUnlock={d.handleUnlock} onClear={d.clearSelection}/>
      {d.drawerRow&&<Drawer open={!!d.drawerRow} onClose={()=>d.setDrawerRow(null)} title={String(d.drawerRow.case_title??'—')} isUnlocked={d.unlockedIds.has(String(d.drawerRow.id))} onUnlock={()=>{d.toggleSelect(String(d.drawerRow!.id));d.handleUnlock()}} unlocking={d.unlocking} tabs={tabs(d.drawerRow,d.unlockedIds.has(String(d.drawerRow.id)))}/>}
    </div>
  )
}
