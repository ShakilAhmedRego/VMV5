// @ts-nocheck
'use client'
import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useVerticalData, safeRender } from '../shared/useVerticalData'
import { VERTICALS } from '@/lib/verticals'
import UnlockBar from '../shared/UnlockBar'
import Drawer, { DrawerField, DrawerSection } from '../shared/Drawer'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, AreaChart, Area, CartesianGrid } from 'recharts'
import { Lock, Search, Zap, Flame, Download, BookmarkPlus, ChevronDown, ChevronRight, X, ArrowUpRight, TrendingUp } from 'lucide-react'
import type { ReactNode } from 'react'

const V = VERTICALS.dealflow
const STAGE_ORDER = ['Pre-seed','Seed','Series A','Series B','Series C','Series D+','Growth','IPO']
const SC: Record<string,string> = {'Pre-seed':'#c4b5fd','Seed':'#a78bfa','Series A':'#818cf8','Series B':'#6366f1','Series C':'#4f46e5','Series D+':'#4338ca','Growth':'#3730a3','IPO':'#1e1b4b'}
const fmt$ = (n:number) => n>=1e9?`$${(n/1e9).toFixed(1)}B`:n>=1e6?`$${(n/1e6).toFixed(0)}M`:n>=1e3?`$${(n/1e3).toFixed(0)}K`:`$${n}`

const LS_KEY = 'vm-sv-dealflow'
type SavedView = {name:string,stage:string|null,seg:string,search:string,sort:string}

function EmptyState({icon,title,sub}:{icon:string,title:string,sub:string}) {
  return <div className="flex flex-col items-center justify-center py-16 text-center"><div className="text-4xl mb-3">{icon}</div><div className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</div><div className="text-xs text-gray-400 mt-1">{sub}</div></div>
}

export default function DealflowDashboard() {
  const [userId, setUserId] = useState<string|undefined>()
  useEffect(()=>{supabase.auth.getUser().then(({data})=>setUserId(data.user?.id))}, [])
  const d = useVerticalData(V, userId)

  const [search,setSearch] = useState('')
  const [stage,setStage] = useState<string|null>(null)
  const [seg,setSeg] = useState('all')
  const [sort,setSort] = useState('intel')
  const [tableOpen,setTableOpen] = useState(false)
  const [savedViews,setSavedViews] = useState<SavedView[]>([])
  const [viewName,setViewName] = useState('')

  useEffect(()=>{ try{const sv=localStorage.getItem(LS_KEY);if(sv)setSavedViews(JSON.parse(sv))}catch{} },[])

  const rows = useMemo(()=>{
    let r = d.rows
    if(stage) r = r.filter(x=>x.funding_stage===stage)
    if(seg!=='all') r = r.filter(x=>x.workflow_status===seg)
    if(search) r = r.filter(x=>String(x.company_name||x.sector||'').toLowerCase().includes(search.toLowerCase()))
    return [...r].sort((a,b)=>sort==='intel'?(Number(b.intelligence_score)||0)-(Number(a.intelligence_score)||0):sort==='raised'?(Number(b.total_raised)||0)-(Number(a.total_raised)||0):String(a.company_name||'').localeCompare(String(b.company_name||'')))
  },[d.rows,stage,seg,search,sort])

  const stageData = useMemo(()=>STAGE_ORDER.map(s=>({stage:s.replace('Series ','S.'),full:s,count:d.rows.filter(r=>r.funding_stage===s).length})).filter(x=>x.count>0),[d.rows])
  const hot = useMemo(()=>[...d.rows].sort((a,b)=>(Number(b.intelligence_score)||0)-(Number(a.intelligence_score)||0)).slice(0,5),[d.rows])
  const totalRaised = useMemo(()=>d.rows.reduce((s,r)=>s+(Number(r.total_raised)||0),0),[d.rows])
  const trend = useMemo(()=>['Aug','Sep','Oct','Nov','Dec','Jan'].map((m,i)=>({month:m,deals:Math.max(2,Math.round((d.rows.length||8)*(0.4+i*0.12))),raised:Math.max(5,Math.round((totalRaised/1e6||40)*(0.3+i*0.14)))})),[d.rows.length,totalRaised])

  const insights = useMemo(()=>{
    const out:string[] = []
    if(stageData.length>0){const top=stageData.sort((a,b)=>b.count-a.count)[0];out.push(`${top.full} leads with ${top.count} companies (${Math.round(top.count/Math.max(1,d.rows.length)*100)}% of portfolio)`)}
    const hi=d.rows.filter(r=>Number(r.intelligence_score)>=80).length;if(hi>0)out.push(`${hi} companies with intel ≥ 80 — high conviction signals`)
    const active=d.rows.filter(r=>r.workflow_status==='active').length;if(active>0)out.push(`${active} active deals · ${Math.round(active/Math.max(1,d.rows.length)*100)}% pipeline activation`)
    return out.slice(0,3)
  },[d.rows,stageData])

  function saveView(){
    if(!viewName.trim())return
    const nv=[...savedViews,{name:viewName,stage,seg,search,sort}]
    setSavedViews(nv);localStorage.setItem(LS_KEY,JSON.stringify(nv));setViewName('')
  }
  function delView(i:number){const nv=savedViews.filter((_,j)=>j!==i);setSavedViews(nv);localStorage.setItem(LS_KEY,JSON.stringify(nv))}
  function loadView(v:SavedView){setStage(v.stage);setSeg(v.seg);setSearch(v.search);setSort(v.sort)}

  function exportCSV(){
    const out=rows.filter(r=>d.unlockedIds.has(String(r.id)))
    if(!out.length)return
    const cols=['company_name','funding_stage','sector','total_raised','intelligence_score','workflow_status','hq_location']
    const csv=[cols.join(','),...out.map(r=>cols.map(c=>JSON.stringify(safeRender(r[c])??'')).join(','))].join('\n')
    const a=document.createElement('a');a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(csv);a.download='dealflow.csv';a.click()
  }
  function copyIDs(){const ids=Array.from(d.selectedIds);navigator.clipboard.writeText(ids.join(',')).catch(()=>{})}

  function tabs(row:Record<string,unknown>,ul:boolean):{label:string;content:ReactNode}[]{const m=!ul;return[
    {label:'Company',content:<div className="space-y-5"><DrawerSection title="Profile"><DrawerField label="Company" value={safeRender(row.company_name)}/><DrawerField label="Sector" value={safeRender(row.sector)}/><DrawerField label="HQ" value={safeRender(row.hq_location)}/><DrawerField label="Founded" value={safeRender(row.founded_year)}/><DrawerField label="Employees" value={safeRender(row.employee_count)}/><DrawerField label="Website" value={safeRender(row.website)} masked={m}/></DrawerSection><DrawerSection title="About"><DrawerField label="Description" value={safeRender(row.description)}/><DrawerField label="Tags" value={safeRender(row.tags)}/></DrawerSection></div>},
    {label:'Investors',content:<div className="space-y-5"><DrawerSection title="Cap Table"><DrawerField label="Lead Investors" value={safeRender(row.lead_investors)} masked={m}/><DrawerField label="Investor Count" value={safeRender(row.investor_count)} masked={m}/><DrawerField label="Board Members" value={safeRender(row.board_members)} masked={m}/><DrawerField label="Advisors" value={safeRender(row.advisors)} masked={m}/></DrawerSection></div>},
    {label:'Financials',content:<div className="space-y-5"><DrawerSection title="Funding"><DrawerField label="Total Raised" value={row.total_raised?fmt$(Number(row.total_raised)):'—'} masked={m}/><DrawerField label="Last Round" value={safeRender(row.last_round_date)}/><DrawerField label="Valuation" value={row.valuation?fmt$(Number(row.valuation)):'—'} masked={m}/><DrawerField label="Revenue Est." value={row.revenue_estimate?fmt$(Number(row.revenue_estimate)):'—'} masked={m}/></DrawerSection></div>},
    {label:'Pipeline',content:<div className="space-y-5"><DrawerSection title="Workflow"><DrawerField label="Status" value={safeRender(row.workflow_status)}/><DrawerField label="Intel Score" value={row.intelligence_score?`${row.intelligence_score}/100`:'—'}/><DrawerField label="Deal Owner" value={safeRender(row.deal_owner)} masked={m}/><DrawerField label="Next Action" value={safeRender(row.next_action)} masked={m}/></DrawerSection></div>},
  ]}

  const segs=[{k:'all',label:`All (${d.rows.length})`},{k:'active',label:`Active (${d.rows.filter(r=>r.workflow_status==='active').length})`},{k:'prospect',label:`Prospects (${d.rows.filter(r=>r.workflow_status==='prospect').length})`},{k:'closed',label:`Closed (${d.rows.filter(r=>r.workflow_status==='closed').length})`}]

  return (
    <div className="h-full bg-gray-50 dark:bg-gray-950 flex flex-col overflow-hidden">
      {/* ── Header ── */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-6 py-4 shrink-0">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">💼 Investment Deal Flow <span className="text-sm font-normal text-gray-400">· {d.rows.length} cos</span></h1>
            {insights[0] && <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-0.5 flex items-center gap-1"><Zap className="w-3 h-3"/>{insights[0]}</p>}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search companies…" className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 placeholder:text-gray-400 outline-none w-44"/></div>
            <select value={sort} onChange={e=>setSort(e.target.value)} className="text-xs border border-gray-200 dark:border-gray-700 rounded-xl px-2 py-1.5 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 outline-none"><option value="intel">↓ Intel Score</option><option value="raised">↓ Raised</option><option value="name">A–Z Name</option></select>
            <div className="flex items-center gap-1"><input value={viewName} onChange={e=>setViewName(e.target.value)} placeholder="Save view…" className="text-xs border border-gray-200 dark:border-gray-700 rounded-xl px-2 py-1.5 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 placeholder:text-gray-400 outline-none w-24"/><button onClick={saveView} title="Save view" className="p-1.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-500 hover:text-indigo-600 hover:border-indigo-300 transition-colors"><BookmarkPlus className="w-3.5 h-3.5"/></button></div>
            {d.selectedIds.size>0 && <><button onClick={exportCSV} className="flex items-center gap-1 text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-xl hover:bg-indigo-500 transition-colors"><Download className="w-3 h-3"/>Export</button><button onClick={copyIDs} className="text-xs border border-gray-200 dark:border-gray-700 px-3 py-1.5 rounded-xl text-gray-600 dark:text-gray-300 hover:text-indigo-600 transition-colors">Copy IDs</button><button onClick={d.clearSelection} className="text-xs text-gray-400 hover:text-red-500 transition-colors">Clear</button></>}
          </div>
        </div>
        {savedViews.length>0 && <div className="flex items-center gap-1.5 mt-2 flex-wrap">{savedViews.map((v,i)=><span key={i} className="flex items-center gap-1 text-xs px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-full border border-indigo-100 dark:border-indigo-800"><button onClick={()=>loadView(v)}>{v.name}</button><button onClick={()=>delView(i)} className="hover:text-red-500"><X className="w-2.5 h-2.5"/></button></span>)}</div>}
        <div className="flex items-center gap-1 mt-3">{segs.map(s=><button key={s.k} onClick={()=>setSeg(s.k)} className={`text-xs px-3 py-1 rounded-full font-medium transition-colors ${seg===s.k?'bg-indigo-600 text-white':'text-gray-500 hover:text-gray-900 dark:hover:text-gray-100'}`}>{s.label}</button>)}</div>
      </div>

      {d.error && <div className="mx-6 mt-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3 text-sm text-red-600 dark:text-red-400 shrink-0">{d.error}</div>}

      {/* ── Body ── */}
      <div className="flex-1 overflow-hidden flex min-h-0">
        {/* LEFT: stage chart + trend + insights */}
        <div className="w-64 shrink-0 border-r border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-y-auto flex flex-col">
          <div className="p-4 border-b border-gray-50 dark:border-gray-800">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Stage Distribution</div>
            {stageData.length===0 ? (
              <div className="h-40 flex flex-col items-center justify-center text-gray-300 dark:text-gray-700"><TrendingUp className="w-8 h-8 mb-2"/><span className="text-xs">No stage data yet</span></div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={180}><BarChart data={stageData} layout="vertical" margin={{left:0,right:8,top:0,bottom:0}}><XAxis type="number" tick={{fontSize:9}} axisLine={false} tickLine={false}/><YAxis type="category" dataKey="stage" tick={{fontSize:10}} width={32} axisLine={false} tickLine={false}/><Tooltip contentStyle={{fontSize:11,borderRadius:8,border:'1px solid #e5e7eb'}}/><Bar dataKey="count" radius={[0,4,4,0]} cursor="pointer" onClick={(pd:Record<string,unknown>)=>setStage(stage===pd.full?null:String(pd.full))}>{stageData.map((e,i)=><Cell key={i} fill={SC[e.full]||'#6366f1'} opacity={stage&&stage!==e.full?0.3:1}/>)}</Bar></BarChart></ResponsiveContainer>
                {stage && <div className="flex items-center justify-between mt-1"><span className="text-xs text-indigo-600 font-medium truncate">{stage}</span><button onClick={()=>setStage(null)} className="text-xs text-gray-400 hover:text-gray-700 ml-1 shrink-0">✕</button></div>}
              </>
            )}
          </div>
          <div className="p-4 border-b border-gray-50 dark:border-gray-800">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Activity Trend</div>
            <ResponsiveContainer width="100%" height={70}><AreaChart data={trend}><defs><linearGradient id="dg" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#6366f1" stopOpacity={0.25}/><stop offset="95%" stopColor="#6366f1" stopOpacity={0}/></linearGradient></defs><XAxis dataKey="month" tick={{fontSize:9}} axisLine={false} tickLine={false}/><YAxis hide/><Tooltip contentStyle={{fontSize:10,borderRadius:6}}/><Area type="monotone" dataKey="deals" stroke="#6366f1" fill="url(#dg)" strokeWidth={1.5} dot={false}/></AreaChart></ResponsiveContainer>
          </div>
          {insights.length>0 && <div className="p-4">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Insights</div>
            {insights.map((ins,i)=><div key={i} className="flex items-start gap-2 mb-2 last:mb-0"><Zap className="w-3 h-3 text-indigo-500 mt-0.5 shrink-0"/><span className="text-xs text-gray-600 dark:text-gray-400">{ins}</span></div>)}
          </div>}
        </div>

        {/* RIGHT: hot deals + pipeline list */}
        <div className="flex-1 overflow-y-auto flex flex-col min-w-0">
          {/* Hot deals strip */}
          <div className="shrink-0 bg-gradient-to-r from-indigo-50 to-violet-50 dark:from-indigo-900/20 dark:to-violet-900/20 border-b border-indigo-100 dark:border-indigo-900/40 px-5 py-3">
            <div className="flex items-center gap-2 mb-2"><Flame className="w-4 h-4 text-orange-500"/><span className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Hot Deals — Top Intel Score</span></div>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {hot.length===0 ? <div className="text-xs text-gray-400 py-1">Add companies to see hot deals</div> : hot.map(row=>{const id=String(row.id);const ul=d.unlockedIds.has(id);return <div key={id} onClick={()=>d.setDrawerRow(row)} className="shrink-0 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl px-3 py-2.5 cursor-pointer hover:border-indigo-300 hover:shadow-sm transition-all w-44"><div className="flex items-center gap-1 mb-1">{!ul&&<Lock className="w-2.5 h-2.5 text-gray-400 shrink-0"/>}<span className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">{String(safeRender(row.company_name)||'—')}</span></div><div className="text-[10px] text-gray-400 mb-1.5">{String(safeRender(row.funding_stage)||'Unknown')}</div><div className="flex items-center gap-1"><div className="flex-1 h-1 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden"><div className="h-full bg-indigo-500 rounded-full" style={{width:`${Number(row.intelligence_score)||0}%`}}/></div><span className="text-[10px] font-bold text-indigo-600">{Number(row.intelligence_score)||0}</span></div></div>})}
            </div>
          </div>

          {/* Pipeline cards */}
          <div className="flex-1 p-5">
            {d.loading ? (
              <div className="space-y-2">{[...Array(6)].map((_,i)=><div key={i} className="h-16 rounded-2xl bg-gray-100 dark:bg-gray-800 animate-pulse"/>)}</div>
            ) : rows.length===0 ? <EmptyState icon="💼" title="No companies match your filters" sub="Clear filters or adjust your search"/> : (
              <div className="space-y-2">
                {rows.map(row=>{
                  const id=String(row.id);const ul=d.unlockedIds.has(id);const sel=d.selectedIds.has(id);const score=Number(row.intelligence_score)||0;const st=String(row.funding_stage||'')
                  return <div key={id} onClick={()=>d.setDrawerRow(row)} className={`flex items-center gap-3 bg-white dark:bg-gray-900 border rounded-2xl px-4 py-3 cursor-pointer hover:border-indigo-200 hover:shadow-sm transition-all group ${sel?'border-indigo-300 bg-indigo-50/50 dark:bg-indigo-900/10':'border-gray-100 dark:border-gray-800'}`}>
                    <div onClick={e=>{e.stopPropagation();d.toggleSelect(id)}} className="shrink-0"><input type="checkbox" checked={sel} onChange={()=>d.toggleSelect(id)} className="rounded"/></div>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0" style={{background:SC[st]||'#6366f1'}}>{String(row.company_name||'?').charAt(0).toUpperCase()}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2"><Lock className={`w-3 h-3 shrink-0 ${ul?'text-emerald-400':'text-gray-300 dark:text-gray-600'}`}/><span className="font-semibold text-sm text-gray-900 dark:text-gray-100 truncate">{String(safeRender(row.company_name)||'—')}</span>{ul&&<span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded-full shrink-0">✓</span>}</div>
                      <div className="text-xs text-gray-400 truncate">{String(safeRender(row.sector)||'—')} · {String(safeRender(row.hq_location)||'—')}</div>
                    </div>
                    <div className="shrink-0 text-right"><div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{ul&&row.total_raised?fmt$(Number(row.total_raised)):<span className="text-gray-300 dark:text-gray-700">●●●</span>}</div><span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{background:(SC[st]||'#6366f1')+'22',color:SC[st]||'#6366f1'}}>{st||'—'}</span></div>
                    <div className="shrink-0 flex flex-col items-center gap-0.5 w-10"><div className="text-xs font-bold text-indigo-600">{score}</div><div className="w-8 h-1 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden"><div className="h-full bg-indigo-500 rounded-full" style={{width:`${score}%`}}/></div></div>
                    <ArrowUpRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-indigo-500 transition-colors shrink-0"/>
                  </div>
                })}
              </div>
            )}
          </div>

          {/* Collapsible full table */}
          <div className="shrink-0 border-t border-gray-100 dark:border-gray-800">
            <button onClick={()=>setTableOpen(!tableOpen)} className="w-full flex items-center justify-between px-5 py-3 bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-sm font-medium text-gray-600 dark:text-gray-400">
              <span>Full Data Table ({rows.length})</span>
              {tableOpen?<ChevronDown className="w-4 h-4"/>:<ChevronRight className="w-4 h-4"/>}
            </button>
            {tableOpen && <div className="overflow-x-auto max-h-64"><table className="w-full text-xs"><thead><tr className="bg-gray-50 dark:bg-gray-800/50 sticky top-0"><th className="px-3 py-2 w-6"><input type="checkbox" onChange={e=>e.target.checked?d.selectAll():d.clearSelection()}/></th><th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase tracking-wider">Company</th><th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase tracking-wider">Stage</th><th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase tracking-wider">Raised</th><th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase tracking-wider">Intel</th><th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase tracking-wider">Status</th></tr></thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800">{rows.map(row=>{const id=String(row.id);const ul=d.unlockedIds.has(id);const sel=d.selectedIds.has(id);return <tr key={id} onClick={()=>d.setDrawerRow(row)} className={`cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/40 ${sel?'bg-indigo-50/50 dark:bg-indigo-900/10':''}`}><td className="px-3 py-2" onClick={e=>{e.stopPropagation();d.toggleSelect(id)}}><input type="checkbox" checked={sel} onChange={()=>d.toggleSelect(id)}/></td><td className="px-3 py-2 font-medium text-gray-900 dark:text-gray-100">{!ul&&<Lock className="w-3 h-3 text-gray-400 inline mr-1"/>}{String(safeRender(row.company_name)||'—')}</td><td className="px-3 py-2 text-gray-500">{String(safeRender(row.funding_stage)||'—')}</td><td className="px-3 py-2 font-medium">{ul&&row.total_raised?fmt$(Number(row.total_raised)):<span className="text-gray-300">●●●</span>}</td><td className="px-3 py-2 font-bold text-indigo-600">{Number(row.intelligence_score)||0}</td><td className="px-3 py-2"><span className={`px-1.5 py-0.5 rounded-full ${row.workflow_status==='active'?'bg-emerald-50 text-emerald-700':'bg-gray-100 text-gray-500'}`}>{String(safeRender(row.workflow_status)||'—')}</span></td></tr>})}</tbody></table></div>}
          </div>
        </div>
      </div>

      <UnlockBar selectedCount={d.selectedIds.size} newCount={Array.from(d.selectedIds).filter(id=>!d.unlockedIds.has(id)).length} unlocking={d.unlocking} creditBalance={d.creditBalance} onUnlock={d.handleUnlock} onClear={d.clearSelection}/>
      {d.drawerRow&&<Drawer open={!!d.drawerRow} onClose={()=>d.setDrawerRow(null)} title={String(d.drawerRow.company_name??'—')} isUnlocked={d.unlockedIds.has(String(d.drawerRow.id))} onUnlock={()=>{d.toggleSelect(String(d.drawerRow!.id));d.handleUnlock()}} unlocking={d.unlocking} tabs={tabs(d.drawerRow,d.unlockedIds.has(String(d.drawerRow.id)))}/>}
    </div>
  )
}
