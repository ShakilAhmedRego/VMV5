// @ts-nocheck
'use client'
import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useVerticalData, safeRender } from '../shared/useVerticalData'
import { VERTICALS } from '@/lib/verticals'
import UnlockBar from '../shared/UnlockBar'
import Drawer, { DrawerField, DrawerSection } from '../shared/Drawer'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { Lock, Search, Download, BookmarkPlus, Shield, AlertTriangle, ShieldAlert, Eye, Terminal, Zap } from 'lucide-react'
import type { ReactNode } from 'react'

const vertical = VERTICALS.cyberintel
const SEV_COLORS:Record<string,string>={critical:'#dc2626',high:'#ef4444',medium:'#f59e0b',low:'#22c55e',info:'#6b7280'}
const STATUS_COLORS:Record<string,string>={open:'#ef4444',contained:'#f59e0b',resolved:'#22c55e','in-progress':'#3b82f6'}

export default function CyberIntelDashboard() {
  const [userId,setUserId]=useState<string|undefined>()
  useEffect(()=>{supabase.auth.getUser().then(({data})=>setUserId(data.user?.id));},[])
  const d=useVerticalData(vertical,userId)
  const [search,setSearch]=useState('')
  const [severityFilter,setSeverityFilter]=useState<string>('all')
  const [segment,setSegment]=useState<'all'|'open'|'contained'|'resolved'>('all')
  const [sort,setSort]=useState<'risk'|'name'|'incidents'>('risk')
  const [savedViews,setSavedViews]=useState<{name:string;severity:string;segment:string;search:string}[]>([])
  const [saveViewName,setSaveViewName]=useState('')

  useEffect(()=>{try{const sv=localStorage.getItem('vm-sv-cyberintel');if(sv)setSavedViews(JSON.parse(sv))}catch{}},[])

  const filtered=useMemo(()=>{
    let rows=d.rows
    if(search)rows=rows.filter(r=>String(r.organization_name||'').toLowerCase().includes(search.toLowerCase())||String(r.industry||'').toLowerCase().includes(search.toLowerCase()))
    if(severityFilter!=='all')rows=rows.filter(r=>r.threat_severity===severityFilter||r.severity===severityFilter||r.posture_rating===severityFilter)
    if(segment!=='all')rows=rows.filter(r=>r.incident_status===segment||r.status===segment)
    return[...rows].sort((a,b)=>{
      if(sort==='risk')return(Number(b.risk_score||b.security_score||0))-(Number(a.risk_score||a.security_score||0))
      if(sort==='incidents')return(Number(b.incident_count||b.cve_count||0))-(Number(a.incident_count||a.cve_count||0))
      return String(a.organization_name||'').localeCompare(String(b.organization_name||''))
    })
  },[d.rows,search,severityFilter,segment,sort])

  const avgPosture=useMemo(()=>d.rows.length?(d.rows.reduce((s,r)=>s+(Number(r.security_score||r.posture_score||50)),0)/d.rows.length).toFixed(0):'50',[d.rows])
  const criticalCount=useMemo(()=>d.rows.filter(r=>r.threat_severity==='critical'||r.severity==='critical').length,[d.rows])
  const openIncidents=useMemo(()=>d.rows.filter(r=>r.incident_status==='open'||r.status==='open').length,[d.rows])
  const totalCVEs=useMemo(()=>d.rows.reduce((s,r)=>s+(Number(r.cve_count||r.vulnerability_count||0)),0),[d.rows])
  const incidentTimeline=useMemo(()=>['Aug','Sep','Oct','Nov','Dec','Jan'].map((m,i)=>({month:m,incidents:Math.max(0,Math.floor(d.rows.length*(0.3+i*0.05))),critical:Math.max(0,Math.floor(criticalCount*(0.2+i*0.04)))})),[d.rows.length,criticalCount])
  const vulnDist=useMemo(()=>['critical','high','medium','low','info'].map(s=>({sev:s,count:d.rows.filter(r=>r.top_vulnerability_severity===s||r.vulnerability_severity===s).length})).filter(x=>x.count>0),[d.rows])
  const topThreats=useMemo(()=>[...d.rows].sort((a,b)=>(Number(b.risk_score||b.security_score||0))-(Number(a.risk_score||a.security_score||0))).slice(0,5),[d.rows])
  const actions=useMemo(()=>{
    const acts=[]
    if(criticalCount>0)acts.push({action:`Patch critical vulnerabilities on ${criticalCount} orgs`,priority:'critical'})
    if(openIncidents>0)acts.push({action:`Investigate ${openIncidents} open incident${openIncidents!==1?'s':''}`,priority:'high'})
    if(totalCVEs>0)acts.push({action:`Review ${totalCVEs} CVEs across portfolio`,priority:'medium'})
    acts.push({action:'Run penetration test on high-exposure assets',priority:'medium'})
    acts.push({action:'Update threat intelligence feeds',priority:'low'})
    return acts.slice(0,5)
  },[criticalCount,openIncidents,totalCVEs])
  const insights=useMemo(()=>{if(!d.rows.length)return[];return[`Avg security posture: ${avgPosture}/100`,criticalCount>0?`${criticalCount} critical threats require immediate response`:null,openIncidents>0?`${openIncidents} open incidents — threat surface active`:null].filter(Boolean) as string[]},[d.rows,avgPosture,criticalCount,openIncidents])

  function saveView(){if(!saveViewName.trim())return;const nv=[...savedViews,{name:saveViewName,severity:severityFilter,segment,search}];setSavedViews(nv);localStorage.setItem('vm-sv-cyberintel',JSON.stringify(nv));setSaveViewName('')}
  function exportCSV(){const rows=filtered.filter(r=>d.unlockedIds.has(String(r.id)));if(!rows.length)return;const cols=['organization_name','industry','risk_score','threat_severity','incident_count','cve_count'];const csv=[cols.join(','),...rows.map(r=>cols.map(c=>JSON.stringify(safeRender(r[c])??'')).join(','))].join('\n');const a=document.createElement('a');a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(csv);a.download='cyberintel-unlocked.csv';a.click()}

  function tabs(row:Record<string,unknown>,unlocked:boolean):{label:string;content:ReactNode}[]{
    const m=!unlocked
    return[
      {label:'Posture',content:<div className="space-y-5"><DrawerSection title="Security Posture"><DrawerField label="Organization" value={safeRender(row.organization_name)}/><DrawerField label="Security Score" value={safeRender(row.security_score||row.posture_score)}/><DrawerField label="Risk Score" value={safeRender(row.risk_score)}/><DrawerField label="Posture Rating" value={safeRender(row.posture_rating)}/></DrawerSection></div>},
      {label:'Incidents',content:<div className="space-y-5"><DrawerSection title="Incidents"><DrawerField label="Incident Count" value={safeRender(row.incident_count)}/><DrawerField label="Status" value={safeRender(row.incident_status||row.status)}/><DrawerField label="Last Breach" value={safeRender(row.last_breach_date)} masked={m}/><DrawerField label="Breach Type" value={safeRender(row.breach_type)}/></DrawerSection></div>},
      {label:'Vulnerabilities',content:<div className="space-y-5"><DrawerSection title="CVEs"><DrawerField label="CVE Count" value={safeRender(row.cve_count||row.vulnerability_count)}/><DrawerField label="Top Severity" value={safeRender(row.top_vulnerability_severity)}/><DrawerField label="Unpatched Critical" value={safeRender(row.unpatched_critical)} masked={m}/><DrawerField label="Threat Surface" value={safeRender(row.threat_surface)} masked={m}/></DrawerSection></div>},
      {label:'Recommendations',content:<div className="space-y-5"><DrawerSection title="Actions"><DrawerField label="Immediate Action" value={safeRender(row.recommended_action)}/><DrawerField label="Patch Priority" value={safeRender(row.patch_priority)}/><DrawerField label="Insurance Impact" value={safeRender(row.insurance_impact)} masked={m}/><DrawerField label="Compliance Gap" value={safeRender(row.compliance_gap)} masked={m}/></DrawerSection></div>},
    ]
  }

  function PostureGauge({value}:{value:number}){
    const pct=Math.min(100,Math.max(0,value))/100
    const angle=pct*180-90
    const rad=angle*(Math.PI/180)
    const cx=100,cy=85,r=68
    const x=cx+r*Math.cos(rad),y=cy+r*Math.sin(rad)
    const color=value>=70?'#22c55e':value>=40?'#f59e0b':'#ef4444'
    return<svg viewBox="0 0 200 105" className="w-full h-28">
      <path d="M32 85 A 68 68 0 0 1 168 85" fill="none" stroke="#1f2937" strokeWidth={14} strokeLinecap="round"/>
      <path d="M32 85 A 68 68 0 0 1 168 85" fill="none" stroke={color} strokeWidth={14} strokeLinecap="round" strokeDasharray={`${pct*213} 213`}/>
      <line x1={cx} y1={cy} x2={x} y2={y} stroke={color} strokeWidth={2.5} strokeLinecap="round"/>
      <circle cx={cx} cy={cy} r={5} fill={color}/>
      <text x={cx} y={cy+16} textAnchor="middle" fontSize={22} fontWeight="bold" fill={color}>{value}</text>
      <text x={cx} y={cy+30} textAnchor="middle" fontSize={8} fill="#6b7280">POSTURE SCORE</text>
      <text x="32" y="100" fontSize={8} fill="#4b5563">CRITICAL</text>
      <text x="150" y="100" fontSize={8} fill="#4b5563">SECURE</text>
    </svg>
  }

  // FORCE DARK — threat center
  return(
    <div className="bg-black text-white min-h-full flex flex-col">
      {/* Header — dark */}
      <div className="bg-gray-950 border-b border-gray-800 px-6 py-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">🛡️ Threat Center</h1>
            {insights.length>0&&<p className="text-xs text-emerald-400 mt-0.5 flex items-center gap-1"><Zap className="w-3 h-3"/>{insights[0]}</p>}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={exportCSV} className="flex items-center gap-1 text-xs border border-gray-700 rounded-xl px-3 py-1.5 text-gray-300 hover:text-emerald-400 hover:border-emerald-700 transition-colors"><Download className="w-3 h-3"/>Export</button>
            <div className="flex items-center gap-1"><input value={saveViewName} onChange={e=>setSaveViewName(e.target.value)} placeholder="Save view…" className="text-xs border border-gray-700 rounded-xl px-2 py-1.5 bg-gray-900 text-gray-300 placeholder:text-gray-600 outline-none w-24"/><button onClick={saveView} className="p-1.5 rounded-xl border border-gray-700 text-gray-500 hover:text-emerald-400 hover:border-emerald-700 transition-colors"><BookmarkPlus className="w-3.5 h-3.5"/></button></div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search organizations…" className="pl-8 pr-3 py-1.5 text-sm border border-gray-700 rounded-xl bg-gray-900 text-gray-200 placeholder:text-gray-600 outline-none w-48"/></div>
          <span className="text-xs text-gray-500">Severity:</span>
          {['all','critical','high','medium','low'].map(s=><button key={s} onClick={()=>setSeverityFilter(s)} className={`text-xs px-2.5 py-1 rounded-full font-medium border transition-all capitalize ${severityFilter===s?'border-emerald-500 bg-emerald-900/30 text-emerald-400':'border-gray-700 text-gray-400 hover:border-gray-500'}`}>{s==='all'?`All (${d.rows.length})`:s}</button>)}
          <span className="text-xs text-gray-500 ml-1">Status:</span>
          {(['open','contained','resolved'] as const).map(s=><button key={s} onClick={()=>setSegment(segment===s?'all':s)} className={`text-xs px-2.5 py-1 rounded-full font-medium border transition-all capitalize ${segment===s?'border-emerald-500 bg-emerald-900/30 text-emerald-400':'border-gray-700 text-gray-400 hover:border-gray-500'}`}>{s}</button>)}
          <select value={sort} onChange={e=>setSort(e.target.value as typeof sort)} className="text-xs border border-gray-700 rounded-xl px-2 py-1.5 bg-gray-900 text-gray-400 outline-none ml-auto">
            <option value="risk">Sort: Risk Score</option><option value="incidents">Sort: Incidents</option><option value="name">Sort: Name</option>
          </select>
        </div>
        {savedViews.length>0&&<div className="flex gap-1.5 mt-2 flex-wrap">{savedViews.map((v,i)=><button key={i} onClick={()=>{setSeverityFilter(v.severity);setSegment(v.segment as typeof segment);setSearch(v.search)}} className="text-xs px-2 py-0.5 bg-emerald-900/30 text-emerald-400 rounded-full border border-emerald-800 hover:bg-emerald-900/50 transition-colors">{v.name}</button>)}</div>}
      </div>

      {d.error&&<div className="mx-6 mt-4 bg-red-900/20 border border-red-800 rounded-xl p-3 text-sm text-red-400">{d.error}</div>}

      <div className="flex-1 overflow-hidden flex">
        {/* Left — posture + incidents */}
        <div className="w-64 shrink-0 border-r border-gray-800 bg-gray-950 overflow-y-auto p-4 space-y-4">
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Portfolio Posture</div>
            <PostureGauge value={Number(avgPosture)||50}/>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-2 text-center"><div className="text-lg font-bold text-red-400">{criticalCount}</div><div className="text-[10px] text-gray-500">Critical</div></div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-2 text-center"><div className="text-lg font-bold text-amber-400">{openIncidents}</div><div className="text-[10px] text-gray-500">Open</div></div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-2 text-center"><div className="text-lg font-bold text-blue-400">{totalCVEs}</div><div className="text-[10px] text-gray-500">CVEs</div></div>
          </div>
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Incident Timeline</div>
            <ResponsiveContainer width="100%" height={100}>
              <BarChart data={incidentTimeline}><XAxis dataKey="month" tick={{fontSize:9,fill:'#6b7280'}} axisLine={false} tickLine={false}/><YAxis hide/><Tooltip contentStyle={{fontSize:10,borderRadius:6,background:'#111827',border:'1px solid #374151',color:'#d1d5db'}}/><Bar dataKey="incidents" fill="#374151" radius={[2,2,0,0]}/><Bar dataKey="critical" fill="#dc2626" radius={[2,2,0,0]}/></BarChart>
            </ResponsiveContainer>
          </div>
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1"><AlertTriangle className="w-3 h-3 text-red-500"/>Top Threat Orgs</div>
            {topThreats.map(row=>{
              const score=Number(row.risk_score||row.security_score||0);const unlocked=d.unlockedIds.has(String(row.id))
              const sev=String(row.threat_severity||row.severity||'medium');const color=SEV_COLORS[sev]||'#9ca3af'
              return<div key={String(row.id)} onClick={()=>d.setDrawerRow(row)} className="flex items-center gap-2 mb-2 p-2 rounded-xl hover:bg-gray-900 cursor-pointer transition-colors border border-transparent hover:border-gray-800">
                <div className="w-1.5 h-8 rounded-full shrink-0" style={{background:color}}/>
                <div className="flex-1 min-w-0">{!unlocked&&<Lock className="w-2.5 h-2.5 text-gray-500 inline mr-0.5"/>}<span className="text-xs font-medium text-gray-300 truncate">{safeRender(row.organization_name)||'—'}</span><div className="text-[10px] text-gray-600">{safeRender(row.industry)||'—'}</div></div>
                <span className="text-xs font-bold shrink-0" style={{color}}>{score}</span>
              </div>
            })}
          </div>
        </div>

        {/* Center — vulnerabilities list */}
        <div className="flex-1 overflow-y-auto bg-black">
          <div className="p-2">
            {d.loading?(
              <div className="space-y-2 p-3">{[...Array(7)].map((_,i)=><div key={i} className="h-12 rounded-xl bg-gray-900 animate-pulse"/>)}</div>
            ):filtered.length===0?(
              <div className="flex flex-col items-center justify-center py-16"><Shield className="w-12 h-12 text-gray-700 mb-3"/><div className="text-sm font-medium text-gray-500">No threats found</div><button onClick={()=>{setSearch('');setSeverityFilter('all');setSegment('all')}} className="mt-3 text-xs text-emerald-400 font-medium">Clear filters</button></div>
            ):(
              <div className="space-y-1.5 p-2">
                {filtered.map(row=>{
                  const id=String(row.id);const unlocked=d.unlockedIds.has(id);const selected=d.selectedIds.has(id)
                  const score=Number(row.risk_score||row.security_score||0)
                  const sev=String(row.threat_severity||row.severity||'medium');const sevColor=SEV_COLORS[sev]||'#9ca3af'
                  const status=String(row.incident_status||row.status||'open');const statColor=STATUS_COLORS[status]||'#9ca3af'
                  const cveCount=Number(row.cve_count||row.vulnerability_count||0)
                  return<div key={id} onClick={()=>d.setDrawerRow(row)} className={`flex items-center gap-3 bg-gray-950 border rounded-xl px-4 py-3 cursor-pointer hover:border-emerald-800 hover:bg-gray-900/80 transition-all group ${selected?'border-emerald-700 bg-emerald-900/10':'border-gray-800'}`}>
                    <div onClick={e=>{e.stopPropagation();d.toggleSelect(id)}} className="shrink-0"><input type="checkbox" checked={selected} onChange={()=>d.toggleSelect(id)} className="rounded accent-emerald-500"/></div>
                    <div className="w-1.5 h-8 rounded-full shrink-0" style={{background:sevColor}}/>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2"><Eye className="w-3 h-3 text-gray-600 group-hover:text-emerald-500 transition-colors"/>{!unlocked&&<Lock className="w-3 h-3 text-gray-600 shrink-0"/>}<span className="font-mono font-semibold text-sm text-gray-200 truncate">{safeRender(row.organization_name)||'—'}</span>{unlocked&&<span className="text-[10px] text-emerald-400 bg-emerald-900/30 px-1.5 py-0.5 rounded-full">✓</span>}</div>
                      <div className="text-xs text-gray-600 mt-0.5">{safeRender(row.industry)||'—'}</div>
                    </div>
                    <div className="shrink-0 flex items-center gap-2">
                      {cveCount>0&&<span className="text-xs text-gray-500 font-mono">{cveCount} CVEs</span>}
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-bold capitalize" style={{background:sevColor+'20',color:sevColor}}>{sev}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-mono capitalize" style={{background:statColor+'20',color:statColor}}>{status}</span>
                      <span className="font-mono text-sm font-bold" style={{color:score>=70?'#ef4444':score>=40?'#f59e0b':'#22c55e'}}>{score}</span>
                    </div>
                  </div>
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right — actions panel */}
        <div className="w-60 shrink-0 border-l border-gray-800 bg-gray-950 overflow-y-auto p-4 space-y-4">
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1"><Terminal className="w-3 h-3 text-emerald-500"/>Recommended Actions</div>
            {actions.map((a,i)=><div key={i} className={`mb-2 p-2.5 rounded-xl border ${a.priority==='critical'?'border-red-800 bg-red-900/20':a.priority==='high'?'border-amber-800 bg-amber-900/20':'border-gray-800 bg-gray-900'}`}>
              <div className="flex items-start gap-1.5"><ShieldAlert className={`w-3 h-3 mt-0.5 shrink-0 ${a.priority==='critical'?'text-red-400':a.priority==='high'?'text-amber-400':'text-gray-500'}`}/><span className="text-xs text-gray-300">{a.action}</span></div>
              <span className={`text-[10px] font-bold uppercase mt-1 inline-block ${a.priority==='critical'?'text-red-400':a.priority==='high'?'text-amber-400':'text-gray-500'}`}>{a.priority}</span>
            </div>)}
          </div>
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Vuln. Severity Mix</div>
            {vulnDist.length>0?<div className="space-y-1.5">{vulnDist.map(({sev,count})=>{const pct=d.rows.length?Math.round(count/d.rows.length*100):0;const color=SEV_COLORS[sev]||'#9ca3af';return<div key={sev}><div className="flex justify-between text-xs mb-0.5"><span className="capitalize text-gray-500">{sev}</span><span className="font-mono" style={{color}}>{count}</span></div><div className="h-1 bg-gray-800 rounded-full overflow-hidden"><div className="h-full rounded-full" style={{width:`${pct}%`,background:color}}/></div></div>})}</div>:<div className="text-xs text-gray-600">No vuln data</div>}
          </div>
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Insights</div>
            {insights.map((ins,i)=><div key={i} className="flex items-start gap-1.5 mb-2"><Zap className="w-3 h-3 text-emerald-500 mt-0.5 shrink-0"/><span className="text-xs text-gray-400">{ins}</span></div>)}
          </div>
        </div>
      </div>

      <UnlockBar selectedCount={d.selectedIds.size} newCount={Array.from(d.selectedIds).filter(id=>!d.unlockedIds.has(id)).length} unlocking={d.unlocking} creditBalance={d.creditBalance} onUnlock={d.handleUnlock} onClear={d.clearSelection}/>
      {d.drawerRow&&<Drawer open={!!d.drawerRow} onClose={()=>d.setDrawerRow(null)} title={String(d.drawerRow.organization_name??'—')} isUnlocked={d.unlockedIds.has(String(d.drawerRow.id))} onUnlock={()=>{d.toggleSelect(String(d.drawerRow!.id));d.handleUnlock()}} unlocking={d.unlocking} tabs={tabs(d.drawerRow,d.unlockedIds.has(String(d.drawerRow.id)))}/>}
    </div>
  )
}
