// @ts-nocheck
'use client'
import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useVerticalData, safeRender } from '../shared/useVerticalData'
import { VERTICALS } from '@/lib/verticals'
import UnlockBar from '../shared/UnlockBar'
import Drawer, { DrawerField, DrawerSection } from '../shared/Drawer'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { Lock, Search, Filter, Download, BookmarkPlus, Copy, CheckCircle, User, Building2, Mail, Phone, Target, Zap, Star, ArrowRight } from 'lucide-react'
import type { ReactNode } from 'react'

const vertical = VERTICALS.salesintel
const EMAIL_COLORS: Record<string,string> = { verified:'#10b981', valid:'#3b82f6', risky:'#f59e0b', unknown:'#9ca3af' }

export default function SalesIntelDashboard() {
  const [userId, setUserId] = useState<string|undefined>()
  useEffect(() => { supabase.auth.getUser().then(({data}) => setUserId(data.user?.id)) }, [])
  const d = useVerticalData(vertical, userId)

  const [search, setSearch] = useState('')
  const [emailFilter, setEmailFilter] = useState<string>('all')
  const [industryFilter, setIndustryFilter] = useState<string>('all')
  const [segment, setSegment] = useState<'all'|'high'|'medium'|'low'>('all')
  const [sort, setSort] = useState<'priority'|'company'|'intel'>('priority')
  const [savedViews, setSavedViews] = useState<{name:string;segment:string;email:string;industry:string;search:string}[]>([])
  const [saveViewName, setSaveViewName] = useState('')
  const [previewRow, setPreviewRow] = useState<Record<string,unknown>|null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    try { const sv = localStorage.getItem('vm-sv-salesintel'); if(sv) setSavedViews(JSON.parse(sv)) } catch{}
  }, [])

  const industries = useMemo(() => ['all', ...Array.from(new Set(d.rows.map(r=>String(r.industry||'')).filter(Boolean))).slice(0,8)], [d.rows])

  const filtered = useMemo(() => {
    let rows = d.rows
    if(search) rows = rows.filter(r => String(r.company||'').toLowerCase().includes(search.toLowerCase()) || String(r.full_name||'').toLowerCase().includes(search.toLowerCase()))
    if(emailFilter !== 'all') rows = rows.filter(r => r.email_status === emailFilter)
    if(industryFilter !== 'all') rows = rows.filter(r => r.industry === industryFilter)
    if(segment === 'high') rows = rows.filter(r => Number(r.priority_score||0) >= 75)
    else if(segment === 'medium') rows = rows.filter(r => Number(r.priority_score||0) >= 40 && Number(r.priority_score||0) < 75)
    else if(segment === 'low') rows = rows.filter(r => Number(r.priority_score||0) < 40)
    return [...rows].sort((a,b) => {
      if(sort==='priority') return (Number(b.priority_score)||0)-(Number(a.priority_score)||0)
      if(sort==='intel') return (Number(b.intelligence_score)||0)-(Number(a.intelligence_score)||0)
      return String(a.company||'').localeCompare(String(b.company||''))
    })
  }, [d.rows, search, emailFilter, industryFilter, segment, sort])

  const emailData = useMemo(() => ['verified','valid','risky','unknown'].map(s => ({ status:s, count:d.rows.filter(r=>r.email_status===s).length })).filter(x=>x.count>0), [d.rows])
  const topLeads = useMemo(() => [...d.rows].sort((a,b)=>(Number(b.priority_score)||0)-(Number(a.priority_score)||0)).slice(0,5), [d.rows])
  const insights = useMemo(() => {
    if(!d.rows.length) return []
    const verif = d.rows.filter(r=>r.email_status==='verified').length
    const high = d.rows.filter(r=>Number(r.priority_score||0)>=75).length
    return [
      `${Math.round(verif/d.rows.length*100)}% email verified — deliverability strong`,
      `${high} high-priority leads (score ≥ 75)`,
    ]
  }, [d.rows])

  function saveView() {
    if(!saveViewName.trim()) return
    const nv = [...savedViews,{name:saveViewName,segment,email:emailFilter,industry:industryFilter,search}]
    setSavedViews(nv); localStorage.setItem('vm-sv-salesintel',JSON.stringify(nv)); setSaveViewName('')
  }
  function exportCSV() {
    const rows = filtered.filter(r=>d.unlockedIds.has(String(r.id)))
    if(!rows.length) return
    const cols = ['company','full_name','title','email','phone','industry','employee_count','priority_score','intelligence_score']
    const csv = [cols.join(','),...rows.map(r=>cols.map(c=>JSON.stringify(safeRender(r[c])??'')).join(','))].join('\n')
    const a = document.createElement('a'); a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(csv); a.download='salesintel-unlocked.csv'; a.click()
  }
  function copyOutreach(row:Record<string,unknown>) {
    const name = String(safeRender(row.full_name)||'there')
    const co = String(safeRender(row.company)||'your company')
    const title = String(safeRender(row.title)||'')
    const snippet = `Hi ${name},\n\nI noticed ${co}${title?` — as ${title},`:','} you might benefit from...\n\nBest,`
    navigator.clipboard.writeText(snippet).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),2000)})
  }

  function tabs(row:Record<string,unknown>, unlocked:boolean): {label:string;content:ReactNode}[] {
    const m=!unlocked
    return [
      {label:'Contact', content:<div className="space-y-5"><DrawerSection title="Personal"><DrawerField label="Full Name" value={safeRender(row.full_name)} masked={m}/><DrawerField label="Email" value={safeRender(row.email)} masked={m}/><DrawerField label="Phone" value={safeRender(row.phone)} masked={m}/><DrawerField label="LinkedIn" value={safeRender(row.linkedin_url)} masked={m}/></DrawerSection></div>},
      {label:'Firmographics', content:<div className="space-y-5"><DrawerSection title="Company"><DrawerField label="Company" value={safeRender(row.company)}/><DrawerField label="Title" value={safeRender(row.title)}/><DrawerField label="Industry" value={safeRender(row.industry)}/><DrawerField label="Employees" value={safeRender(row.employee_count)}/><DrawerField label="Revenue Est." value={safeRender(row.revenue_estimate)}/><DrawerField label="HQ" value={safeRender(row.hq_location)}/></DrawerSection></div>},
      {label:'Outreach', content:<div className="space-y-5"><DrawerSection title="Signals"><DrawerField label="Priority Score" value={safeRender(row.priority_score)}/><DrawerField label="Intel Score" value={safeRender(row.intelligence_score)}/><DrawerField label="Intent Signal" value={safeRender(row.intent_signal)}/><DrawerField label="Last Activity" value={safeRender(row.last_activity)}/></DrawerSection><DrawerSection title="Email Quality"><DrawerField label="Email Status" value={safeRender(row.email_status)}/><DrawerField label="Bounce Risk" value={safeRender(row.bounce_risk)}/></DrawerSection></div>},
      {label:'Activity', content:<div className="space-y-5"><DrawerSection title="Engagement"><DrawerField label="Workflow Status" value={safeRender(row.workflow_status)}/><DrawerField label="Verified At" value={safeRender(row.verified_at)}/><DrawerField label="Source" value={safeRender(row.source)}/><DrawerField label="Tags" value={safeRender(row.tags)}/></DrawerSection></div>},
    ]
  }

  return (
    <div className="h-full bg-gray-50 dark:bg-gray-950 flex flex-col">
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">🎯 Lead Workbench</h1>
            <p className="text-xs text-gray-400 mt-0.5">{d.rows.length} leads · {d.unlockedIds.size} unlocked</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={exportCSV} className="flex items-center gap-1 text-xs border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-1.5 text-gray-600 hover:text-red-600 hover:border-red-300 transition-colors"><Download className="w-3 h-3"/>Export Unlocked</button>
            <div className="flex items-center gap-1">
              <input value={saveViewName} onChange={e=>setSaveViewName(e.target.value)} placeholder="Save view…" className="text-xs border border-gray-200 dark:border-gray-700 rounded-xl px-2 py-1.5 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 placeholder:text-gray-400 outline-none w-24"/>
              <button onClick={saveView} className="p-1.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-500 hover:text-red-600 hover:border-red-300 transition-colors"><BookmarkPlus className="w-3.5 h-3.5"/></button>
            </div>
          </div>
        </div>
        {savedViews.length>0 && <div className="flex gap-1.5 mt-2 flex-wrap">{savedViews.map((v,i)=><button key={i} onClick={()=>{setSegment(v.segment as typeof segment);setEmailFilter(v.email);setIndustryFilter(v.industry);setSearch(v.search)}} className="text-xs px-2 py-0.5 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-full border border-red-100 dark:border-red-800 hover:bg-red-100 transition-colors">{v.name}</button>)}</div>}
      </div>

      {d.error && <div className="mx-6 mt-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3 text-sm text-red-600">{d.error}</div>}

      {/* 3-column workbench */}
      <div className="flex-1 overflow-hidden flex">
        {/* Left — Filter rail */}
        <div className="w-56 shrink-0 border-r border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-y-auto p-4 space-y-5">
          {/* Search */}
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1"><Search className="w-3 h-3"/>Search</div>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Name, company…" className="w-full text-xs border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-1.5 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 placeholder:text-gray-400 outline-none"/>
          </div>
          {/* Sort */}
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Sort</div>
            {(['priority','intel','company'] as const).map(s=><button key={s} onClick={()=>setSort(s)} className={`w-full text-left text-xs px-2 py-1.5 rounded-lg mb-1 transition-colors ${sort===s?'bg-red-50 dark:bg-red-900/20 text-red-600 font-medium':'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>{s==='priority'?'Priority Score':s==='intel'?'Intel Score':'Company A–Z'}</button>)}
          </div>
          {/* Segment */}
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Priority Tier</div>
            {[{k:'all',l:'All Leads'},{k:'high',l:`High (≥75) · ${d.rows.filter(r=>Number(r.priority_score||0)>=75).length}`},{k:'medium',l:`Medium · ${d.rows.filter(r=>Number(r.priority_score||0)>=40&&Number(r.priority_score||0)<75).length}`},{k:'low',l:`Low (<40) · ${d.rows.filter(r=>Number(r.priority_score||0)<40).length}`}].map(({k,l})=><button key={k} onClick={()=>setSegment(k as typeof segment)} className={`w-full text-left text-xs px-2 py-1.5 rounded-lg mb-1 transition-colors ${segment===k?'bg-red-50 dark:bg-red-900/20 text-red-600 font-medium':'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>{l}</button>)}
          </div>
          {/* Email filter */}
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1"><Mail className="w-3 h-3"/>Email Status</div>
            {['all','verified','valid','risky','unknown'].map(s=><button key={s} onClick={()=>setEmailFilter(s)} className={`w-full text-left text-xs px-2 py-1.5 rounded-lg mb-1 transition-colors capitalize ${emailFilter===s?'bg-red-50 dark:bg-red-900/20 text-red-600 font-medium':'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>{s==='all'?`All (${d.rows.length})`:s}</button>)}
          </div>
          {/* Industry filter */}
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1"><Building2 className="w-3 h-3"/>Industry</div>
            {industries.map(ind=><button key={ind} onClick={()=>setIndustryFilter(ind)} className={`w-full text-left text-xs px-2 py-1.5 rounded-lg mb-1 transition-colors ${industryFilter===ind?'bg-red-50 dark:bg-red-900/20 text-red-600 font-medium':'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>{ind==='all'?'All Industries':ind}</button>)}
          </div>
          {/* Signals */}
          {emailData.length>0 && <div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Email Quality</div>
            <ResponsiveContainer width="100%" height={100}><BarChart data={emailData}><XAxis dataKey="status" tick={{fontSize:9}} axisLine={false} tickLine={false}/><YAxis hide/><Tooltip contentStyle={{fontSize:10,borderRadius:6}}/><Bar dataKey="count" radius={[3,3,0,0]}>{emailData.map((e,i)=><Cell key={i} fill={EMAIL_COLORS[e.status]||'#9ca3af'}/>)}</Bar></BarChart></ResponsiveContainer>
          </div>}
          {insights.length>0 && <div className="space-y-2">{insights.map((ins,i)=><div key={i} className="flex items-start gap-1.5"><Zap className="w-3 h-3 text-red-500 mt-0.5 shrink-0"/><span className="text-xs text-gray-500">{ins}</span></div>)}</div>}
        </div>

        {/* Center — Lead cards */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 min-w-0">
          {d.loading ? (
            <div className="space-y-2">{[...Array(8)].map((_,i)=><div key={i} className="h-24 rounded-2xl bg-gray-100 dark:bg-gray-800 animate-pulse"/>)}</div>
          ) : filtered.length===0 ? (
            <div className="flex flex-col items-center justify-center py-20"><div className="text-5xl mb-4">🎯</div><div className="text-sm font-medium text-gray-500">No leads match your filters</div><button onClick={()=>{setSearch('');setEmailFilter('all');setIndustryFilter('all');setSegment('all')}} className="mt-3 text-xs text-red-600 hover:text-red-700 font-medium">Clear all filters</button></div>
          ) : filtered.map(row => {
            const id=String(row.id); const unlocked=d.unlockedIds.has(id); const selected=d.selectedIds.has(id)
            const priority=Number(row.priority_score||0); const isPreviewing=previewRow&&String(previewRow.id)===id
            const estatus=String(row.email_status||'unknown')
            return <div key={id} onClick={()=>setPreviewRow(isPreviewing?null:row)} className={`bg-white dark:bg-gray-900 border rounded-2xl p-4 cursor-pointer transition-all group ${isPreviewing?'border-red-300 dark:border-red-700 shadow-md':'border-gray-100 dark:border-gray-800 hover:border-gray-200 hover:shadow-sm'} ${selected?'ring-1 ring-red-400':''}`}>
              <div className="flex items-start gap-3">
                <div onClick={e=>{e.stopPropagation();d.toggleSelect(id)}} className="mt-0.5 shrink-0"><input type="checkbox" checked={selected} onChange={()=>d.toggleSelect(id)} className="rounded"/></div>
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-red-400 to-rose-600 flex items-center justify-center text-white text-sm font-bold shrink-0">{String(row.company||'?').charAt(0).toUpperCase()}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {!unlocked&&<Lock className="w-3 h-3 text-gray-400 shrink-0"/>}
                    <span className="font-semibold text-sm text-gray-900 dark:text-gray-100">{safeRender(row.company)||'—'}</span>
                    {unlocked&&<span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded-full">✓</span>}
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{background:(EMAIL_COLORS[estatus]||'#9ca3af')+'22',color:EMAIL_COLORS[estatus]||'#9ca3af'}}>{estatus}</span>
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">{unlocked?String(safeRender(row.full_name)||'●●●●●'):'●●●●●'} · {safeRender(row.title)||'—'}</div>
                  <div className="text-xs text-gray-400">{safeRender(row.industry)||'—'} · {safeRender(row.employee_count)||'—'} employees</div>
                </div>
                <div className="shrink-0 flex flex-col items-end gap-1">
                  <div className="text-sm font-bold text-red-600">{priority}</div>
                  <div className="w-10 h-1 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden"><div className="h-full bg-red-500 rounded-full" style={{width:`${priority}%`}}/></div>
                  <span className="text-[10px] text-gray-400">priority</span>
                </div>
              </div>
            </div>
          })}
        </div>

        {/* Right — Inline preview */}
        <div className="w-72 shrink-0 border-l border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-y-auto flex flex-col">
          {!previewRow ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
              <div className="w-12 h-12 rounded-2xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center mb-3"><User className="w-5 h-5 text-red-400"/></div>
              <div className="text-sm font-medium text-gray-500">Select a lead to preview</div>
              <div className="text-xs text-gray-400 mt-1">Click any lead card to see a quick overview</div>
              {/* Top leads */}
              <div className="w-full mt-6">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 text-left">Top Priority</div>
                {topLeads.map(row=>{
                  const unlocked=d.unlockedIds.has(String(row.id))
                  return <div key={String(row.id)} onClick={()=>setPreviewRow(row)} className="flex items-center gap-2 p-2 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer mb-1">
                    <Star className="w-3 h-3 text-amber-400 shrink-0"/>
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300 flex-1 truncate">{safeRender(row.company)||'—'}</span>
                    <span className="text-xs font-bold text-red-500">{Number(row.priority_score||0)}</span>
                    {!unlocked&&<Lock className="w-3 h-3 text-gray-400 shrink-0"/>}
                  </div>
                })}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col">
              <div className="p-4 border-b border-gray-100 dark:border-gray-800">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{safeRender(previewRow.company)||'—'}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{safeRender(previewRow.industry)||'—'}</div>
                  </div>
                  {d.unlockedIds.has(String(previewRow.id)) ? <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded-full shrink-0">✓ Unlocked</span> : <span className="text-[10px] font-medium text-gray-500 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded-full shrink-0 flex items-center gap-0.5"><Lock className="w-2.5 h-2.5"/>Locked</span>}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-2 text-center"><div className="text-lg font-bold text-red-600">{Number(previewRow.priority_score||0)}</div><div className="text-[10px] text-gray-500">Priority</div></div>
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-2 text-center"><div className="text-lg font-bold text-gray-700 dark:text-gray-200">{Number(previewRow.intelligence_score||0)}</div><div className="text-[10px] text-gray-500">Intel</div></div>
                </div>
              </div>
              <div className="p-4 space-y-3 flex-1">
                <div><span className="text-xs text-gray-400 uppercase tracking-wider">Title</span><div className="text-sm text-gray-700 dark:text-gray-300 mt-0.5">{safeRender(previewRow.title)||'—'}</div></div>
                <div><span className="text-xs text-gray-400 uppercase tracking-wider">Employees</span><div className="text-sm text-gray-700 dark:text-gray-300 mt-0.5">{safeRender(previewRow.employee_count)||'—'}</div></div>
                <div><span className="text-xs text-gray-400 uppercase tracking-wider">Email Status</span><div className="mt-0.5"><span className="text-xs px-1.5 py-0.5 rounded-full" style={{background:(EMAIL_COLORS[String(previewRow.email_status||'unknown')]||'#9ca3af')+'22',color:EMAIL_COLORS[String(previewRow.email_status||'unknown')]||'#9ca3af'}}>{safeRender(previewRow.email_status)||'unknown'}</span></div></div>
                <div><span className="text-xs text-gray-400 uppercase tracking-wider">Intent Signal</span><div className="text-sm text-gray-700 dark:text-gray-300 mt-0.5">{safeRender(previewRow.intent_signal)||'—'}</div></div>
                {!d.unlockedIds.has(String(previewRow.id)) && <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-800 rounded-xl"><div className="text-xs text-gray-500 mb-2">Unlock to see contact details</div><button onClick={()=>{d.toggleSelect(String(previewRow.id));d.handleUnlock()}} className="w-full flex items-center justify-center gap-1 bg-red-600 hover:bg-red-500 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"><Lock className="w-3 h-3"/>Unlock · 1 credit</button></div>}
                {d.unlockedIds.has(String(previewRow.id)) && <><div><span className="text-xs text-gray-400 uppercase tracking-wider">Email</span><div className="text-sm text-gray-700 dark:text-gray-300 mt-0.5">{safeRender(previewRow.email)||'—'}</div></div><div><span className="text-xs text-gray-400 uppercase tracking-wider">Phone</span><div className="text-sm text-gray-700 dark:text-gray-300 mt-0.5">{safeRender(previewRow.phone)||'—'}</div></div></>}
              </div>
              <div className="p-4 border-t border-gray-100 dark:border-gray-800 space-y-2">
                <button onClick={()=>d.setDrawerRow(previewRow)} className="w-full flex items-center justify-center gap-1.5 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 text-xs font-medium py-2 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"><ArrowRight className="w-3 h-3"/>Open Full Profile</button>
                {d.unlockedIds.has(String(previewRow.id)) && <button onClick={()=>copyOutreach(previewRow)} className="w-full flex items-center justify-center gap-1.5 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-xs font-medium py-2 rounded-xl hover:opacity-90 transition-colors">{copied?<><CheckCircle className="w-3 h-3 text-emerald-400"/>Copied!</>:<><Copy className="w-3 h-3"/>Copy Outreach Snippet</>}</button>}
              </div>
            </div>
          )}
        </div>
      </div>

      <UnlockBar selectedCount={d.selectedIds.size} newCount={Array.from(d.selectedIds).filter(id=>!d.unlockedIds.has(id)).length} unlocking={d.unlocking} creditBalance={d.creditBalance} onUnlock={d.handleUnlock} onClear={d.clearSelection}/>
      {d.drawerRow&&<Drawer open={!!d.drawerRow} onClose={()=>d.setDrawerRow(null)} title={String(d.drawerRow.company??'—')} isUnlocked={d.unlockedIds.has(String(d.drawerRow.id))} onUnlock={()=>{d.toggleSelect(String(d.drawerRow!.id));d.handleUnlock()}} unlocking={d.unlocking} tabs={tabs(d.drawerRow,d.unlockedIds.has(String(d.drawerRow.id)))}/>}
    </div>
  )
}
