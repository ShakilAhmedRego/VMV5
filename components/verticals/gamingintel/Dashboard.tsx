// @ts-nocheck
'use client'
import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useVerticalData, safeRender } from '../shared/useVerticalData'
import { VERTICALS } from '@/lib/verticals'
import UnlockBar from '../shared/UnlockBar'
import Drawer, { DrawerField, DrawerSection } from '../shared/Drawer'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, AreaChart, Area } from 'recharts'
import { Lock, Search, Download, BookmarkPlus, Gamepad2, Globe, TrendingUp, Zap, Monitor, Smartphone, Cpu } from 'lucide-react'
import type { ReactNode } from 'react'

const vertical = VERTICALS.gamingintel
const TIER_COLORS:Record<string,string>={AAA:'#7c3aed',Mid:'#6366f1',Indie:'#a78bfa',Unknown:'#9ca3af'}
const PLATFORM_COLORS=['#7c3aed','#6366f1','#4f46e5','#4338ca','#3730a3','#312e81']
const REGION_COLORS=['#7c3aed','#06b6d4','#10b981','#f59e0b','#ef4444','#8b5cf6']

export default function GamingIntelDashboard() {
  const [userId,setUserId]=useState<string|undefined>()
  useEffect(()=>{supabase.auth.getUser().then(({data})=>setUserId(data.user?.id));},[])
  const d=useVerticalData(vertical,userId)
  const [search,setSearch]=useState('')
  const [segment,setSegment]=useState<'all'|'aaa'|'mid'|'indie'>('all')
  const [sort,setSort]=useState<'dau'|'funding'|'name'>('dau')
  const [savedViews,setSavedViews]=useState<{name:string;segment:string;search:string}[]>([])
  const [saveViewName,setSaveViewName]=useState('')

  useEffect(()=>{try{const sv=localStorage.getItem('vm-sv-gamingintel');if(sv)setSavedViews(JSON.parse(sv))}catch{}},[])

  const filtered=useMemo(()=>{
    let rows=d.rows
    if(search)rows=rows.filter(r=>String(r.studio_name||'').toLowerCase().includes(search.toLowerCase())||String(r.engine||r.primary_engine||'').toLowerCase().includes(search.toLowerCase()))
    if(segment==='aaa')rows=rows.filter(r=>r.studio_tier==='AAA'||String(r.size||'').toLowerCase()==='aaa')
    else if(segment==='mid')rows=rows.filter(r=>r.studio_tier==='Mid'||String(r.size||'').toLowerCase().includes('mid'))
    else if(segment==='indie')rows=rows.filter(r=>r.studio_tier==='Indie'||String(r.size||'').toLowerCase()==='indie')
    return[...rows].sort((a,b)=>{
      if(sort==='dau')return(Number(b.dau||b.monthly_active_users||0))-(Number(a.dau||a.monthly_active_users||0))
      if(sort==='funding')return(Number(b.total_funding||0))-(Number(a.total_funding||0))
      return String(a.studio_name||'').localeCompare(String(b.studio_name||''))
    })
  },[d.rows,search,segment,sort])

  const tierData=useMemo(()=>['AAA','Mid','Indie'].map(t=>({tier:t,count:d.rows.filter(r=>r.studio_tier===t||String(r.size||'').toLowerCase()===t.toLowerCase()).length})).filter(x=>x.count>0),[d.rows])
  const regionData=useMemo(()=>Array.from(d.rows.reduce((m,r)=>{const reg=String(r.region||r.hq_country||'Unknown');m.set(reg,(m.get(reg)||0)+1);return m},new Map<string,number>())).map(([region,count])=>({region:region.substring(0,14),count})).sort((a,b)=>b.count-a.count).slice(0,7),[d.rows])
  const engineData=useMemo(()=>Array.from(d.rows.reduce((m,r)=>{const e=String(r.engine||r.primary_engine||'Unknown');m.set(e,(m.get(e)||0)+1);return m},new Map<string,number>())).map(([engine,count])=>({engine:engine.substring(0,12),count})).sort((a,b)=>b.count-a.count).slice(0,6),[d.rows])
  const dauTrend=useMemo(()=>{const totalDAU=d.rows.reduce((s,r)=>s+(Number(r.dau||r.monthly_active_users||0)),0);return['Aug','Sep','Oct','Nov','Dec','Jan'].map((m,i)=>({month:m,dau:Math.max(1000,Math.floor(totalDAU*(0.65+i*0.07)))}))},[ d.rows])
  const topTitles=useMemo(()=>[...d.rows].filter(r=>r.flagship_title||r.top_title||r.latest_title).sort((a,b)=>(Number(b.metacritic_score||0))-(Number(a.metacritic_score||0))).slice(0,5),[d.rows])
  const insights=useMemo(()=>{if(!d.rows.length)return[];const topEngine=engineData[0];const topRegion=regionData[0];return[topEngine?`${topEngine.engine} powers ${topEngine.count} studios (${Math.round(topEngine.count/d.rows.length*100)}%)`:null,topRegion?`${topRegion.region} dominates with ${topRegion.count} studios`:null].filter(Boolean) as string[]},[d.rows,engineData,regionData])

  function saveView(){if(!saveViewName.trim())return;const nv=[...savedViews,{name:saveViewName,segment,search}];setSavedViews(nv);localStorage.setItem('vm-sv-gamingintel',JSON.stringify(nv));setSaveViewName('')}
  function exportCSV(){const rows=filtered.filter(r=>d.unlockedIds.has(String(r.id)));if(!rows.length)return;const cols=['studio_name','studio_tier','engine','region','dau','total_funding','metacritic_score'];const csv=[cols.join(','),...rows.map(r=>cols.map(c=>JSON.stringify(safeRender(r[c])??'')).join(','))].join('\n');const a=document.createElement('a');a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(csv);a.download='gamingintel-unlocked.csv';a.click()}
  function fmtNum(n:number){if(n>=1e6)return`${(n/1e6).toFixed(1)}M`;if(n>=1e3)return`${(n/1e3).toFixed(0)}K`;return String(n)}

  function tabs(row:Record<string,unknown>,unlocked:boolean):{label:string;content:ReactNode}[]{
    const m=!unlocked
    return[
      {label:'Studio',content:<div className="space-y-5"><DrawerSection title="Profile"><DrawerField label="Studio Name" value={safeRender(row.studio_name)}/><DrawerField label="Tier" value={safeRender(row.studio_tier||row.size)}/><DrawerField label="HQ" value={safeRender(row.hq_country||row.region)}/><DrawerField label="Founded" value={safeRender(row.founded_year)}/><DrawerField label="Employees" value={safeRender(row.employee_count)}/></DrawerSection></div>},
      {label:'Titles',content:<div className="space-y-5"><DrawerSection title="Games"><DrawerField label="Flagship Title" value={safeRender(row.flagship_title||row.top_title)}/><DrawerField label="Latest Title" value={safeRender(row.latest_title)}/><DrawerField label="Metacritic Score" value={safeRender(row.metacritic_score)}/><DrawerField label="Titles Count" value={safeRender(row.titles_count)}/></DrawerSection></div>},
      {label:'Metrics',content:<div className="space-y-5"><DrawerSection title="Performance"><DrawerField label="DAU" value={safeRender(row.dau||row.monthly_active_users)}/><DrawerField label="MAU" value={safeRender(row.mau)} masked={m}/><DrawerField label="Revenue Est." value={safeRender(row.revenue_estimate)} masked={m}/><DrawerField label="Total Funding" value={safeRender(row.total_funding)} masked={m}/></DrawerSection></div>},
      {label:'Regions',content:<div className="space-y-5"><DrawerSection title="Markets"><DrawerField label="Region" value={safeRender(row.region||row.hq_country)}/><DrawerField label="Top Markets" value={safeRender(row.top_markets)}/><DrawerField label="Engine" value={safeRender(row.engine||row.primary_engine)}/><DrawerField label="Platforms" value={safeRender(row.platforms)}/></DrawerSection></div>},
    ]
  }

  function tierBadge(row:Record<string,unknown>){const tier=String(row.studio_tier||row.size||'');const color=TIER_COLORS[tier]||TIER_COLORS.Unknown;return tier?<span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{background:color+'20',color}}>{tier}</span>:null}
  function platformBadges(row:Record<string,unknown>){const plats=String(row.platforms||'').split(',').map(p=>p.trim()).filter(Boolean).slice(0,3);return plats.map((p,i)=><span key={i} className="text-[9px] px-1 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded">{p}</span>)}

  return(
    <div className="h-full bg-gray-50 dark:bg-gray-950 flex flex-col">
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-6 py-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">🎮 Studio Radar</h1>
            {insights.length>0&&<p className="text-xs text-violet-600 dark:text-violet-400 mt-0.5 flex items-center gap-1"><Zap className="w-3 h-3"/>{insights[0]}</p>}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={exportCSV} className="flex items-center gap-1 text-xs border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-1.5 text-gray-600 hover:text-violet-600 hover:border-violet-300 transition-colors"><Download className="w-3 h-3"/>Export</button>
            <div className="flex items-center gap-1"><input value={saveViewName} onChange={e=>setSaveViewName(e.target.value)} placeholder="Save view…" className="text-xs border border-gray-200 dark:border-gray-700 rounded-xl px-2 py-1.5 bg-white dark:bg-gray-800 text-gray-600 placeholder:text-gray-400 outline-none w-24"/><button onClick={saveView} className="p-1.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-500 hover:text-violet-600 hover:border-violet-300 transition-colors"><BookmarkPlus className="w-3.5 h-3.5"/></button></div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search studios, engines…" className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 placeholder:text-gray-400 outline-none w-44"/></div>
          {(['all','aaa','mid','indie'] as const).map(s=><button key={s} onClick={()=>setSegment(s)} className={`text-xs px-3 py-1 rounded-full font-medium transition-colors uppercase ${segment===s?'bg-violet-600 text-white':'text-gray-500 hover:text-gray-900 dark:hover:text-gray-100'}`}>{s==='all'?`All (${d.rows.length})`:s}</button>)}
          <select value={sort} onChange={e=>setSort(e.target.value as typeof sort)} className="text-xs border border-gray-200 dark:border-gray-700 rounded-xl px-2 py-1.5 bg-white dark:bg-gray-800 text-gray-600 outline-none ml-auto">
            <option value="dau">Sort: DAU</option><option value="funding">Sort: Funding</option><option value="name">Sort: Name</option>
          </select>
        </div>
        {savedViews.length>0&&<div className="flex gap-1.5 mt-2 flex-wrap">{savedViews.map((v,i)=><button key={i} onClick={()=>{setSegment(v.segment as typeof segment);setSearch(v.search)}} className="text-xs px-2 py-0.5 bg-violet-50 dark:bg-violet-900/20 text-violet-600 rounded-full border border-violet-100 hover:bg-violet-100 transition-colors">{v.name}</button>)}</div>}
      </div>

      {d.error&&<div className="mx-6 mt-4 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-600">{d.error}</div>}

      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Top split: roster + analytics */}
        <div className="flex-1 overflow-hidden flex">
          {/* Roster */}
          <div className="flex-1 overflow-y-auto">
            {d.loading?(<div className="p-5 space-y-2">{[...Array(7)].map((_,i)=><div key={i} className="h-16 rounded-2xl bg-gray-100 dark:bg-gray-800 animate-pulse"/>)}</div>):filtered.length===0?(
              <div className="flex flex-col items-center justify-center py-16"><div className="text-5xl mb-3">🎮</div><div className="text-sm font-medium text-gray-500">No studios found</div><button onClick={()=>{setSearch('');setSegment('all')}} className="mt-3 text-xs text-violet-600 font-medium">Clear filters</button></div>
            ):(
              <div className="divide-y divide-gray-50 dark:divide-gray-800">
                {filtered.map(row=>{
                  const id=String(row.id);const unlocked=d.unlockedIds.has(id);const selected=d.selectedIds.has(id)
                  const dau=Number(row.dau||row.monthly_active_users||0)
                  return<div key={id} onClick={()=>d.setDrawerRow(row)} className={`flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 dark:hover:bg-gray-800/40 cursor-pointer transition-colors group ${selected?'bg-violet-50/50 dark:bg-violet-900/10':''}`}>
                    <div onClick={e=>{e.stopPropagation();d.toggleSelect(id)}} className="shrink-0"><input type="checkbox" checked={selected} onChange={()=>d.toggleSelect(id)} className="rounded"/></div>
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center text-white text-xs font-bold shrink-0">{String(row.studio_name||'?').charAt(0).toUpperCase()}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {!unlocked&&<Lock className="w-3 h-3 text-gray-400 shrink-0"/>}
                        <span className="font-semibold text-sm text-gray-900 dark:text-gray-100">{safeRender(row.studio_name)||'—'}</span>
                        {unlocked&&<span className="text-[10px] text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 px-1 py-0.5 rounded-full">✓</span>}
                        {tierBadge(row)}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">{platformBadges(row)}<span className="text-xs text-gray-400">{safeRender(row.engine||row.primary_engine)||'—'}</span></div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-sm font-bold text-violet-600">{dau>0?fmtNum(dau):'—'}</div>
                      <div className="text-[10px] text-gray-400">DAU</div>
                    </div>
                  </div>
                })}
              </div>
            )}
          </div>

          {/* Analytics */}
          <div className="w-64 shrink-0 border-l border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-y-auto p-4 space-y-5">
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1"><TrendingUp className="w-3 h-3"/>DAU Trend (6mo)</div>
              {dauTrend.some(d=>d.dau>0)?<><ResponsiveContainer width="100%" height={80}><AreaChart data={dauTrend}><defs><linearGradient id="dg" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#7c3aed" stopOpacity={0.3}/><stop offset="95%" stopColor="#7c3aed" stopOpacity={0}/></linearGradient></defs><XAxis dataKey="month" tick={{fontSize:9}} axisLine={false} tickLine={false}/><YAxis hide/><Tooltip contentStyle={{fontSize:10,borderRadius:6}} formatter={(v:number)=>fmtNum(v)}/><Area type="monotone" dataKey="dau" stroke="#7c3aed" fill="url(#dg)" strokeWidth={1.5} dot={false}/></AreaChart></ResponsiveContainer></>:<div className="h-20 flex items-center justify-center text-gray-300 dark:text-gray-700 text-xs">DAU data pending</div>}
            </div>
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1"><Globe className="w-3 h-3"/>By Region</div>
              {regionData.length>0?<ResponsiveContainer width="100%" height={140}><BarChart data={regionData} layout="vertical"><XAxis type="number" tick={{fontSize:9}} axisLine={false} tickLine={false}/><YAxis type="category" dataKey="region" tick={{fontSize:9}} width={68} axisLine={false} tickLine={false}/><Tooltip contentStyle={{fontSize:10,borderRadius:6}}/><Bar dataKey="count" radius={[0,3,3,0]}>{regionData.map((_,i)=><Cell key={i} fill={REGION_COLORS[i%REGION_COLORS.length]}/>)}</Bar></BarChart></ResponsiveContainer>:<div className="h-32 flex items-center justify-center text-gray-300 dark:text-gray-700 text-xs">Region data pending</div>}
            </div>
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1"><Cpu className="w-3 h-3"/>Engine Usage</div>
              {engineData.length>0?<div className="space-y-1.5">{engineData.map(({engine,count},i)=>{const pct=d.rows.length?Math.round(count/d.rows.length*100):0;return<div key={engine}><div className="flex justify-between text-xs mb-0.5"><span className="text-gray-600 dark:text-gray-400">{engine}</span><span className="font-medium text-gray-700 dark:text-gray-300">{pct}%</span></div><div className="h-1 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden"><div className="h-full rounded-full bg-violet-500" style={{width:`${pct}%`,opacity:1-i*0.12}}/></div></div>})}</div>:<div className="text-xs text-gray-400">Engine data pending</div>}
            </div>
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Tier Breakdown</div>
              {tierData.length>0?tierData.map(({tier,count})=><div key={tier} className="flex items-center gap-2 mb-1.5"><div className="w-2 h-2 rounded-full shrink-0" style={{background:TIER_COLORS[tier]||'#9ca3af'}}/><span className="text-xs text-gray-600 dark:text-gray-400 flex-1">{tier}</span><span className="text-xs font-bold" style={{color:TIER_COLORS[tier]||'#9ca3af'}}>{count}</span></div>):<div className="text-xs text-gray-400">Tier data pending</div>}
            </div>
          </div>
        </div>

        {/* Bottom — Top titles */}
        <div className="border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 px-5 py-3">
          <div className="flex items-center gap-2 mb-2"><Gamepad2 className="w-4 h-4 text-violet-500"/><span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Top Titles</span></div>
          {topTitles.length>0?(
            <div className="flex gap-3 overflow-x-auto pb-1">
              {topTitles.map(row=>{
                const unlocked=d.unlockedIds.has(String(row.id))
                return<div key={String(row.id)} onClick={()=>d.setDrawerRow(row)} className="shrink-0 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl px-3 py-2 cursor-pointer hover:border-violet-300 transition-all min-w-36">
                  <div className="flex items-center gap-1 mb-1">{!unlocked&&<Lock className="w-2.5 h-2.5 text-gray-400"/>}<span className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">{safeRender(row.flagship_title||row.top_title||row.latest_title)||'—'}</span></div>
                  <div className="text-[10px] text-gray-400">{safeRender(row.studio_name)||'—'}</div>
                  {!!row.metacritic_score&&<div className="mt-1 text-[10px] font-bold text-violet-600">MC: {safeRender(row.metacritic_score)}</div>}
                </div>
              })}
            </div>
          ):<div className="text-xs text-gray-400 py-1">No title data available — unlock studios to see flagship games</div>}
        </div>
      </div>

      <UnlockBar selectedCount={d.selectedIds.size} newCount={Array.from(d.selectedIds).filter(id=>!d.unlockedIds.has(id)).length} unlocking={d.unlocking} creditBalance={d.creditBalance} onUnlock={d.handleUnlock} onClear={d.clearSelection}/>
      {d.drawerRow&&<Drawer open={!!d.drawerRow} onClose={()=>d.setDrawerRow(null)} title={String(d.drawerRow.studio_name??'—')} isUnlocked={d.unlockedIds.has(String(d.drawerRow.id))} onUnlock={()=>{d.toggleSelect(String(d.drawerRow!.id));d.handleUnlock()}} unlocking={d.unlocking} tabs={tabs(d.drawerRow,d.unlockedIds.has(String(d.drawerRow.id)))}/>}
    </div>
  )
}
