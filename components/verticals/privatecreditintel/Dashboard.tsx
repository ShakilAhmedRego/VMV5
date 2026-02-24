// @ts-nocheck
'use client'
import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useVerticalData, safeRender } from '../shared/useVerticalData'
import { VERTICALS } from '@/lib/verticals'
import UnlockBar from '../shared/UnlockBar'
import Drawer, { DrawerField, DrawerSection } from '../shared/Drawer'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { Lock, Search, Download, BookmarkPlus, AlertTriangle, ShieldAlert, TrendingDown, Zap, Flag } from 'lucide-react'
import type { ReactNode } from 'react'

const vertical = VERTICALS.privatecreditintel
const RISK_COLORS:Record<string,string>={low:'#10b981',medium:'#f59e0b',high:'#ef4444',critical:'#dc2626'}

function riskLevel(score:number){if(score<30)return'low';if(score<60)return'medium';if(score<80)return'high';return'critical'}
function fmt$(n:number){if(n>=1e9)return`$${(n/1e9).toFixed(1)}B`;if(n>=1e6)return`$${(n/1e6).toFixed(0)}M`;if(n>=1e3)return`$${(n/1e3).toFixed(0)}K`;return`$${n}`}

export default function PrivateCreditIntelDashboard() {
  const [userId,setUserId]=useState<string|undefined>()
  useEffect(()=>{supabase.auth.getUser().then(({data})=>setUserId(data.user?.id));},[])
  const d=useVerticalData(vertical,userId)
  const [search,setSearch]=useState('')
  const [segment,setSegment]=useState<'all'|'low'|'medium'|'high'>('all')
  const [sort,setSort]=useState<'risk'|'exposure'|'name'>('risk')
  const [savedViews,setSavedViews]=useState<{name:string;segment:string;search:string}[]>([])
  const [saveViewName,setSaveViewName]=useState('')

  useEffect(()=>{try{const sv=localStorage.getItem('vm-sv-privatecreditintel');if(sv)setSavedViews(JSON.parse(sv))}catch{}},[])

  const filtered=useMemo(()=>{
    let rows=d.rows
    if(search)rows=rows.filter(r=>String(r.company_name||'').toLowerCase().includes(search.toLowerCase())||String(r.industry||'').toLowerCase().includes(search.toLowerCase()))
    if(segment==='low')rows=rows.filter(r=>Number(r.credit_risk_score||r.risk_score||50)<30)
    else if(segment==='medium')rows=rows.filter(r=>{const s=Number(r.credit_risk_score||r.risk_score||50);return s>=30&&s<60})
    else if(segment==='high')rows=rows.filter(r=>Number(r.credit_risk_score||r.risk_score||50)>=60)
    return[...rows].sort((a,b)=>{
      if(sort==='risk')return(Number(b.credit_risk_score||b.risk_score||0))-(Number(a.credit_risk_score||a.risk_score||0))
      if(sort==='exposure')return(Number(b.exposure||b.loan_amount||0))-(Number(a.exposure||a.loan_amount||0))
      return String(a.company_name||'').localeCompare(String(b.company_name||''))
    })
  },[d.rows,search,segment,sort])

  const totalExposure=useMemo(()=>d.rows.reduce((s,r)=>s+(Number(r.exposure||r.loan_amount||0)),0),[d.rows])
  const avgRisk=useMemo(()=>d.rows.length?(d.rows.reduce((s,r)=>s+(Number(r.credit_risk_score||r.risk_score||50)),0)/d.rows.length).toFixed(0):'0',[d.rows])
  const highRiskCount=useMemo(()=>d.rows.filter(r=>Number(r.credit_risk_score||r.risk_score||0)>=60).length,[d.rows])
  const delinquent=useMemo(()=>d.rows.filter(r=>r.delinquent===true||r.delinquency_flag===true||r.delinquency_status==='delinquent').length,[d.rows])
  const topAtRisk=useMemo(()=>[...d.rows].sort((a,b)=>(Number(b.credit_risk_score||b.risk_score||0))-(Number(a.credit_risk_score||a.risk_score||0))).slice(0,6),[d.rows])
  const exposureBuckets=useMemo(()=>[{label:'<$1M',count:d.rows.filter(r=>Number(r.exposure||r.loan_amount||0)<1e6).length,color:'#10b981'},{label:'$1-5M',count:d.rows.filter(r=>{const e=Number(r.exposure||r.loan_amount||0);return e>=1e6&&e<5e6}).length,color:'#3b82f6'},{label:'$5-20M',count:d.rows.filter(r=>{const e=Number(r.exposure||r.loan_amount||0);return e>=5e6&&e<20e6}).length,color:'#f59e0b'},{label:'$20M+',count:d.rows.filter(r=>Number(r.exposure||r.loan_amount||0)>=20e6).length,color:'#ef4444'}].filter(x=>x.count>0),[d.rows])
  const riskDist=useMemo(()=>['low','medium','high','critical'].map(l=>({level:l,count:d.rows.filter(r=>riskLevel(Number(r.credit_risk_score||r.risk_score||50))===l).length})).filter(x=>x.count>0),[d.rows])
  const delinquencyFlags=useMemo(()=>[...d.rows].filter(r=>r.delinquent===true||r.delinquency_flag===true||Number(r.days_past_due||0)>0||r.delinquency_status==='delinquent').sort((a,b)=>(Number(b.credit_risk_score||b.risk_score||0))-(Number(a.credit_risk_score||a.risk_score||0))).slice(0,5),[d.rows])
  const insights=useMemo(()=>{if(!d.rows.length)return[];return[`$${totalExposure>=1e9?(totalExposure/1e9).toFixed(1)+'B':(totalExposure/1e6).toFixed(0)+'M'} total exposure across ${d.rows.length} borrowers`,highRiskCount>0?`${highRiskCount} high-risk borrowers require attention`:null,delinquent>0?`${delinquent} delinquency flags detected`:null].filter(Boolean) as string[]},[d.rows,totalExposure,highRiskCount,delinquent])

  function saveView(){if(!saveViewName.trim())return;const nv=[...savedViews,{name:saveViewName,segment,search}];setSavedViews(nv);localStorage.setItem('vm-sv-privatecreditintel',JSON.stringify(nv));setSaveViewName('')}
  function exportCSV(){const rows=filtered.filter(r=>d.unlockedIds.has(String(r.id)));if(!rows.length)return;const cols=['company_name','industry','credit_risk_score','exposure','loan_amount','delinquency_status'];const csv=[cols.join(','),...rows.map(r=>cols.map(c=>JSON.stringify(safeRender(r[c])??'')).join(','))].join('\n');const a=document.createElement('a');a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(csv);a.download='privatecredit-unlocked.csv';a.click()}

  function tabs(row:Record<string,unknown>,unlocked:boolean):{label:string;content:ReactNode}[]{
    const m=!unlocked
    return[
      {label:'Borrower',content:<div className="space-y-5"><DrawerSection title="Company"><DrawerField label="Name" value={safeRender(row.company_name)}/><DrawerField label="Industry" value={safeRender(row.industry)}/><DrawerField label="Revenue" value={safeRender(row.revenue)} masked={m}/><DrawerField label="EBITDA" value={safeRender(row.ebitda)} masked={m}/></DrawerSection></div>},
      {label:'Exposure',content:<div className="space-y-5"><DrawerSection title="Loan"><DrawerField label="Exposure" value={row.exposure?fmt$(Number(row.exposure)):safeRender(row.loan_amount)} masked={m}/><DrawerField label="Interest Rate" value={safeRender(row.interest_rate)}/><DrawerField label="Maturity Date" value={safeRender(row.maturity_date)}/><DrawerField label="Collateral" value={safeRender(row.collateral_type)}/></DrawerSection></div>},
      {label:'Filings',content:<div className="space-y-5"><DrawerSection title="Legal"><DrawerField label="UCC Filings" value={safeRender(row.ucc_filings)}/><DrawerField label="Liens" value={safeRender(row.lien_count)}/><DrawerField label="Judgments" value={safeRender(row.judgment_count)} masked={m}/><DrawerField label="Bankruptcy History" value={safeRender(row.bankruptcy_history)} masked={m}/></DrawerSection></div>},
      {label:'Risk',content:<div className="space-y-5"><DrawerSection title="Risk Signals"><DrawerField label="Risk Score" value={safeRender(row.credit_risk_score||row.risk_score)}/><DrawerField label="Delinquent" value={safeRender(row.delinquent||row.delinquency_status)}/><DrawerField label="Days Past Due" value={safeRender(row.days_past_due)}/><DrawerField label="Risk Flags" value={safeRender(row.risk_flags)} masked={m}/></DrawerSection></div>},
    ]
  }

  // SVG risk gauge
  function RiskGauge({value}:{value:number}){
    const pct=Math.min(100,Math.max(0,value))/100
    const angle=pct*180-90
    const rad=angle*(Math.PI/180)
    const cx=100,cy=90,r=70
    const x=cx+r*Math.cos(rad),y=cy+r*Math.sin(rad)
    const color=value<30?'#10b981':value<60?'#f59e0b':value<80?'#ef4444':'#dc2626'
    return<svg viewBox="0 0 200 110" className="w-full h-28">
      <path d="M30 90 A 70 70 0 0 1 170 90" fill="none" stroke="#e5e7eb" strokeWidth={16} strokeLinecap="round"/>
      <path d="M30 90 A 70 70 0 0 1 170 90" fill="none" stroke={color} strokeWidth={16} strokeLinecap="round" strokeDasharray={`${pct*220} 220`}/>
      <line x1={cx} y1={cy} x2={x} y2={y} stroke={color} strokeWidth={3} strokeLinecap="round"/>
      <circle cx={cx} cy={cy} r={6} fill={color}/>
      <text x={cx} y={cy+18} textAnchor="middle" fontSize={22} fontWeight="bold" fill={color}>{value}</text>
      <text x={cx} y={cy+32} textAnchor="middle" fontSize={9} fill="#9ca3af">AVG RISK SCORE</text>
      <text x="30" y="106" fontSize={9} fill="#9ca3af">LOW</text>
      <text x="156" y="106" fontSize={9} fill="#9ca3af">CRITICAL</text>
    </svg>
  }

  return(
    <div className="h-full bg-gray-50 dark:bg-gray-950 flex flex-col">
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-6 py-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">🏦 Risk Console</h1>
            {insights.length>0&&<p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5 flex items-center gap-1"><Zap className="w-3 h-3"/>{insights[0]}</p>}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={exportCSV} className="flex items-center gap-1 text-xs border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-1.5 text-gray-600 hover:text-amber-600 hover:border-amber-300 transition-colors"><Download className="w-3 h-3"/>Export</button>
            <div className="flex items-center gap-1"><input value={saveViewName} onChange={e=>setSaveViewName(e.target.value)} placeholder="Save view…" className="text-xs border border-gray-200 dark:border-gray-700 rounded-xl px-2 py-1.5 bg-white dark:bg-gray-800 text-gray-600 placeholder:text-gray-400 outline-none w-24"/><button onClick={saveView} className="p-1.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-500 hover:text-amber-600 hover:border-amber-300 transition-colors"><BookmarkPlus className="w-3.5 h-3.5"/></button></div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search borrowers…" className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 placeholder:text-gray-400 outline-none w-44"/></div>
          {(['all','low','medium','high'] as const).map(s=><button key={s} onClick={()=>setSegment(s)} className={`text-xs px-3 py-1 rounded-full font-medium transition-colors capitalize ${segment===s?'bg-amber-600 text-white':'text-gray-500 hover:text-gray-900 dark:hover:text-gray-100'}`}>{s==='all'?`All (${d.rows.length})`:s}</button>)}
          <select value={sort} onChange={e=>setSort(e.target.value as typeof sort)} className="text-xs border border-gray-200 dark:border-gray-700 rounded-xl px-2 py-1.5 bg-white dark:bg-gray-800 text-gray-600 outline-none ml-auto">
            <option value="risk">Sort: Risk Score</option><option value="exposure">Sort: Exposure</option><option value="name">Sort: Name</option>
          </select>
        </div>
        {savedViews.length>0&&<div className="flex gap-1.5 mt-2 flex-wrap">{savedViews.map((v,i)=><button key={i} onClick={()=>{setSegment(v.segment as typeof segment);setSearch(v.search)}} className="text-xs px-2 py-0.5 bg-amber-50 dark:bg-amber-900/20 text-amber-600 rounded-full border border-amber-100 hover:bg-amber-100 transition-colors">{v.name}</button>)}</div>}
      </div>

      {d.error&&<div className="mx-6 mt-4 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-600">{d.error}</div>}

      <div className="flex-1 overflow-hidden flex">
        {/* Left — gauge + bars + top at risk */}
        <div className="w-64 shrink-0 border-r border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-y-auto p-4 space-y-4">
          {/* Risk gauge */}
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Portfolio Risk Posture</div>
            <RiskGauge value={Number(avgRisk)||0}/>
          </div>
          {/* KPIs */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-2 text-center"><div className="text-lg font-bold text-amber-600">{highRiskCount}</div><div className="text-[10px] text-gray-400">High Risk</div></div>
            <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-2 text-center"><div className="text-lg font-bold text-red-600">{delinquent}</div><div className="text-[10px] text-gray-400">Delinquent</div></div>
          </div>
          {/* Exposure bars */}
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Exposure Buckets</div>
            {exposureBuckets.length>0?<ResponsiveContainer width="100%" height={100}><BarChart data={exposureBuckets}><XAxis dataKey="label" tick={{fontSize:9}} axisLine={false} tickLine={false}/><YAxis hide/><Tooltip contentStyle={{fontSize:10,borderRadius:6}}/><Bar dataKey="count" radius={[3,3,0,0]}>{exposureBuckets.map((e,i)=><Cell key={i} fill={e.color}/>)}</Bar></BarChart></ResponsiveContainer>:<div className="h-24 flex items-center justify-center text-gray-300 dark:text-gray-700 text-xs">No exposure data</div>}
          </div>
          {/* Risk distribution */}
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Risk Distribution</div>
            {riskDist.map(({level,count})=>{const pct=d.rows.length?Math.round(count/d.rows.length*100):0;const color=RISK_COLORS[level]||'#9ca3af';return<div key={level} className="mb-1.5"><div className="flex justify-between text-xs mb-0.5"><span className="capitalize text-gray-600 dark:text-gray-400">{level}</span><span className="font-semibold" style={{color}}>{count}</span></div><div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden"><div className="h-full rounded-full transition-all" style={{width:`${pct}%`,background:color}}/></div></div>})}
          </div>
          {/* Top at risk */}
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1"><ShieldAlert className="w-3 h-3 text-red-500"/>Top At Risk</div>
            {topAtRisk.map(row=>{
              const score=Number(row.credit_risk_score||row.risk_score||0)
              const lvl=riskLevel(score)
              const color=RISK_COLORS[lvl]
              const unlocked=d.unlockedIds.has(String(row.id))
              return<div key={String(row.id)} onClick={()=>d.setDrawerRow(row)} className="flex items-center gap-2 mb-2 p-2 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors">
                <div className="w-1.5 h-8 rounded-full shrink-0" style={{background:color}}/>
                <div className="flex-1 min-w-0">{!unlocked&&<Lock className="w-2.5 h-2.5 text-gray-400 inline mr-0.5"/>}<span className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">{safeRender(row.company_name)||'—'}</span><div className="text-[10px] text-gray-400">{safeRender(row.industry)||'—'}</div></div>
                <span className="text-xs font-bold shrink-0" style={{color}}>{score}</span>
              </div>
            })}
          </div>
        </div>

        {/* Right — obligations table + delinquency panel */}
        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="flex-1 overflow-y-auto">
            {d.loading?<div className="p-5 space-y-2">{[...Array(7)].map((_,i)=><div key={i} className="h-12 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse"/>)}</div>:filtered.length===0?(
              <div className="flex flex-col items-center justify-center py-16"><div className="text-5xl mb-3">🏦</div><div className="text-sm font-medium text-gray-500">No borrowers found</div><button onClick={()=>{setSearch('');setSegment('all')}} className="mt-3 text-xs text-amber-600 font-medium">Clear filters</button></div>
            ):(
              <div className="overflow-x-auto"><table className="w-full text-xs">
                <thead><tr className="bg-gray-50 dark:bg-gray-800/50 sticky top-0 z-10">
                  <th className="px-4 py-3 w-8"><input type="checkbox" onChange={e=>e.target.checked?d.selectAll():d.clearSelection()}/></th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-500 uppercase tracking-wider">Borrower</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-500 uppercase tracking-wider">Industry</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-500 uppercase tracking-wider">Risk Score</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-500 uppercase tracking-wider">Exposure</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-500 uppercase tracking-wider">Rate</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                  {filtered.map(row=>{
                    const id=String(row.id);const unlocked=d.unlockedIds.has(id);const selected=d.selectedIds.has(id)
                    const score=Number(row.credit_risk_score||row.risk_score||0);const lvl=riskLevel(score);const color=RISK_COLORS[lvl]
                    const isDelinquent=row.delinquent===true||row.delinquency_flag===true||row.delinquency_status==='delinquent'
                    return<tr key={id} onClick={()=>d.setDrawerRow(row)} className={`cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors ${selected?'bg-amber-50/50 dark:bg-amber-900/10':''} ${isDelinquent?'border-l-2 border-red-400':''}`}>
                      <td className="px-4 py-3" onClick={e=>{e.stopPropagation();d.toggleSelect(id)}}><input type="checkbox" checked={selected} onChange={()=>d.toggleSelect(id)}/></td>
                      <td className="px-4 py-3"><div className="flex items-center gap-1">{!unlocked&&<Lock className="w-3 h-3 text-gray-400 shrink-0"/>}<span className="font-medium text-gray-900 dark:text-gray-100 truncate max-w-[140px]">{safeRender(row.company_name)||'—'}</span>{unlocked&&<span className="text-[10px] text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 px-1 rounded-full">✓</span>}{isDelinquent&&<Flag className="w-2.5 h-2.5 text-red-500 shrink-0"/>}</div></td>
                      <td className="px-4 py-3 text-gray-500">{safeRender(row.industry)||'—'}</td>
                      <td className="px-4 py-3"><div className="flex items-center gap-1.5"><div className="w-8 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden"><div className="h-full rounded-full" style={{width:`${score}%`,background:color}}/></div><span className="font-bold text-xs" style={{color}}>{score}</span></div></td>
                      <td className="px-4 py-3 font-medium text-gray-700 dark:text-gray-300">{unlocked&&(row.exposure||row.loan_amount)?fmt$(Number(row.exposure||row.loan_amount)):<span className="text-gray-300 dark:text-gray-700">●●●</span>}</td>
                      <td className="px-4 py-3 text-gray-500">{safeRender(row.interest_rate)||'—'}</td>
                      <td className="px-4 py-3">{isDelinquent?<span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-red-50 dark:bg-red-900/30 text-red-600">Delinquent</span>:<span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-gray-50 dark:bg-gray-800 text-gray-500">Current</span>}</td>
                    </tr>
                  })}
                </tbody>
              </table></div>
            )}
          </div>
          {/* Delinquency flags panel */}
          {delinquencyFlags.length>0&&<div className="border-t border-gray-100 dark:border-gray-800 bg-red-50/50 dark:bg-red-900/10 px-5 py-3 shrink-0">
            <div className="flex items-center gap-2 mb-2"><AlertTriangle className="w-4 h-4 text-red-500"/><span className="text-xs font-semibold text-red-700 dark:text-red-400 uppercase tracking-wider">Delinquency Flags</span></div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {delinquencyFlags.map(row=><div key={String(row.id)} onClick={()=>d.setDrawerRow(row)} className="shrink-0 bg-white dark:bg-gray-900 border border-red-200 dark:border-red-800 rounded-xl px-3 py-2 cursor-pointer hover:shadow-sm transition-all min-w-36">
                <div className="flex items-center gap-1"><Flag className="w-2.5 h-2.5 text-red-500"/>{!d.unlockedIds.has(String(row.id))&&<Lock className="w-2.5 h-2.5 text-gray-400"/>}<span className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">{safeRender(row.company_name)||'—'}</span></div>
                <div className="text-[10px] text-red-600 font-medium mt-0.5">Risk: {Number(row.credit_risk_score||row.risk_score||0)}</div>
              </div>)}
            </div>
          </div>}
        </div>
      </div>

      <UnlockBar selectedCount={d.selectedIds.size} newCount={Array.from(d.selectedIds).filter(id=>!d.unlockedIds.has(id)).length} unlocking={d.unlocking} creditBalance={d.creditBalance} onUnlock={d.handleUnlock} onClear={d.clearSelection}/>
      {d.drawerRow&&<Drawer open={!!d.drawerRow} onClose={()=>d.setDrawerRow(null)} title={String(d.drawerRow.company_name??'—')} isUnlocked={d.unlockedIds.has(String(d.drawerRow.id))} onUnlock={()=>{d.toggleSelect(String(d.drawerRow!.id));d.handleUnlock()}} unlocking={d.unlocking} tabs={tabs(d.drawerRow,d.unlockedIds.has(String(d.drawerRow.id)))}/>}
    </div>
  )
}
