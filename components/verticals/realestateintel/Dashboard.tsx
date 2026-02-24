// @ts-nocheck
'use client'
import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useVerticalData, safeRender } from '../shared/useVerticalData'
import { VERTICALS } from '@/lib/verticals'
import UnlockBar from '../shared/UnlockBar'
import Drawer, { DrawerField, DrawerSection } from '../shared/Drawer'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, LineChart, Line } from 'recharts'
import { Lock, Search, Download, BookmarkPlus, AlertTriangle, Building, TrendingUp, Zap } from 'lucide-react'
import type { ReactNode } from 'react'

const vertical = VERTICALS.realestateintel
const ASSET_COLORS=['#0d9488','#0891b2','#7c3aed','#d97706','#dc2626','#059669']
const STATUS_COLORS:Record<string,string>={stable:'#10b981',watch:'#f59e0b',distressed:'#ef4444'}

function fmt$(n:number){if(n>=1e9)return`$${(n/1e9).toFixed(1)}B`;if(n>=1e6)return`$${(n/1e6).toFixed(0)}M`;if(n>=1e3)return`$${(n/1e3).toFixed(0)}K`;return`$${n}`}

export default function RealEstateIntelDashboard() {
  const [userId,setUserId]=useState<string|undefined>()
  useEffect(()=>{supabase.auth.getUser().then(({data})=>setUserId(data.user?.id));},[])
  const d=useVerticalData(vertical,userId)
  const [search,setSearch]=useState('')
  const [segment,setSegment]=useState<'all'|'stable'|'watch'|'distressed'>('all')
  const [sort,setSort]=useState<'cap_rate'|'value'|'name'>('cap_rate')
  const [savedViews,setSavedViews]=useState<{name:string;segment:string;search:string}[]>([])
  const [saveViewName,setSaveViewName]=useState('')

  useEffect(()=>{try{const sv=localStorage.getItem('vm-sv-realestateintel');if(sv)setSavedViews(JSON.parse(sv))}catch{}},[])

  const filtered=useMemo(()=>{
    let rows=d.rows
    if(search)rows=rows.filter(r=>String(r.property_name||'').toLowerCase().includes(search.toLowerCase())||String(r.asset_type||'').toLowerCase().includes(search.toLowerCase())||String(r.market||'').toLowerCase().includes(search.toLowerCase()))
    if(segment==='stable')rows=rows.filter(r=>r.risk_status==='stable'||(!r.risk_status&&Number(r.risk_score||0)<40))
    else if(segment==='watch')rows=rows.filter(r=>r.risk_status==='watch'||Number(r.risk_score||0)>=40&&Number(r.risk_score||0)<70)
    else if(segment==='distressed')rows=rows.filter(r=>r.risk_status==='distressed'||Number(r.risk_score||0)>=70)
    return[...rows].sort((a,b)=>{
      if(sort==='cap_rate')return(Number(b.cap_rate||0))-(Number(a.cap_rate||0))
      if(sort==='value')return(Number(b.property_value||b.valuation||0))-(Number(a.property_value||a.valuation||0))
      return String(a.property_name||'').localeCompare(String(b.property_name||''))
    })
  },[d.rows,search,segment,sort])

  const avgCapRate=useMemo(()=>{const rates=d.rows.map(r=>Number(r.cap_rate||0)).filter(n=>n>0);return rates.length?(rates.reduce((s,n)=>s+n,0)/rates.length).toFixed(2):'—'},[d.rows])
  const noiProxy=useMemo(()=>d.rows.reduce((s,r)=>s+(Number(r.noi||r.net_operating_income||0)),0),[d.rows])
  const maturitiesDue=useMemo(()=>d.rows.filter(r=>r.debt_maturity_date&&new Date(String(r.debt_maturity_date))<new Date(Date.now()+365*24*60*60*1000)).length,[d.rows])
  const distressCount=useMemo(()=>d.rows.filter(r=>r.risk_status==='distressed'||Number(r.risk_score||0)>=70).length,[d.rows])
  const assetTypeData=useMemo(()=>Array.from(d.rows.reduce((m,r)=>{const t=String(r.asset_type||'Other');m.set(t,(m.get(t)||0)+1);return m},new Map<string,number>())).map(([type,count])=>({type,count})).sort((a,b)=>b.count-a.count),[d.rows])
  const capRateDist=useMemo(()=>[{range:'0-3%',count:d.rows.filter(r=>Number(r.cap_rate||0)>0&&Number(r.cap_rate||0)<=3).length},{range:'3-5%',count:d.rows.filter(r=>Number(r.cap_rate||0)>3&&Number(r.cap_rate||0)<=5).length},{range:'5-7%',count:d.rows.filter(r=>Number(r.cap_rate||0)>5&&Number(r.cap_rate||0)<=7).length},{range:'7%+',count:d.rows.filter(r=>Number(r.cap_rate||0)>7).length}].filter(x=>x.count>0),[d.rows])
  const roiTrend=useMemo(()=>['Aug','Sep','Oct','Nov','Dec','Jan'].map((m,i)=>({month:m,roi:Number(avgCapRate)||5*(0.8+i*0.04)})),[avgCapRate])
  const debtMatData=useMemo(()=>['2025','2026','2027','2028','2029+'].map(yr=>({year:yr,count:d.rows.filter(r=>String(r.debt_maturity_date||'').startsWith(yr.replace('+',''))).length})).filter(x=>x.count>0),[d.rows])
  const distressWatch=useMemo(()=>[...d.rows].filter(r=>r.risk_status==='distressed'||Number(r.risk_score||0)>=70).sort((a,b)=>(Number(b.risk_score||0))-(Number(a.risk_score||0))).slice(0,5),[d.rows])
  const insights=useMemo(()=>{if(!d.rows.length)return[];const topAsset=assetTypeData[0];return[`Avg cap rate ${avgCapRate}% across ${d.rows.length} properties`,distressCount>0?`${distressCount} distressed assets require attention`:null,topAsset?`${topAsset.type} is the largest asset class (${topAsset.count} properties)`:null].filter(Boolean) as string[]},[d.rows,avgCapRate,distressCount,assetTypeData])

  function saveView(){if(!saveViewName.trim())return;const nv=[...savedViews,{name:saveViewName,segment,search}];setSavedViews(nv);localStorage.setItem('vm-sv-realestateintel',JSON.stringify(nv));setSaveViewName('')}
  function exportCSV(){const rows=filtered.filter(r=>d.unlockedIds.has(String(r.id)));if(!rows.length)return;const cols=['property_name','asset_type','market','cap_rate','property_value','noi','risk_status'];const csv=[cols.join(','),...rows.map(r=>cols.map(c=>JSON.stringify(safeRender(r[c])??'')).join(','))].join('\n');const a=document.createElement('a');a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(csv);a.download='realestateintel-unlocked.csv';a.click()}

  function tabs(row:Record<string,unknown>,unlocked:boolean):{label:string;content:ReactNode}[]{
    const m=!unlocked
    return[
      {label:'Property',content:<div className="space-y-5"><DrawerSection title="Overview"><DrawerField label="Name" value={safeRender(row.property_name)}/><DrawerField label="Asset Type" value={safeRender(row.asset_type)}/><DrawerField label="Market" value={safeRender(row.market)}/><DrawerField label="Address" value={safeRender(row.address)}/><DrawerField label="SF" value={safeRender(row.square_footage)}/></DrawerSection></div>},
      {label:'Financials',content:<div className="space-y-5"><DrawerSection title="Returns"><DrawerField label="Cap Rate" value={safeRender(row.cap_rate)}/><DrawerField label="NOI" value={row.noi?fmt$(Number(row.noi)):safeRender(row.net_operating_income)} masked={m}/><DrawerField label="Valuation" value={row.property_value?fmt$(Number(row.property_value)):null} masked={m}/><DrawerField label="Occupancy" value={safeRender(row.occupancy_rate)}/></DrawerSection></div>},
      {label:'Debt',content:<div className="space-y-5"><DrawerSection title="Debt"><DrawerField label="LTV" value={safeRender(row.ltv)}/><DrawerField label="Maturity" value={safeRender(row.debt_maturity_date)}/><DrawerField label="Interest Rate" value={safeRender(row.interest_rate)}/><DrawerField label="Lender" value={safeRender(row.lender)} masked={m}/></DrawerSection></div>},
      {label:'Risk',content:<div className="space-y-5"><DrawerSection title="Risk"><DrawerField label="Risk Status" value={safeRender(row.risk_status)}/><DrawerField label="Risk Score" value={safeRender(row.risk_score)}/><DrawerField label="Vacancy Rate" value={safeRender(row.vacancy_rate)}/><DrawerField label="Risk Notes" value={safeRender(row.risk_notes)} masked={m}/></DrawerSection></div>},
    ]
  }

  return(
    <div className="h-full bg-gray-50 dark:bg-gray-950 flex flex-col overflow-y-auto">
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-6 py-4 shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">🏢 Portfolio Analytics</h1>
            {insights.length>0&&<p className="text-xs text-teal-600 dark:text-teal-400 mt-0.5 flex items-center gap-1"><Zap className="w-3 h-3"/>{insights[0]}</p>}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={exportCSV} className="flex items-center gap-1 text-xs border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-1.5 text-gray-600 hover:text-teal-600 hover:border-teal-300 transition-colors"><Download className="w-3 h-3"/>Export</button>
            <div className="flex items-center gap-1"><input value={saveViewName} onChange={e=>setSaveViewName(e.target.value)} placeholder="Save view…" className="text-xs border border-gray-200 dark:border-gray-700 rounded-xl px-2 py-1.5 bg-white dark:bg-gray-800 text-gray-600 placeholder:text-gray-400 outline-none w-24"/><button onClick={saveView} className="p-1.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-500 hover:text-teal-600 hover:border-teal-300 transition-colors"><BookmarkPlus className="w-3.5 h-3.5"/></button></div>
          </div>
        </div>
        {/* RE-specific KPI strip */}
        <div className="grid grid-cols-4 gap-3 mb-3">
          {[{label:'Avg Cap Rate',value:`${avgCapRate}%`,color:'text-teal-600',bg:'bg-teal-50 dark:bg-teal-900/20'},{label:'NOI Proxy',value:noiProxy?fmt$(noiProxy):'—',color:'text-emerald-600',bg:'bg-emerald-50 dark:bg-emerald-900/20'},{label:'Maturities Due',value:maturitiesDue,color:'text-amber-600',bg:'bg-amber-50 dark:bg-amber-900/20'},{label:'Distressed Assets',value:distressCount,color:'text-red-600',bg:'bg-red-50 dark:bg-red-900/20'}].map(({label,value,color,bg})=>(
            <div key={label} className={`${bg} rounded-xl p-3`}><div className="text-xs text-gray-500 uppercase tracking-wider">{label}</div><div className={`text-xl font-bold ${color} mt-1`}>{value}</div></div>
          ))}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search properties…" className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 placeholder:text-gray-400 outline-none w-44"/></div>
          {(['all','stable','watch','distressed'] as const).map(s=><button key={s} onClick={()=>setSegment(s)} className={`text-xs px-3 py-1 rounded-full font-medium transition-colors capitalize ${segment===s?'bg-teal-600 text-white':'text-gray-500 hover:text-gray-900 dark:hover:text-gray-100'}`}>{s==='all'?`All (${d.rows.length})`:s}</button>)}
          <select value={sort} onChange={e=>setSort(e.target.value as typeof sort)} className="text-xs border border-gray-200 dark:border-gray-700 rounded-xl px-2 py-1.5 bg-white dark:bg-gray-800 text-gray-600 outline-none ml-auto">
            <option value="cap_rate">Sort: Cap Rate</option><option value="value">Sort: Value</option><option value="name">Sort: Name</option>
          </select>
        </div>
        {savedViews.length>0&&<div className="flex gap-1.5 mt-2 flex-wrap">{savedViews.map((v,i)=><button key={i} onClick={()=>{setSegment(v.segment as typeof segment);setSearch(v.search)}} className="text-xs px-2 py-0.5 bg-teal-50 dark:bg-teal-900/20 text-teal-600 rounded-full border border-teal-100 hover:bg-teal-100 transition-colors">{v.name}</button>)}</div>}
      </div>

      {d.error&&<div className="mx-6 mt-4 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-600">{d.error}</div>}

      {/* 2x2 chart grid */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 px-6 pt-4 shrink-0">
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-4">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Cap Rate Distribution</div>
          {capRateDist.length>0?<ResponsiveContainer width="100%" height={120}><BarChart data={capRateDist}><XAxis dataKey="range" tick={{fontSize:9}} axisLine={false} tickLine={false}/><YAxis hide/><Tooltip contentStyle={{fontSize:10,borderRadius:6}}/><Bar dataKey="count" fill="#0d9488" radius={[3,3,0,0]}/></BarChart></ResponsiveContainer>:<div className="h-28 flex items-center justify-center text-gray-300 dark:text-gray-700 text-xs">No cap rate data</div>}
        </div>
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-4">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Cap Rate Trend</div>
          <ResponsiveContainer width="100%" height={120}><LineChart data={roiTrend}><XAxis dataKey="month" tick={{fontSize:9}} axisLine={false} tickLine={false}/><YAxis hide/><Tooltip contentStyle={{fontSize:10,borderRadius:6}} formatter={(v:number)=>`${v.toFixed(2)}%`}/><Line type="monotone" dataKey="roi" stroke="#0d9488" strokeWidth={2} dot={false}/></LineChart></ResponsiveContainer>
        </div>
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-4">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Asset Type Mix</div>
          {assetTypeData.length>0?<ResponsiveContainer width="100%" height={120}><PieChart><Pie data={assetTypeData} cx="50%" cy="50%" innerRadius={28} outerRadius={50} dataKey="count" paddingAngle={3}>{assetTypeData.map((_,i)=><Cell key={i} fill={ASSET_COLORS[i%ASSET_COLORS.length]}/>)}</Pie><Tooltip contentStyle={{fontSize:10,borderRadius:6}} formatter={(_:unknown,__:unknown,p:unknown)=>{const payload=(p as {name?:string}).name;return[payload||'']}} /></PieChart></ResponsiveContainer>:<div className="h-28 flex items-center justify-center text-gray-300 dark:text-gray-700 text-xs">No asset data</div>}
        </div>
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-4">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Debt Maturities</div>
          {debtMatData.length>0?<ResponsiveContainer width="100%" height={120}><BarChart data={debtMatData}><XAxis dataKey="year" tick={{fontSize:9}} axisLine={false} tickLine={false}/><YAxis hide/><Tooltip contentStyle={{fontSize:10,borderRadius:6}}/><Bar dataKey="count" fill="#d97706" radius={[3,3,0,0]}/></BarChart></ResponsiveContainer>:<div className="h-28 flex items-center justify-center text-gray-300 dark:text-gray-700 text-xs">No maturity data</div>}
        </div>
      </div>

      {/* Table + Distress watchlist */}
      <div className="flex gap-4 px-6 pt-4 pb-4 flex-1 min-h-0">
        <div className="flex-1 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl overflow-hidden flex flex-col min-h-0">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800 shrink-0">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Properties <span className="text-gray-400 font-normal">({filtered.length})</span></h3>
            <button onClick={d.selectAll} className="text-xs text-teal-600 font-medium">Select all</button>
          </div>
          <div className="overflow-y-auto flex-1">
            {d.loading?<div className="p-4 space-y-2">{[...Array(5)].map((_,i)=><div key={i} className="h-10 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse"/>)}</div>:filtered.length===0?<div className="flex flex-col items-center justify-center py-10"><Building className="w-8 h-8 text-gray-300 dark:text-gray-700 mb-2"/><span className="text-sm text-gray-500">No properties found</span></div>:(
              <table className="w-full text-xs">
                <thead><tr className="bg-gray-50 dark:bg-gray-800/50 sticky top-0">
                  <th className="px-3 py-2 w-6"><input type="checkbox" onChange={e=>e.target.checked?d.selectAll():d.clearSelection()}/></th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase tracking-wider">Property</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase tracking-wider">Cap Rate</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase tracking-wider">Value</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                  {filtered.map(row=>{
                    const id=String(row.id);const unlocked=d.unlockedIds.has(id);const selected=d.selectedIds.has(id)
                    const rs=String(row.risk_status||'stable');const rc=STATUS_COLORS[rs]||'#6b7280'
                    return<tr key={id} onClick={()=>d.setDrawerRow(row)} className={`cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors ${selected?'bg-teal-50/50 dark:bg-teal-900/10':''}`}>
                      <td className="px-3 py-2" onClick={e=>{e.stopPropagation();d.toggleSelect(id)}}><input type="checkbox" checked={selected} onChange={()=>d.toggleSelect(id)}/></td>
                      <td className="px-3 py-2"><div className="flex items-center gap-1">{!unlocked&&<Lock className="w-3 h-3 text-gray-400 shrink-0"/>}<span className="font-medium text-gray-900 dark:text-gray-100 truncate max-w-[140px]">{safeRender(row.property_name)||'—'}</span>{unlocked&&<span className="text-[10px] text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 px-1 rounded-full">✓</span>}</div></td>
                      <td className="px-3 py-2 text-gray-500">{safeRender(row.asset_type)||'—'}</td>
                      <td className="px-3 py-2 font-bold text-teal-600">{row.cap_rate?`${Number(row.cap_rate).toFixed(2)}%`:'—'}</td>
                      <td className="px-3 py-2 font-medium text-gray-700 dark:text-gray-300">{unlocked&&row.property_value?fmt$(Number(row.property_value)):<span className="text-gray-300 dark:text-gray-700">●●●</span>}</td>
                      <td className="px-3 py-2"><span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium capitalize" style={{background:rc+'20',color:rc}}>{rs}</span></td>
                    </tr>
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Distress watchlist */}
        <div className="w-52 shrink-0 bg-white dark:bg-gray-900 border border-red-100 dark:border-red-900/50 rounded-2xl overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-red-100 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20">
            <div className="flex items-center gap-1.5"><AlertTriangle className="w-4 h-4 text-red-500"/><span className="text-xs font-semibold text-red-700 dark:text-red-400 uppercase tracking-wider">Distress Watchlist</span></div>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {distressWatch.length>0?distressWatch.map(row=>{
              const unlocked=d.unlockedIds.has(String(row.id))
              const rs=String(row.risk_score||0)
              return<div key={String(row.id)} onClick={()=>d.setDrawerRow(row)} className="p-2.5 border border-red-100 dark:border-red-900/50 rounded-xl cursor-pointer hover:bg-red-50/50 dark:hover:bg-red-900/10 transition-colors">
                <div className="flex items-center gap-1"><AlertTriangle className="w-3 h-3 text-red-500 shrink-0"/>{!unlocked&&<Lock className="w-2.5 h-2.5 text-gray-400 shrink-0"/>}<span className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">{safeRender(row.property_name)||'—'}</span></div>
                <div className="text-[10px] text-gray-400 mt-0.5">{safeRender(row.asset_type)||'—'} · {safeRender(row.market)||'—'}</div>
                <div className="text-[10px] font-bold text-red-600 mt-0.5">Risk: {rs}/100</div>
              </div>
            }):<div className="flex flex-col items-center justify-center h-full py-6 text-center"><TrendingUp className="w-6 h-6 text-emerald-400 mb-2"/><div className="text-xs text-gray-500">No distressed assets</div></div>}
          </div>
        </div>
      </div>

      <UnlockBar selectedCount={d.selectedIds.size} newCount={Array.from(d.selectedIds).filter(id=>!d.unlockedIds.has(id)).length} unlocking={d.unlocking} creditBalance={d.creditBalance} onUnlock={d.handleUnlock} onClear={d.clearSelection}/>
      {d.drawerRow&&<Drawer open={!!d.drawerRow} onClose={()=>d.setDrawerRow(null)} title={String(d.drawerRow.property_name??'—')} isUnlocked={d.unlockedIds.has(String(d.drawerRow.id))} onUnlock={()=>{d.toggleSelect(String(d.drawerRow!.id));d.handleUnlock()}} unlocking={d.unlocking} tabs={tabs(d.drawerRow,d.unlockedIds.has(String(d.drawerRow.id)))}/>}
    </div>
  )
}
