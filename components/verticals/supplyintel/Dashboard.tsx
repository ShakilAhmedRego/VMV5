// @ts-nocheck
'use client'
import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useVerticalData, safeRender } from '../shared/useVerticalData'
import { VERTICALS } from '@/lib/verticals'
import UnlockBar from '../shared/UnlockBar'
import Drawer, { DrawerField, DrawerSection } from '../shared/Drawer'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { Lock, Search, Download, BookmarkPlus, AlertTriangle, CheckCircle, Globe, ShieldAlert, TrendingDown } from 'lucide-react'
import type { ReactNode } from 'react'

const vertical = VERTICALS.supplyintel
const DONUT_COLORS=['#10b981','#f59e0b','#ef4444','#6b7280']

function riskColor(score:number){if(score<=30)return'#10b981';if(score<=60)return'#f59e0b';return'#ef4444'}

export default function SupplyIntelDashboard() {
  const [userId,setUserId]=useState<string|undefined>()
  useEffect(()=>{supabase.auth.getUser().then(({data})=>setUserId(data.user?.id));},[])
  const d=useVerticalData(vertical,userId)
  const [search,setSearch]=useState('')
  const [segment,setSegment]=useState<'all'|'compliant'|'watchlist'|'highrisk'>('all')
  const [sort,setSort]=useState<'risk'|'name'|'country'>('risk')
  const [savedViews,setSavedViews]=useState<{name:string;segment:string;search:string}[]>([])
  const [saveViewName,setSaveViewName]=useState('')

  useEffect(()=>{try{const sv=localStorage.getItem('vm-sv-supplyintel');if(sv)setSavedViews(JSON.parse(sv))}catch{}},[])

  const filtered=useMemo(()=>{
    let rows=d.rows
    if(search)rows=rows.filter(r=>String(r.supplier_name||'').toLowerCase().includes(search.toLowerCase())||String(r.country||'').toLowerCase().includes(search.toLowerCase()))
    if(segment==='compliant')rows=rows.filter(r=>r.compliance_status==='compliant')
    else if(segment==='watchlist')rows=rows.filter(r=>Number(r.risk_score||0)>=40&&Number(r.risk_score||0)<70)
    else if(segment==='highrisk')rows=rows.filter(r=>Number(r.risk_score||0)>=70)
    return[...rows].sort((a,b)=>{
      if(sort==='risk')return(Number(b.risk_score)||0)-(Number(a.risk_score)||0)
      if(sort==='country')return String(a.country||'').localeCompare(String(b.country||''))
      return String(a.supplier_name||'').localeCompare(String(b.supplier_name||''))
    })
  },[d.rows,search,segment,sort])

  const compliancePct=useMemo(()=>d.rows.length?Math.round(d.rows.filter(r=>r.compliance_status==='compliant').length/d.rows.length*100):0,[d.rows])
  const highRisk=useMemo(()=>d.rows.filter(r=>Number(r.risk_score||0)>=70).length,[d.rows])
  const avgRisk=useMemo(()=>d.rows.length?(d.rows.reduce((s,r)=>s+(Number(r.risk_score)||0),0)/d.rows.length).toFixed(1):'0',[d.rows])
  const countries=useMemo(()=>new Set(d.rows.map(r=>String(r.country||''))).size,[d.rows])
  const riskPieData=useMemo(()=>[{name:'Low',value:d.rows.filter(r=>Number(r.risk_score||0)<40).length},{name:'Watch',value:d.rows.filter(r=>Number(r.risk_score||0)>=40&&Number(r.risk_score||0)<70).length},{name:'High',value:highRisk},{name:'Unknown',value:d.rows.filter(r=>!r.risk_score).length}].filter(x=>x.value>0),[d.rows,highRisk])
  const countryData=useMemo(()=>Array.from(d.rows.reduce((m,r)=>{const c=String(r.country||'Unknown');m.set(c,(m.get(c)||0)+1);return m},new Map<string,number>())).map(([country,count])=>({country:country.substring(0,12),count})).sort((a,b)=>b.count-a.count).slice(0,7),[d.rows])
  const riskDrivers=useMemo(()=>[{label:'High geo-political risk',count:d.rows.filter(r=>Number(r.geopolitical_risk||0)>60).length,color:'#ef4444'},{label:'Low delivery score',count:d.rows.filter(r=>r.delivery_score&&Number(r.delivery_score)<70).length,color:'#f59e0b'},{label:'Non-compliant',count:d.rows.filter(r=>r.compliance_status&&r.compliance_status!=='compliant').length,color:'#f97316'},{label:'Long lead time',count:d.rows.filter(r=>Number(r.lead_time_days||0)>45).length,color:'#6b7280'},{label:'Financial risk flag',count:d.rows.filter(r=>Number(r.financial_risk||0)>60).length,color:'#ef4444'}].filter(x=>x.count>0),[d.rows])
  const insights=useMemo(()=>{if(!d.rows.length)return[];return[`${compliancePct}% compliance rate across ${d.rows.length} suppliers`,highRisk>0?`${highRisk} high-risk suppliers need attention`:null,`${countries} countries represented in supply base`].filter(Boolean) as string[]},[d.rows,compliancePct,highRisk,countries])

  function saveView(){if(!saveViewName.trim())return;const nv=[...savedViews,{name:saveViewName,segment,search}];setSavedViews(nv);localStorage.setItem('vm-sv-supplyintel',JSON.stringify(nv));setSaveViewName('')}
  function exportCSV(){const rows=filtered.filter(r=>d.unlockedIds.has(String(r.id)));if(!rows.length)return;const cols=['supplier_name','country','category','risk_score','compliance_status','delivery_score','lead_time_days'];const csv=[cols.join(','),...rows.map(r=>cols.map(c=>JSON.stringify(safeRender(r[c])??'')).join(','))].join('\n');const a=document.createElement('a');a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(csv);a.download='supplyintel-unlocked.csv';a.click()}

  function tabs(row:Record<string,unknown>,unlocked:boolean):{label:string;content:ReactNode}[]{
    const m=!unlocked
    return[
      {label:'Supplier',content:<div className="space-y-5"><DrawerSection title="Profile"><DrawerField label="Name" value={safeRender(row.supplier_name)}/><DrawerField label="Country" value={safeRender(row.country)}/><DrawerField label="Category" value={safeRender(row.category)}/><DrawerField label="Employees" value={safeRender(row.employee_count)}/></DrawerSection><DrawerSection title="Contact"><DrawerField label="Email" value={safeRender(row.contact_email)} masked={m}/><DrawerField label="Phone" value={safeRender(row.contact_phone)} masked={m}/></DrawerSection></div>},
      {label:'Compliance',content:<div className="space-y-5"><DrawerSection title="Status"><DrawerField label="Compliance" value={safeRender(row.compliance_status)}/><DrawerField label="ISO Certified" value={safeRender(row.iso_certified)}/><DrawerField label="Certifications" value={safeRender(row.certifications)}/></DrawerSection></div>},
      {label:'Geography',content:<div className="space-y-5"><DrawerSection title="Location"><DrawerField label="Country" value={safeRender(row.country)}/><DrawerField label="Region" value={safeRender(row.region)}/><DrawerField label="Geo-political Risk" value={safeRender(row.geopolitical_risk)}/><DrawerField label="Lead Time (days)" value={safeRender(row.lead_time_days)}/></DrawerSection></div>},
      {label:'Risk',content:<div className="space-y-5"><DrawerSection title="Risk Metrics"><DrawerField label="Risk Score" value={safeRender(row.risk_score)}/><DrawerField label="Delivery Score" value={safeRender(row.delivery_score)}/><DrawerField label="Financial Risk" value={safeRender(row.financial_risk)} masked={m}/><DrawerField label="Risk Category" value={safeRender(row.risk_category)}/></DrawerSection></div>},
    ]
  }

  return(
    <div className="h-full bg-gray-50 dark:bg-gray-950 flex flex-col">
      {/* Header — Risk strip */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">🔗 Supplier Risk Board</h1>
          <div className="flex items-center gap-2">
            <button onClick={exportCSV} className="flex items-center gap-1 text-xs border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-1.5 text-gray-600 hover:text-orange-600 hover:border-orange-300 transition-colors"><Download className="w-3 h-3"/>Export</button>
            <div className="flex items-center gap-1"><input value={saveViewName} onChange={e=>setSaveViewName(e.target.value)} placeholder="Save view…" className="text-xs border border-gray-200 dark:border-gray-700 rounded-xl px-2 py-1.5 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 placeholder:text-gray-400 outline-none w-24"/><button onClick={saveView} className="p-1.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-500 hover:text-orange-600 hover:border-orange-300 transition-colors"><BookmarkPlus className="w-3.5 h-3.5"/></button></div>
          </div>
        </div>
        {/* KPI strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          {[{label:'Compliance Rate',value:`${compliancePct}%`,icon:<CheckCircle className="w-4 h-4 text-emerald-500"/>,color:'text-emerald-600'},{label:'High Risk Suppliers',value:highRisk,icon:<AlertTriangle className="w-4 h-4 text-red-500"/>,color:'text-red-600'},{label:'Avg Risk Score',value:avgRisk,icon:<ShieldAlert className="w-4 h-4 text-amber-500"/>,color:'text-amber-600'},{label:'Countries',value:countries,icon:<Globe className="w-4 h-4 text-blue-500"/>,color:'text-blue-600'}].map(({label,value,icon,color})=>(
            <div key={label} className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 flex items-center gap-3">
              <div className="p-1.5 rounded-lg bg-white dark:bg-gray-700 shadow-sm">{icon}</div>
              <div><div className="text-xs text-gray-500 uppercase tracking-wider">{label}</div><div className={`text-xl font-bold ${color}`}>{value}</div></div>
            </div>
          ))}
        </div>
        {/* Search + segment */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search suppliers…" className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 placeholder:text-gray-400 outline-none w-48"/></div>
          {(['all','compliant','watchlist','highrisk'] as const).map(s=><button key={s} onClick={()=>setSegment(s)} className={`text-xs px-3 py-1 rounded-full font-medium transition-colors ${segment===s?'bg-orange-600 text-white':'text-gray-500 hover:text-gray-900 dark:hover:text-gray-100'}`}>{s==='all'?'All':s==='compliant'?'Compliant':s==='watchlist'?'Watchlist':'High Risk'}</button>)}
          <select value={sort} onChange={e=>setSort(e.target.value as typeof sort)} className="text-xs border border-gray-200 dark:border-gray-700 rounded-xl px-2 py-1.5 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 outline-none ml-auto">
            <option value="risk">Sort: Risk Score</option><option value="name">Sort: Name</option><option value="country">Sort: Country</option>
          </select>
        </div>
        {savedViews.length>0&&<div className="flex gap-1.5 mt-2 flex-wrap">{savedViews.map((v,i)=><button key={i} onClick={()=>{setSegment(v.segment as typeof segment);setSearch(v.search)}} className="text-xs px-2 py-0.5 bg-orange-50 dark:bg-orange-900/20 text-orange-600 rounded-full border border-orange-100 dark:border-orange-800 hover:bg-orange-100 transition-colors">{v.name}</button>)}</div>}
        {insights.length>0&&<div className="flex gap-4 mt-2">{insights.map((ins,i)=><div key={i} className="flex items-center gap-1"><TrendingDown className="w-3 h-3 text-orange-500"/><span className="text-xs text-gray-500">{ins}</span></div>)}</div>}
      </div>

      {d.error&&<div className="mx-6 mt-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3 text-sm text-red-600">{d.error}</div>}

      {/* Middle — charts + risk drivers */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 px-6 pt-4">
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5">
          <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Risk Distribution</div>
          <div className="text-xs text-gray-400 mb-3">Supplier risk tier breakdown</div>
          {riskPieData.length>0?(
            <><ResponsiveContainer width="100%" height={140}><PieChart><Pie data={riskPieData} cx="50%" cy="50%" innerRadius={35} outerRadius={60} dataKey="value" paddingAngle={3}>{riskPieData.map((_,i)=><Cell key={i} fill={DONUT_COLORS[i%DONUT_COLORS.length]}/>)}</Pie><Tooltip contentStyle={{fontSize:11,borderRadius:8}}/></PieChart></ResponsiveContainer>
            <div className="grid grid-cols-2 gap-1.5 mt-2">{riskPieData.map((item,i)=><div key={item.name} className="flex items-center gap-1.5 text-xs"><div className="w-2 h-2 rounded-full shrink-0" style={{background:DONUT_COLORS[i%DONUT_COLORS.length]}}/><span className="text-gray-500 flex-1">{item.name}</span><span className="font-semibold text-gray-700 dark:text-gray-300">{item.value}</span></div>)}</div></>
          ):<div className="h-32 flex flex-col items-center justify-center text-gray-300 dark:text-gray-700 text-xs"><ShieldAlert className="w-6 h-6 mb-1"/>Risk data pending</div>}
        </div>
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5">
          <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">By Country</div>
          <div className="text-xs text-gray-400 mb-3">Supplier geographic spread</div>
          {countryData.length>0?<ResponsiveContainer width="100%" height={160}><BarChart data={countryData} layout="vertical"><XAxis type="number" tick={{fontSize:9}} axisLine={false} tickLine={false}/><YAxis type="category" dataKey="country" tick={{fontSize:9}} width={64} axisLine={false} tickLine={false}/><Tooltip contentStyle={{fontSize:10,borderRadius:6}}/><Bar dataKey="count" fill="#f97316" radius={[0,3,3,0]}/></BarChart></ResponsiveContainer>:<div className="h-36 flex flex-col items-center justify-center text-gray-300 dark:text-gray-700 text-xs"><Globe className="w-6 h-6 mb-1"/>Geographic data pending</div>}
        </div>
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5">
          <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Top Risk Drivers</div>
          <div className="text-xs text-gray-400 mb-3">Computed from supplier signals</div>
          {riskDrivers.length>0?(
            <div className="space-y-2.5">{riskDrivers.map(({label,count,color})=>(
              <div key={label} className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full shrink-0" style={{background:color}}/>
                <span className="text-xs text-gray-600 dark:text-gray-400 flex-1">{label}</span>
                <span className="text-xs font-bold" style={{color}}>{count}</span>
              </div>
            ))}</div>
          ):<div className="flex flex-col items-center justify-center text-gray-300 dark:text-gray-700 text-xs py-4"><AlertTriangle className="w-6 h-6 mb-1"/>No risk signals detected</div>}
        </div>
      </div>

      {/* Bottom — Directory table */}
      <div className="flex-1 overflow-y-auto mx-6 my-4 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800 sticky top-0 bg-white dark:bg-gray-900 z-10">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Supplier Directory <span className="text-gray-400 font-normal ml-1">({filtered.length})</span></h3>
          <button onClick={d.selectAll} className="text-xs text-orange-600 hover:text-orange-700 font-medium">Select all</button>
        </div>
        {d.loading?<div className="p-10 text-center"><div className="space-y-2">{[...Array(5)].map((_,i)=><div key={i} className="h-10 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse"/>)}</div></div>:filtered.length===0?<div className="p-10 text-center"><div className="text-4xl mb-3">🔗</div><div className="text-sm text-gray-500">No suppliers found</div><button onClick={()=>{setSearch('');setSegment('all')}} className="mt-3 text-xs text-orange-600">Clear filters</button></div>:(
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead><tr className="bg-gray-50 dark:bg-gray-800/50 text-left sticky top-0">
              <th className="px-4 py-3 w-8"><input type="checkbox" onChange={e=>e.target.checked?d.selectAll():d.clearSelection()}/></th>
              <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Supplier</th>
              <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Country</th>
              <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Category</th>
              <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Risk Score</th>
              <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Compliance</th>
              <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Delivery</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
              {filtered.map(row=>{
                const id=String(row.id);const unlocked=d.unlockedIds.has(id);const selected=d.selectedIds.has(id)
                const risk=Number(row.risk_score||0)
                return<tr key={id} onClick={()=>d.setDrawerRow(row)} className={`cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors ${selected?'bg-orange-50/50 dark:bg-orange-900/10':''}`}>
                  <td className="px-4 py-3" onClick={e=>{e.stopPropagation();d.toggleSelect(id)}}><input type="checkbox" checked={selected} onChange={()=>d.toggleSelect(id)}/></td>
                  <td className="px-4 py-3"><div className="flex items-center gap-2">{!unlocked&&<Lock className="w-3 h-3 text-gray-400 shrink-0"/>}<span className="font-medium text-gray-900 dark:text-gray-100">{safeRender(row.supplier_name)||'—'}</span>{unlocked&&<span className="text-[10px] text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 px-1 py-0.5 rounded-full">✓</span>}</div></td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{safeRender(row.country)||'—'}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{safeRender(row.category)||'—'}</td>
                  <td className="px-4 py-3"><div className="flex items-center gap-1.5"><div className="w-12 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden"><div className="h-full rounded-full" style={{width:`${risk}%`,background:riskColor(risk)}}/></div><span className="text-xs font-mono font-semibold" style={{color:riskColor(risk)}}>{risk}</span></div></td>
                  <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${row.compliance_status==='compliant'?'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400':'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'}`}>{safeRender(row.compliance_status)||'Unknown'}</span></td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400 text-xs">{safeRender(row.delivery_score)||'—'}</td>
                </tr>
              })}
            </tbody>
          </table></div>
        )}
      </div>

      <UnlockBar selectedCount={d.selectedIds.size} newCount={Array.from(d.selectedIds).filter(id=>!d.unlockedIds.has(id)).length} unlocking={d.unlocking} creditBalance={d.creditBalance} onUnlock={d.handleUnlock} onClear={d.clearSelection}/>
      {d.drawerRow&&<Drawer open={!!d.drawerRow} onClose={()=>d.setDrawerRow(null)} title={String(d.drawerRow.supplier_name??'—')} isUnlocked={d.unlockedIds.has(String(d.drawerRow.id))} onUnlock={()=>{d.toggleSelect(String(d.drawerRow!.id));d.handleUnlock()}} unlocking={d.unlocking} tabs={tabs(d.drawerRow,d.unlockedIds.has(String(d.drawerRow.id)))}/>}
    </div>
  )
}
