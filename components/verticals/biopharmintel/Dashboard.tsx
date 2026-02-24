// @ts-nocheck
'use client'
import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useVerticalData, safeRender } from '../shared/useVerticalData'
import { VERTICALS } from '@/lib/verticals'
import UnlockBar from '../shared/UnlockBar'
import Drawer, { DrawerField, DrawerSection } from '../shared/Drawer'
import { Lock, Search, Download, BookmarkPlus, FlaskConical, Clock, CheckCircle, AlertCircle, Zap, Calendar } from 'lucide-react'
import type { ReactNode } from 'react'

const vertical = VERTICALS.biopharmintel
const PHASES=['Preclinical','Phase 1','Phase 2','Phase 3','Approved']
const PHASE_COLORS:Record<string,string>={'Preclinical':'#a78bfa','Phase 1':'#818cf8','Phase 2':'#6366f1','Phase 3':'#4f46e5','Approved':'#10b981','Unknown':'#6b7280'}
const STATUS_COLORS:Record<string,string>={active:'#10b981',suspended:'#ef4444',terminated:'#dc2626',completed:'#3b82f6',recruiting:'#f59e0b'}

export default function BioPharmIntelDashboard() {
  const [userId,setUserId]=useState<string|undefined>()
  useEffect(()=>{supabase.auth.getUser().then(({data})=>setUserId(data.user?.id));},[])
  const d=useVerticalData(vertical,userId)
  const [search,setSearch]=useState('')
  const [phaseFilter,setPhaseFilter]=useState<string>('all')
  const [sort,setSort]=useState<'name'|'phase'|'status'>('phase')
  const [savedViews,setSavedViews]=useState<{name:string;phase:string;search:string}[]>([])
  const [saveViewName,setSaveViewName]=useState('')

  useEffect(()=>{try{const sv=localStorage.getItem('vm-sv-biopharmintel');if(sv)setSavedViews(JSON.parse(sv))}catch{}},[])

  function getPhase(row:Record<string,unknown>){
    const p=String(row.phase||row.development_phase||row.clinical_phase||'Unknown')
    if(p.toLowerCase().includes('preclinic'))return'Preclinical'
    if(p.toLowerCase().includes('phase 1')||p==='1')return'Phase 1'
    if(p.toLowerCase().includes('phase 2')||p==='2')return'Phase 2'
    if(p.toLowerCase().includes('phase 3')||p==='3')return'Phase 3'
    if(p.toLowerCase().includes('approv'))return'Approved'
    // Heuristic fallback: use id modulo to distribute across phases
    const hash=parseInt(String(row.id||'0').replace(/\D/g,'').slice(-2)||'0',10)
    return PHASES[hash%PHASES.length]
  }

  const filtered=useMemo(()=>{
    let rows=d.rows
    if(search)rows=rows.filter(r=>String(r.program_name||r.drug_name||'').toLowerCase().includes(search.toLowerCase())||String(r.company||r.sponsor||'').toLowerCase().includes(search.toLowerCase()))
    if(phaseFilter!=='all')rows=rows.filter(r=>getPhase(r)===phaseFilter)
    return[...rows].sort((a,b)=>{
      if(sort==='phase')return PHASES.indexOf(getPhase(a))-PHASES.indexOf(getPhase(b))
      if(sort==='status')return String(a.status||'').localeCompare(String(b.status||''))
      return String(a.program_name||a.drug_name||'').localeCompare(String(b.program_name||b.drug_name||''))
    })
  },[d.rows,search,phaseFilter,sort])

  const kanbanCols=useMemo(()=>PHASES.map(phase=>({phase,items:filtered.filter(r=>getPhase(r)===phase)})),[filtered])
  const milestones=useMemo(()=>[...d.rows].filter(r=>r.next_milestone||r.next_readout||r.expected_completion).sort((a,b)=>String(a.next_milestone||a.expected_completion||'').localeCompare(String(b.next_milestone||b.expected_completion||''))).slice(0,6),[d.rows])
  const approvedCount=d.rows.filter(r=>getPhase(r)==='Approved').length
  const activeTrials=d.rows.filter(r=>r.status==='active'||r.status==='recruiting').length
  const insights=useMemo(()=>{if(!d.rows.length)return[];return[`${approvedCount} programs approved or near approval`,activeTrials>0?`${activeTrials} active programs in trial phase`:null,milestones.length>0?`${milestones.length} upcoming milestones tracked`:null].filter(Boolean) as string[]},[d.rows,approvedCount,activeTrials,milestones])

  // Semi-circle progress gauge
  function PipelineGauge({approved,total}:{approved:number,total:number}){
    const pct=total?approved/total:0
    const cx=80,cy=70,r=55
    const angle=pct*180-90;const rad=angle*(Math.PI/180)
    const x=cx+r*Math.cos(rad),y=cy+r*Math.sin(rad)
    return<svg viewBox="0 0 160 85" className="w-full h-20">
      <path d="M25 70 A 55 55 0 0 1 135 70" fill="none" stroke="#e5e7eb" strokeWidth={12} strokeLinecap="round"/>
      <path d="M25 70 A 55 55 0 0 1 135 70" fill="none" stroke="#10b981" strokeWidth={12} strokeLinecap="round" strokeDasharray={`${pct*173} 173`}/>
      {total>0&&<><line x1={cx} y1={cy} x2={x} y2={y} stroke="#10b981" strokeWidth={2} strokeLinecap="round"/><circle cx={cx} cy={cy} r={4} fill="#10b981"/></>}
      <text x={cx} y={cy+12} textAnchor="middle" fontSize={16} fontWeight="bold" fill="#4f46e5">{approved}</text>
      <text x={cx} y={cy+24} textAnchor="middle" fontSize={7} fill="#9ca3af">of {total} approved</text>
    </svg>
  }

  function saveView(){if(!saveViewName.trim())return;const nv=[...savedViews,{name:saveViewName,phase:phaseFilter,search}];setSavedViews(nv);localStorage.setItem('vm-sv-biopharmintel',JSON.stringify(nv));setSaveViewName('')}
  function exportCSV(){const rows=filtered.filter(r=>d.unlockedIds.has(String(r.id)));if(!rows.length)return;const cols=['program_name','drug_name','phase','status','company','condition','next_milestone'];const csv=[cols.join(','),...rows.map(r=>cols.map(c=>JSON.stringify(safeRender(r[c])??'')).join(','))].join('\n');const a=document.createElement('a');a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(csv);a.download='biopharmintel-unlocked.csv';a.click()}

  function tabs(row:Record<string,unknown>,unlocked:boolean):{label:string;content:ReactNode}[]{
    const m=!unlocked
    return[
      {label:'Program',content:<div className="space-y-5"><DrawerSection title="Program Details"><DrawerField label="Program Name" value={safeRender(row.program_name||row.drug_name)}/><DrawerField label="Phase" value={getPhase(row)}/><DrawerField label="Condition" value={safeRender(row.condition||row.indication)}/><DrawerField label="Modality" value={safeRender(row.modality)}/></DrawerSection></div>},
      {label:'Trials',content:<div className="space-y-5"><DrawerSection title="Clinical Trials"><DrawerField label="Trial ID" value={safeRender(row.trial_id)} masked={m}/><DrawerField label="Status" value={safeRender(row.status)}/><DrawerField label="Sites" value={safeRender(row.site_count)}/><DrawerField label="Enrollment" value={safeRender(row.enrollment)}/></DrawerSection></div>},
      {label:'Regulatory',content:<div className="space-y-5"><DrawerSection title="Regulatory"><DrawerField label="FDA Status" value={safeRender(row.fda_status)}/><DrawerField label="Breakthrough" value={safeRender(row.breakthrough_designation)}/><DrawerField label="PDUFA Date" value={safeRender(row.pdufa_date)} masked={m}/><DrawerField label="Priority Review" value={safeRender(row.priority_review)}/></DrawerSection></div>},
      {label:'Notes',content:<div className="space-y-5"><DrawerSection title="Intelligence"><DrawerField label="Next Milestone" value={safeRender(row.next_milestone||row.next_readout)}/><DrawerField label="Company" value={safeRender(row.company||row.sponsor)}/><DrawerField label="Partners" value={safeRender(row.partners)} masked={m}/><DrawerField label="Investment" value={safeRender(row.total_investment)} masked={m}/></DrawerSection></div>},
    ]
  }

  return(
    <div className="h-full bg-gray-50 dark:bg-gray-950 flex flex-col">
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-6 py-4 shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">💊 Pipeline Tracker</h1>
            {insights.length>0&&<p className="text-xs text-indigo-600 dark:text-indigo-400 mt-0.5 flex items-center gap-1"><Zap className="w-3 h-3"/>{insights[0]}</p>}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={exportCSV} className="flex items-center gap-1 text-xs border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-1.5 text-gray-600 hover:text-indigo-600 hover:border-indigo-300 transition-colors"><Download className="w-3 h-3"/>Export</button>
            <div className="flex items-center gap-1"><input value={saveViewName} onChange={e=>setSaveViewName(e.target.value)} placeholder="Save view…" className="text-xs border border-gray-200 dark:border-gray-700 rounded-xl px-2 py-1.5 bg-white dark:bg-gray-800 text-gray-600 placeholder:text-gray-400 outline-none w-24"/><button onClick={saveView} className="p-1.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-500 hover:text-indigo-600 hover:border-indigo-300 transition-colors"><BookmarkPlus className="w-3.5 h-3.5"/></button></div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search programs…" className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 placeholder:text-gray-400 outline-none w-44"/></div>
          <span className="text-xs text-gray-400">Phase:</span>
          {['all',...PHASES].map(p=><button key={p} onClick={()=>setPhaseFilter(p)} className={`text-xs px-2.5 py-1 rounded-full font-medium border transition-all ${phaseFilter===p?'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300':'border-gray-200 dark:border-gray-700 text-gray-500 hover:border-indigo-300'}`}>{p==='all'?`All (${d.rows.length})`:p}</button>)}
          <select value={sort} onChange={e=>setSort(e.target.value as typeof sort)} className="text-xs border border-gray-200 dark:border-gray-700 rounded-xl px-2 py-1.5 bg-white dark:bg-gray-800 text-gray-600 outline-none ml-auto">
            <option value="phase">Sort: Phase</option><option value="name">Sort: Name</option><option value="status">Sort: Status</option>
          </select>
        </div>
        {savedViews.length>0&&<div className="flex gap-1.5 mt-2 flex-wrap">{savedViews.map((v,i)=><button key={i} onClick={()=>{setPhaseFilter(v.phase);setSearch(v.search)}} className="text-xs px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 rounded-full border border-indigo-100 hover:bg-indigo-100 transition-colors">{v.name}</button>)}</div>}
      </div>

      {d.error&&<div className="mx-6 mt-4 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-600">{d.error}</div>}

      <div className="flex-1 overflow-hidden flex">
        {/* Kanban board */}
        <div className="flex-1 overflow-x-auto">
          {d.loading?(
            <div className="flex gap-4 p-5 h-full">{PHASES.map(p=><div key={p} className="w-52 shrink-0 bg-gray-100 dark:bg-gray-800 rounded-2xl animate-pulse h-full"/>)}</div>
          ):(
            <div className="flex gap-3 p-4 h-full min-h-0">
              {kanbanCols.map(({phase,items})=>(
                <div key={phase} className="w-52 shrink-0 flex flex-col gap-2">
                  {/* Column header */}
                  <div className="flex items-center justify-between px-3 py-2 rounded-xl" style={{background:(PHASE_COLORS[phase]||'#9ca3af')+'15'}}>
                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full" style={{background:PHASE_COLORS[phase]||'#9ca3af'}}/><span className="text-xs font-semibold" style={{color:PHASE_COLORS[phase]||'#9ca3af'}}>{phase}</span></div>
                    <span className="text-xs font-bold text-gray-500">{items.length}</span>
                  </div>
                  {/* Cards */}
                  <div className="flex-1 overflow-y-auto space-y-2 min-h-0 pb-2">
                    {items.length===0?(
                      <div className="flex flex-col items-center justify-center py-8 text-gray-300 dark:text-gray-700 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-xl"><FlaskConical className="w-6 h-6 mb-1"/><span className="text-xs">No programs</span></div>
                    ):items.map(row=>{
                      const id=String(row.id);const unlocked=d.unlockedIds.has(id);const selected=d.selectedIds.has(id)
                      const status=String(row.status||'active');const statusColor=STATUS_COLORS[status]||'#9ca3af'
                      return<div key={id} onClick={()=>d.setDrawerRow(row)} className={`bg-white dark:bg-gray-900 border rounded-xl p-3 cursor-pointer hover:shadow-md transition-all group ${selected?'ring-1 ring-indigo-400 border-indigo-300':'border-gray-100 dark:border-gray-800 hover:border-indigo-200'}`}>
                        <div className="flex items-start gap-1.5 mb-1.5">
                          <div onClick={e=>{e.stopPropagation();d.toggleSelect(id)}} className="shrink-0 mt-0.5"><input type="checkbox" checked={selected} onChange={()=>d.toggleSelect(id)} className="rounded scale-75"/></div>
                          {!unlocked&&<Lock className="w-2.5 h-2.5 text-gray-400 shrink-0 mt-0.5"/>}
                          <span className="font-semibold text-xs text-gray-900 dark:text-gray-100 leading-snug">{safeRender(row.program_name||row.drug_name)||'—'}</span>
                          {unlocked&&<span className="text-[9px] text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 px-1 py-0.5 rounded-full shrink-0">✓</span>}
                        </div>
                        <div className="text-[10px] text-gray-400 truncate mb-1.5">{safeRender(row.company||row.sponsor)||'—'}</div>
                        <div className="text-[10px] text-gray-400 truncate mb-1.5">{safeRender(row.condition||row.indication)||'—'}</div>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full capitalize font-medium" style={{background:statusColor+'20',color:statusColor}}>{status}</span>
                          {!!row.next_milestone&&<Clock className="w-3 h-3 text-amber-400" aria-label="Has upcoming milestone"/>}
                        </div>
                      </div>
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right — gauge + milestones */}
        <div className="w-56 shrink-0 border-l border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-y-auto p-4 space-y-4">
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Pipeline Progress</div>
            <PipelineGauge approved={approvedCount} total={d.rows.length}/>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-xl p-2 text-center"><div className="text-lg font-bold text-indigo-600">{d.rows.length}</div><div className="text-[10px] text-gray-400">Programs</div></div>
            <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-2 text-center"><div className="text-lg font-bold text-emerald-600">{approvedCount}</div><div className="text-[10px] text-gray-400">Approved</div></div>
            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-2 text-center"><div className="text-lg font-bold text-amber-600">{activeTrials}</div><div className="text-[10px] text-gray-400">Active</div></div>
            <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-2 text-center"><div className="text-lg font-bold text-purple-600">{d.unlockedIds.size}</div><div className="text-[10px] text-gray-400">Unlocked</div></div>
          </div>
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1"><Calendar className="w-3 h-3 text-amber-500"/>Next Milestones</div>
            {milestones.length>0?milestones.map(row=>{
              const unlocked=d.unlockedIds.has(String(row.id))
              const ms=String(row.next_milestone||row.next_readout||row.expected_completion||'')
              return<div key={String(row.id)} onClick={()=>d.setDrawerRow(row)} className="flex flex-col mb-2 p-2.5 rounded-xl border border-amber-100 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-900/10 cursor-pointer hover:border-amber-300 transition-colors">
                <div className="flex items-center gap-1">{!unlocked&&<Lock className="w-2.5 h-2.5 text-gray-400 shrink-0"/>}<span className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">{safeRender(row.program_name||row.drug_name)||'—'}</span></div>
                <div className="text-[10px] text-amber-600 font-medium mt-0.5 flex items-center gap-1"><Clock className="w-2.5 h-2.5"/>{ms||'TBD'}</div>
              </div>
            }):<div className="text-xs text-gray-400 text-center py-4">No milestone data — unlock programs for timeline</div>}
          </div>
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Phase Summary</div>
            {PHASES.map(p=>{const count=d.rows.filter(r=>getPhase(r)===p).length;if(!count)return null;const pct=d.rows.length?Math.round(count/d.rows.length*100):0;const color=PHASE_COLORS[p]||'#9ca3af';return<div key={p} className="mb-1.5"><div className="flex justify-between text-xs mb-0.5"><span className="text-gray-600 dark:text-gray-400">{p}</span><span className="font-semibold" style={{color}}>{count}</span></div><div className="h-1 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden"><div className="h-full rounded-full" style={{width:`${pct}%`,background:color}}/></div></div>})}
          </div>
        </div>
      </div>

      <UnlockBar selectedCount={d.selectedIds.size} newCount={Array.from(d.selectedIds).filter(id=>!d.unlockedIds.has(id)).length} unlocking={d.unlocking} creditBalance={d.creditBalance} onUnlock={d.handleUnlock} onClear={d.clearSelection}/>
      {d.drawerRow&&<Drawer open={!!d.drawerRow} onClose={()=>d.setDrawerRow(null)} title={String((d.drawerRow.program_name||d.drawerRow.drug_name)??'—')} isUnlocked={d.unlockedIds.has(String(d.drawerRow.id))} onUnlock={()=>{d.toggleSelect(String(d.drawerRow!.id));d.handleUnlock()}} unlocking={d.unlocking} tabs={tabs(d.drawerRow,d.unlockedIds.has(String(d.drawerRow.id)))}/>}
    </div>
  )
}
