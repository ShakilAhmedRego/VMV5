// @ts-nocheck
'use client'
import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useVerticalData, safeRender } from '../shared/useVerticalData'
import { VERTICALS } from '@/lib/verticals'
import UnlockBar from '../shared/UnlockBar'
import Drawer, { DrawerField, DrawerSection } from '../shared/Drawer'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts'
import { Lock, Search, Download, BookmarkPlus, Activity, FlaskConical, Users, CheckCircle, Clock, XCircle } from 'lucide-react'
import type { ReactNode } from 'react'

const vertical = VERTICALS.clinicalintel
const PHASE_COLORS:Record<string,string>={'Preclinical':'#a78bfa','Phase 1':'#818cf8','Phase 2':'#6366f1','Phase 3':'#4f46e5','Phase 4':'#4338ca','Approved':'#10b981','Unknown':'#9ca3af'}
const STATUS_COLORS:Record<string,string>={'recruiting':'#10b981','not recruiting':'#6b7280','completed':'#3b82f6','active':'#f59e0b','suspended':'#ef4444','terminated':'#dc2626'}

export default function ClinicalIntelDashboard() {
  const [userId,setUserId]=useState<string|undefined>()
  useEffect(()=>{supabase.auth.getUser().then(({data})=>setUserId(data.user?.id));},[])
  const d=useVerticalData(vertical,userId)
  const [search,setSearch]=useState('')
  const [phaseFilter,setPhaseFilter]=useState<string>('all')
  const [statusFilter,setStatusFilter]=useState<string>('all')
  const [conditionFilter,setConditionFilter]=useState<string>('all')
  const [segment,setSegment]=useState<'all'|'recruiting'|'notrecruiting'|'completed'>('all')
  const [sort,setSort]=useState<'title'|'phase'|'status'>('title')
  const [savedViews,setSavedViews]=useState<{name:string;segment:string;phase:string;status:string;search:string}[]>([])
  const [saveViewName,setSaveViewName]=useState('')
  const [selectedTrial,setSelectedTrial]=useState<Record<string,unknown>|null>(null)

  useEffect(()=>{try{const sv=localStorage.getItem('vm-sv-clinicalintel');if(sv)setSavedViews(JSON.parse(sv))}catch{}},[])

  const phases=useMemo(()=>['all',...Array.from(new Set(d.rows.map(r=>String(r.phase||'Unknown')).filter(Boolean)))],[d.rows])
  const statuses=useMemo(()=>['all',...Array.from(new Set(d.rows.map(r=>String(r.recruitment_status||r.status||'')).filter(Boolean))).slice(0,6)],[d.rows])
  const conditions=useMemo(()=>['all',...Array.from(new Set(d.rows.map(r=>String(r.condition||'')).filter(Boolean))).slice(0,8)],[d.rows])

  const filtered=useMemo(()=>{
    let rows=d.rows
    if(search)rows=rows.filter(r=>String(r.trial_title||'').toLowerCase().includes(search.toLowerCase())||String(r.condition||'').toLowerCase().includes(search.toLowerCase())||String(r.sponsor||'').toLowerCase().includes(search.toLowerCase()))
    if(phaseFilter!=='all')rows=rows.filter(r=>r.phase===phaseFilter)
    if(statusFilter!=='all')rows=rows.filter(r=>r.recruitment_status===statusFilter||r.status===statusFilter)
    if(conditionFilter!=='all')rows=rows.filter(r=>r.condition===conditionFilter)
    if(segment==='recruiting')rows=rows.filter(r=>r.recruitment_status==='recruiting'||r.status==='recruiting')
    else if(segment==='notrecruiting')rows=rows.filter(r=>r.recruitment_status==='not recruiting')
    else if(segment==='completed')rows=rows.filter(r=>r.recruitment_status==='completed'||r.status==='completed')
    return[...rows].sort((a,b)=>{
      if(sort==='phase'){const po=Object.keys(PHASE_COLORS);return po.indexOf(String(a.phase||'Unknown'))-po.indexOf(String(b.phase||'Unknown'))}
      if(sort==='status')return String(a.recruitment_status||a.status||'').localeCompare(String(b.recruitment_status||b.status||''))
      return String(a.trial_title||'').localeCompare(String(b.trial_title||''))
    })
  },[d.rows,search,phaseFilter,statusFilter,conditionFilter,segment,sort])

  const phaseData=useMemo(()=>Object.entries(d.rows.reduce((m,r)=>{const p=String(r.phase||'Unknown');m[p]=(m[p]||0)+1;return m},{} as Record<string,number>)).map(([phase,count])=>({phase,count,fullPhase:phase})).sort((a,b)=>Object.keys(PHASE_COLORS).indexOf(a.fullPhase)-Object.keys(PHASE_COLORS).indexOf(b.fullPhase)),[d.rows])
  const statusData=useMemo(()=>['recruiting','not recruiting','completed','active'].map(s=>({status:s,count:d.rows.filter(r=>r.recruitment_status===s||r.status===s).length})).filter(x=>x.count>0),[d.rows])
  const recruiting=d.rows.filter(r=>r.recruitment_status==='recruiting'||r.status==='recruiting').length

  function saveView(){if(!saveViewName.trim())return;const nv=[...savedViews,{name:saveViewName,segment,phase:phaseFilter,status:statusFilter,search}];setSavedViews(nv);localStorage.setItem('vm-sv-clinicalintel',JSON.stringify(nv));setSaveViewName('')}
  function exportCSV(){const rows=filtered.filter(r=>d.unlockedIds.has(String(r.id)));if(!rows.length)return;const cols=['trial_title','phase','condition','sponsor','recruitment_status','enrollment_count','start_date'];const csv=[cols.join(','),...rows.map(r=>cols.map(c=>JSON.stringify(safeRender(r[c])??'')).join(','))].join('\n');const a=document.createElement('a');a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(csv);a.download='clinicalintel-unlocked.csv';a.click()}

  function tabs(row:Record<string,unknown>,unlocked:boolean):{label:string;content:ReactNode}[]{
    const m=!unlocked
    return[
      {label:'Trial',content:<div className="space-y-5"><DrawerSection title="Overview"><DrawerField label="Title" value={safeRender(row.trial_title)}/><DrawerField label="Phase" value={safeRender(row.phase)}/><DrawerField label="Condition" value={safeRender(row.condition)}/><DrawerField label="Status" value={safeRender(row.recruitment_status||row.status)}/><DrawerField label="NCT ID" value={safeRender(row.nct_id)}/></DrawerSection></div>},
      {label:'Sponsor',content:<div className="space-y-5"><DrawerSection title="Sponsor"><DrawerField label="Sponsor" value={safeRender(row.sponsor)}/><DrawerField label="PI Name" value={safeRender(row.principal_investigator)} masked={m}/><DrawerField label="Sponsor Contact" value={safeRender(row.sponsor_contact)} masked={m}/><DrawerField label="Sponsor Type" value={safeRender(row.sponsor_type)}/></DrawerSection></div>},
      {label:'Sites',content:<div className="space-y-5"><DrawerSection title="Sites"><DrawerField label="Site Count" value={safeRender(row.site_count)}/><DrawerField label="Countries" value={safeRender(row.countries)}/><DrawerField label="Primary Site" value={safeRender(row.primary_site)} masked={m}/><DrawerField label="Enrollment" value={safeRender(row.enrollment_count)}/></DrawerSection></div>},
      {label:'Eligibility',content:<div className="space-y-5"><DrawerSection title="Criteria"><DrawerField label="Min Age" value={safeRender(row.min_age)}/><DrawerField label="Max Age" value={safeRender(row.max_age)}/><DrawerField label="Gender" value={safeRender(row.gender)}/><DrawerField label="Inclusion Criteria" value={safeRender(row.inclusion_criteria)} masked={m}/><DrawerField label="Exclusion Criteria" value={safeRender(row.exclusion_criteria)} masked={m}/></DrawerSection></div>},
    ]
  }

  function phaseLabel(phase:string){const short:Record<string,string>={'Preclinical':'Pre','Phase 1':'P1','Phase 2':'P2','Phase 3':'P3','Phase 4':'P4','Approved':'✓'};return short[phase]||phase}
  function statusIcon(s:string){if(s==='recruiting')return<CheckCircle className="w-3 h-3 text-emerald-500"/>;if(s==='completed')return<CheckCircle className="w-3 h-3 text-blue-500"/>;if(s==='not recruiting')return<XCircle className="w-3 h-3 text-gray-400"/>;return<Clock className="w-3 h-3 text-amber-500"/>}

  return(
    <div className="h-full bg-gray-50 dark:bg-gray-950 flex flex-col">
      {/* Search-first header */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-6 py-4">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">🧬 Trial Finder</h1>
          <div className="flex items-center gap-2">
            <button onClick={exportCSV} className="flex items-center gap-1 text-xs border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-1.5 text-gray-600 hover:text-cyan-600 hover:border-cyan-300 transition-colors"><Download className="w-3 h-3"/>Export</button>
            <div className="flex items-center gap-1"><input value={saveViewName} onChange={e=>setSaveViewName(e.target.value)} placeholder="Save view…" className="text-xs border border-gray-200 dark:border-gray-700 rounded-xl px-2 py-1.5 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 placeholder:text-gray-400 outline-none w-24"/><button onClick={saveView} className="p-1.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-500 hover:text-cyan-600 hover:border-cyan-300 transition-colors"><BookmarkPlus className="w-3.5 h-3.5"/></button></div>
          </div>
        </div>
        {/* Prominent search */}
        <div className="relative mb-3"><Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by title, condition, sponsor…" className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-200 dark:border-gray-700 rounded-2xl bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 placeholder:text-gray-400 outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all"/></div>
        {/* Filter chips */}
        <div className="flex flex-wrap gap-2 mb-2">
          <span className="text-xs font-medium text-gray-400 self-center">Phase:</span>
          {phases.map(p=><button key={p} onClick={()=>setPhaseFilter(p)} className={`text-xs px-2.5 py-1 rounded-full font-medium border transition-all ${phaseFilter===p?'border-cyan-500 bg-cyan-50 dark:bg-cyan-900/20 text-cyan-700 dark:text-cyan-300':'border-gray-200 dark:border-gray-700 text-gray-500 hover:border-cyan-300 hover:text-cyan-600'}`}>{p==='all'?'All':phaseLabel(p)}</button>)}
          <span className="text-xs font-medium text-gray-400 self-center ml-2">Status:</span>
          {(['all','recruiting','not recruiting','completed'] as const).map(s=><button key={s} onClick={()=>setSegment(s==='all'?'all':s==='recruiting'?'recruiting':s==='not recruiting'?'notrecruiting':'completed')} className={`text-xs px-2.5 py-1 rounded-full font-medium border transition-all capitalize ${segment===(s==='all'?'all':s==='recruiting'?'recruiting':s==='not recruiting'?'notrecruiting':'completed')?'border-cyan-500 bg-cyan-50 dark:bg-cyan-900/20 text-cyan-700 dark:text-cyan-300':'border-gray-200 dark:border-gray-700 text-gray-500 hover:border-cyan-300'}`}>{s}</button>)}
        </div>
        {/* Condition chips */}
        {conditions.length>1&&<div className="flex flex-wrap gap-1.5 mb-2"><span className="text-xs font-medium text-gray-400 self-center">Condition:</span>{conditions.slice(0,8).map(c=><button key={c} onClick={()=>setConditionFilter(c)} className={`text-xs px-2 py-0.5 rounded-full border transition-all ${conditionFilter===c?'border-teal-500 bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300':'border-gray-200 dark:border-gray-700 text-gray-500 hover:border-teal-300'}`}>{c==='all'?'All':c}</button>)}</div>}
        {savedViews.length>0&&<div className="flex gap-1.5 flex-wrap">{savedViews.map((v,i)=><button key={i} onClick={()=>{setSegment(v.segment as typeof segment);setPhaseFilter(v.phase);setSearch(v.search)}} className="text-xs px-2 py-0.5 bg-cyan-50 dark:bg-cyan-900/20 text-cyan-600 rounded-full border border-cyan-100 dark:border-cyan-800 hover:bg-cyan-100 transition-colors">{v.name}</button>)}</div>}
      </div>

      {d.error&&<div className="mx-6 mt-4 bg-red-50 dark:bg-red-900/20 border border-red-200 rounded-xl p-3 text-sm text-red-600">{d.error}</div>}

      {/* Split pane */}
      <div className="flex-1 overflow-hidden flex">
        {/* Left — Trials list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 min-w-0">
          <div className="flex items-center justify-between mb-1 px-1">
            <span className="text-xs text-gray-400">{filtered.length} trials · {recruiting} recruiting</span>
            <select value={sort} onChange={e=>setSort(e.target.value as typeof sort)} className="text-xs border border-gray-200 dark:border-gray-700 rounded-xl px-2 py-1 bg-white dark:bg-gray-800 text-gray-600 outline-none">
              <option value="title">Sort: Title</option><option value="phase">Sort: Phase</option><option value="status">Sort: Status</option>
            </select>
          </div>
          {d.loading?<div className="space-y-2">{[...Array(6)].map((_,i)=><div key={i} className="h-20 rounded-2xl bg-gray-100 dark:bg-gray-800 animate-pulse"/>)}</div>:filtered.length===0?(
            <div className="flex flex-col items-center justify-center py-16"><div className="text-4xl mb-3">🧬</div><div className="text-sm font-medium text-gray-500">No trials found</div><button onClick={()=>{setSearch('');setPhaseFilter('all');setSegment('all');setConditionFilter('all')}} className="mt-3 text-xs text-cyan-600 font-medium">Clear filters</button></div>
          ):filtered.map(row=>{
            const id=String(row.id);const unlocked=d.unlockedIds.has(id);const selected=d.selectedIds.has(id)
            const phase=String(row.phase||'Unknown');const status=String(row.recruitment_status||row.status||'unknown')
            const isSelected=selectedTrial&&String(selectedTrial.id)===id
            return<div key={id} onClick={()=>setSelectedTrial(isSelected?null:row)} className={`bg-white dark:bg-gray-900 border rounded-2xl p-4 cursor-pointer transition-all group ${isSelected?'border-cyan-400 shadow-md':'border-gray-100 dark:border-gray-800 hover:border-cyan-200 hover:shadow-sm'} ${selected?'ring-1 ring-cyan-400':''}`}>
              <div className="flex items-start gap-3">
                <div onClick={e=>{e.stopPropagation();d.toggleSelect(id)}} className="mt-0.5 shrink-0"><input type="checkbox" checked={selected} onChange={()=>d.toggleSelect(id)} className="rounded"/></div>
                <div className="shrink-0 flex flex-col items-center gap-1">
                  <div className="w-10 h-6 rounded-lg flex items-center justify-center text-white text-[10px] font-bold" style={{background:PHASE_COLORS[phase]||'#9ca3af'}}>{phaseLabel(phase)}</div>
                  <div className="flex items-center gap-0.5">{statusIcon(status)}</div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {!unlocked&&<Lock className="w-3 h-3 text-gray-400 shrink-0"/>}
                    <span className="font-semibold text-sm text-gray-900 dark:text-gray-100 truncate">{safeRender(row.trial_title)||'—'}</span>
                    {unlocked&&<span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded-full shrink-0">✓</span>}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">{safeRender(row.condition)||'—'} · {safeRender(row.sponsor)||'—'}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs px-1.5 py-0.5 rounded-full font-medium capitalize" style={{background:(STATUS_COLORS[status]||'#9ca3af')+'20',color:STATUS_COLORS[status]||'#9ca3af'}}>{status}</span>
                    {!!row.enrollment_count&&<span className="text-xs text-gray-400"><Users className="w-2.5 h-2.5 inline mr-0.5"/>{safeRender(row.enrollment_count)} enrolled</span>}
                  </div>
                </div>
              </div>
            </div>
          })}
        </div>

        {/* Right — Analytics */}
        <div className="w-72 shrink-0 border-l border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-y-auto p-4 space-y-4">
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Phase Distribution</div>
            {phaseData.length>0?<ResponsiveContainer width="100%" height={180}><BarChart data={phaseData}><XAxis dataKey="phase" tick={{fontSize:9}} axisLine={false} tickLine={false}/><YAxis hide/><Tooltip contentStyle={{fontSize:10,borderRadius:6}}/><Bar dataKey="count" radius={[4,4,0,0]}>{phaseData.map((e,i)=><Cell key={i} fill={PHASE_COLORS[e.fullPhase]||'#9ca3af'}/>)}</Bar></BarChart></ResponsiveContainer>:<div className="h-40 flex flex-col items-center justify-center text-gray-300 dark:text-gray-700 text-xs"><FlaskConical className="w-6 h-6 mb-1"/>Phase data pending</div>}
          </div>
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Recruitment Status</div>
            <div className="space-y-2">{statusData.map(({status,count})=>{
              const pct=d.rows.length?Math.round(count/d.rows.length*100):0
              return<div key={status}><div className="flex justify-between text-xs mb-0.5"><span className="capitalize text-gray-600 dark:text-gray-400">{status}</span><span className="font-semibold text-gray-700 dark:text-gray-300">{count} ({pct}%)</span></div><div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden"><div className="h-full rounded-full transition-all" style={{width:`${pct}%`,background:STATUS_COLORS[status]||'#9ca3af'}}/></div></div>
            })}</div>
          </div>
          {selectedTrial&&<div className="border border-cyan-100 dark:border-cyan-900/50 rounded-2xl p-3">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Eligibility Preview</div>
            <div className="space-y-2">
              <div><span className="text-[10px] text-gray-400 uppercase">Age</span><div className="text-xs text-gray-700 dark:text-gray-300">{safeRender(selectedTrial.min_age)||'?'} – {safeRender(selectedTrial.max_age)||'?'}</div></div>
              <div><span className="text-[10px] text-gray-400 uppercase">Gender</span><div className="text-xs text-gray-700 dark:text-gray-300">{safeRender(selectedTrial.gender)||'Any'}</div></div>
              <div><span className="text-[10px] text-gray-400 uppercase">Enrollment Target</span><div className="text-xs text-gray-700 dark:text-gray-300">{safeRender(selectedTrial.enrollment_count)||'—'}</div></div>
              {!d.unlockedIds.has(String(selectedTrial.id))&&<button onClick={()=>{d.toggleSelect(String(selectedTrial.id));d.handleUnlock()}} className="w-full text-xs bg-cyan-600 hover:bg-cyan-500 text-white py-1.5 rounded-xl transition-colors font-medium flex items-center justify-center gap-1"><Lock className="w-3 h-3"/>Unlock full criteria</button>}
            </div>
          </div>}
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Quick Stats</div>
            <div className="grid grid-cols-2 gap-2">
              {[{label:'Total',val:d.rows.length},{label:'Recruiting',val:recruiting},{label:'Phases',val:phaseData.length},{label:'Unlocked',val:d.unlockedIds.size}].map(({label,val})=><div key={label} className="bg-gray-50 dark:bg-gray-800 rounded-xl p-2 text-center"><div className="text-lg font-bold text-cyan-600">{val}</div><div className="text-[10px] text-gray-400">{label}</div></div>)}
            </div>
          </div>
        </div>
      </div>

      <UnlockBar selectedCount={d.selectedIds.size} newCount={Array.from(d.selectedIds).filter(id=>!d.unlockedIds.has(id)).length} unlocking={d.unlocking} creditBalance={d.creditBalance} onUnlock={d.handleUnlock} onClear={d.clearSelection}/>
      {d.drawerRow&&<Drawer open={!!d.drawerRow} onClose={()=>d.setDrawerRow(null)} title={String(d.drawerRow.trial_title??'—')} isUnlocked={d.unlockedIds.has(String(d.drawerRow.id))} onUnlock={()=>{d.toggleSelect(String(d.drawerRow!.id));d.handleUnlock()}} unlocking={d.unlocking} tabs={tabs(d.drawerRow,d.unlockedIds.has(String(d.drawerRow.id)))}/>}
    </div>
  )
}
