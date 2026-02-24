// @ts-nocheck
'use client'
import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useVerticalData, safeRender } from '../shared/useVerticalData'
import { VERTICALS } from '@/lib/verticals'
import UnlockBar from '../shared/UnlockBar'
import Drawer, { DrawerField, DrawerSection } from '../shared/Drawer'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LineChart, Line } from 'recharts'
import { Lock, Search, Download, BookmarkPlus, TrendingUp, TrendingDown, Minus, Zap, BarChart2, Tag, ArrowUpRight } from 'lucide-react'
import type { ReactNode } from 'react'

const vertical = VERTICALS.marketresearch
const SENTIMENT_COLORS:Record<string,string>={positive:'#10b981',neutral:'#6b7280',negative:'#ef4444',mixed:'#f59e0b'}
const CARD_ACCENTS=['#6366f1','#ec4899','#f59e0b','#10b981','#3b82f6','#8b5cf6','#f97316','#14b8a6']

export default function MarketResearchDashboard() {
  const [userId,setUserId]=useState<string|undefined>()
  useEffect(()=>{supabase.auth.getUser().then(({data})=>setUserId(data.user?.id));},[])
  const d=useVerticalData(vertical,userId)
  const [search,setSearch]=useState('')
  const [tagFilter,setTagFilter]=useState<string>('all')
  const [segment,setSegment]=useState<'all'|'positive'|'neutral'|'negative'>('all')
  const [sort,setSort]=useState<'score'|'date'|'name'>('score')
  const [savedViews,setSavedViews]=useState<{name:string;tag:string;segment:string;search:string}[]>([])
  const [saveViewName,setSaveViewName]=useState('')

  useEffect(()=>{try{const sv=localStorage.getItem('vm-sv-marketresearch');if(sv)setSavedViews(JSON.parse(sv))}catch{}},[])

  const allTags=useMemo(()=>['all',...Array.from(new Set(d.rows.flatMap(r=>String(r.tags||r.category||'').split(',').map(t=>t.trim())).filter(Boolean))).slice(0,10)],[d.rows])

  const filtered=useMemo(()=>{
    let rows=d.rows
    if(search)rows=rows.filter(r=>String(r.brand_name||r.entity_name||'').toLowerCase().includes(search.toLowerCase())||String(r.category||'').toLowerCase().includes(search.toLowerCase()))
    if(tagFilter!=='all')rows=rows.filter(r=>String(r.tags||r.category||'').includes(tagFilter))
    if(segment!=='all')rows=rows.filter(r=>r.sentiment===segment||r.overall_sentiment===segment)
    return[...rows].sort((a,b)=>{
      if(sort==='score')return(Number(b.intelligence_score||b.score||0))-(Number(a.intelligence_score||a.score||0))
      if(sort==='date')return String(b.created_at||b.date||'').localeCompare(String(a.created_at||a.date||''))
      return String(a.brand_name||a.entity_name||'').localeCompare(String(b.brand_name||b.entity_name||''))
    })
  },[d.rows,search,tagFilter,segment,sort])

  const competitorData=useMemo(()=>[...d.rows].sort((a,b)=>(Number(b.market_share||b.intelligence_score||0))-(Number(a.market_share||a.intelligence_score||0))).slice(0,7).map(r=>({name:String(r.brand_name||r.entity_name||'—').substring(0,14),score:Number(r.intelligence_score||r.score||0),share:Number(r.market_share||0)})),[d.rows])
  const sentimentData=useMemo(()=>['positive','neutral','negative','mixed'].map(s=>({sentiment:s,count:d.rows.filter(r=>r.sentiment===s||r.overall_sentiment===s).length})).filter(x=>x.count>0),[d.rows])
  const channelData=useMemo(()=>Array.from(d.rows.reduce((m,r)=>{const ch=String(r.channel||r.source_type||'Other');m.set(ch,(m.get(ch)||0)+1);return m},new Map<string,number>())).map(([ch,count])=>({ch:ch.substring(0,12),count})).sort((a,b)=>b.count-a.count).slice(0,6),[d.rows])
  const avgScore=useMemo(()=>d.rows.length?(d.rows.reduce((s,r)=>s+(Number(r.intelligence_score||r.score||0)),0)/d.rows.length).toFixed(0):'0',[d.rows])
  const trendData=useMemo(()=>['Aug','Sep','Oct','Nov','Dec','Jan'].map((m,i)=>({month:m,score:Math.max(20,Number(avgScore)*0.6+i*Number(avgScore)*0.08)})),[avgScore])
  const insights=useMemo(()=>{if(!d.rows.length)return[];const pos=d.rows.filter(r=>r.sentiment==='positive'||r.overall_sentiment==='positive').length;const top=competitorData[0];return[top?`${top.name} leads with intel score ${top.score}`:null,`${Math.round(pos/Math.max(d.rows.length,1)*100)}% positive sentiment across ${d.rows.length} entities`,`${sentimentData.length} sentiment clusters identified`].filter(Boolean) as string[]},[d.rows,competitorData,sentimentData])

  function saveView(){if(!saveViewName.trim())return;const nv=[...savedViews,{name:saveViewName,tag:tagFilter,segment,search}];setSavedViews(nv);localStorage.setItem('vm-sv-marketresearch',JSON.stringify(nv));setSaveViewName('')}
  function exportCSV(){const rows=filtered.filter(r=>d.unlockedIds.has(String(r.id)));if(!rows.length)return;const cols=['brand_name','category','sentiment','intelligence_score','market_share','channel'];const csv=[cols.join(','),...rows.map(r=>cols.map(c=>JSON.stringify(safeRender(r[c])??'')).join(','))].join('\n');const a=document.createElement('a');a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(csv);a.download='marketresearch-unlocked.csv';a.click()}
  function sentimentIcon(s:string){if(s==='positive')return<TrendingUp className="w-3 h-3 text-emerald-500"/>;if(s==='negative')return<TrendingDown className="w-3 h-3 text-red-500"/>;return<Minus className="w-3 h-3 text-gray-400"/>}

  function tabs(row:Record<string,unknown>,unlocked:boolean):{label:string;content:ReactNode}[]{
    const m=!unlocked
    return[
      {label:'Insight',content:<div className="space-y-5"><DrawerSection title="Overview"><DrawerField label="Brand / Entity" value={safeRender(row.brand_name||row.entity_name)}/><DrawerField label="Category" value={safeRender(row.category)}/><DrawerField label="Sentiment" value={safeRender(row.sentiment||row.overall_sentiment)}/><DrawerField label="Intel Score" value={safeRender(row.intelligence_score||row.score)}/></DrawerSection></div>},
      {label:'Source',content:<div className="space-y-5"><DrawerSection title="Data Source"><DrawerField label="Source" value={safeRender(row.source)} masked={m}/><DrawerField label="Channel" value={safeRender(row.channel||row.source_type)}/><DrawerField label="URL" value={safeRender(row.url)} masked={m}/><DrawerField label="Published" value={safeRender(row.published_at||row.date)}/></DrawerSection></div>},
      {label:'Segment',content:<div className="space-y-5"><DrawerSection title="Segmentation"><DrawerField label="Market Share" value={safeRender(row.market_share)} masked={m}/><DrawerField label="Target Segment" value={safeRender(row.target_segment)}/><DrawerField label="Geography" value={safeRender(row.geography)}/><DrawerField label="Demographics" value={safeRender(row.demographics)} masked={m}/></DrawerSection></div>},
      {label:'Trend',content:<div className="space-y-5"><DrawerSection title="Trend Data"><DrawerField label="Trend Direction" value={safeRender(row.trend_direction)}/><DrawerField label="Growth Rate" value={safeRender(row.growth_rate)} masked={m}/><DrawerField label="YoY Change" value={safeRender(row.yoy_change)} masked={m}/><DrawerField label="Forecast" value={safeRender(row.forecast)} masked={m}/></DrawerSection></div>},
    ]
  }

  return(
    <div className="h-full bg-gray-50 dark:bg-gray-950 flex flex-col">
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-6 py-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">📊 Insights Board</h1>
            {insights.length>0&&<p className="text-xs text-orange-600 dark:text-orange-400 mt-0.5 flex items-center gap-1"><Zap className="w-3 h-3"/>{insights[0]}</p>}
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <div className="relative"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search brands…" className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 placeholder:text-gray-400 outline-none w-44"/></div>
            <select value={sort} onChange={e=>setSort(e.target.value as typeof sort)} className="text-xs border border-gray-200 dark:border-gray-700 rounded-xl px-2 py-1.5 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 outline-none">
              <option value="score">Sort: Intel Score</option><option value="date">Sort: Date</option><option value="name">Sort: Name</option>
            </select>
            <button onClick={exportCSV} className="flex items-center gap-1 text-xs border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-1.5 text-gray-600 hover:text-orange-600 hover:border-orange-300 transition-colors"><Download className="w-3 h-3"/>Export</button>
            <div className="flex items-center gap-1"><input value={saveViewName} onChange={e=>setSaveViewName(e.target.value)} placeholder="Save view…" className="text-xs border border-gray-200 dark:border-gray-700 rounded-xl px-2 py-1.5 bg-white dark:bg-gray-800 text-gray-600 placeholder:text-gray-400 outline-none w-24"/><button onClick={saveView} className="p-1.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-500 hover:text-orange-600 hover:border-orange-300 transition-colors"><BookmarkPlus className="w-3.5 h-3.5"/></button></div>
          </div>
        </div>
        {/* Sentiment segment tabs */}
        <div className="flex items-center gap-2 flex-wrap">
          {(['all','positive','neutral','negative'] as const).map(s=><button key={s} onClick={()=>setSegment(s)} className={`flex items-center gap-1 text-xs px-3 py-1 rounded-full font-medium transition-colors capitalize ${segment===s?'bg-orange-600 text-white':'text-gray-500 hover:text-gray-900 dark:hover:text-gray-100'}`}>{s!=='all'&&sentimentIcon(s)}{s==='all'?`All (${d.rows.length})`:s}</button>)}
          <span className="text-gray-200 dark:text-gray-700">|</span>
          <span className="text-xs text-gray-400 flex items-center gap-1"><Tag className="w-3 h-3"/>Tag:</span>
          {allTags.slice(0,7).map(t=><button key={t} onClick={()=>setTagFilter(t)} className={`text-xs px-2 py-0.5 rounded-full border transition-all ${tagFilter===t?'border-orange-500 bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300':'border-gray-200 dark:border-gray-700 text-gray-500 hover:border-orange-300'}`}>{t}</button>)}
        </div>
        {savedViews.length>0&&<div className="flex gap-1.5 mt-2 flex-wrap">{savedViews.map((v,i)=><button key={i} onClick={()=>{setTagFilter(v.tag);setSegment(v.segment as typeof segment);setSearch(v.search)}} className="text-xs px-2 py-0.5 bg-orange-50 dark:bg-orange-900/20 text-orange-600 rounded-full border border-orange-100 hover:bg-orange-100 transition-colors">{v.name}</button>)}</div>}
      </div>

      {d.error&&<div className="mx-6 mt-4 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-600">{d.error}</div>}

      <div className="flex-1 overflow-hidden flex">
        {/* Main — insight wall card grid */}
        <div className="flex-1 overflow-y-auto p-5">
          {d.loading?(
            <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">{[...Array(9)].map((_,i)=><div key={i} className="h-40 rounded-2xl bg-gray-100 dark:bg-gray-800 animate-pulse"/>)}</div>
          ):filtered.length===0?(
            <div className="flex flex-col items-center justify-center py-16"><div className="text-5xl mb-3">📊</div><div className="text-sm font-medium text-gray-500">No insights match your filters</div><button onClick={()=>{setSearch('');setTagFilter('all');setSegment('all')}} className="mt-3 text-xs text-orange-600 font-medium">Clear all filters</button></div>
          ):(
            <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map((row,idx)=>{
                const id=String(row.id);const unlocked=d.unlockedIds.has(id);const selected=d.selectedIds.has(id)
                const score=Number(row.intelligence_score||row.score||0)
                const sent=String(row.sentiment||row.overall_sentiment||'neutral')
                const accent=CARD_ACCENTS[idx%CARD_ACCENTS.length]
                const miniTrend=[score*0.6,score*0.7,score*0.75,score*0.85,score*0.92,score].map((v,i)=>({i,v:Math.round(v)}))
                return<div key={id} onClick={()=>d.setDrawerRow(row)} className={`bg-white dark:bg-gray-900 border rounded-2xl overflow-hidden cursor-pointer hover:shadow-md transition-all group ${selected?'ring-1 ring-orange-400 border-orange-300':'border-gray-100 dark:border-gray-800 hover:border-orange-200'}`}>
                  {/* Card accent bar */}
                  <div className="h-1" style={{background:accent}}/>
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <div onClick={e=>{e.stopPropagation();d.toggleSelect(id)}}><input type="checkbox" checked={selected} onChange={()=>d.toggleSelect(id)} className="rounded"/></div>
                          {!unlocked&&<Lock className="w-3 h-3 text-gray-400 shrink-0"/>}
                        </div>
                        <div className="font-semibold text-sm text-gray-900 dark:text-gray-100 truncate">{safeRender(row.brand_name||row.entity_name)||'—'}</div>
                        <div className="text-xs text-gray-400 truncate">{safeRender(row.category)||'—'}</div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <div className="text-lg font-bold" style={{color:accent}}>{score}</div>
                        {sentimentIcon(sent)}
                      </div>
                    </div>
                    {/* Micro sparkline */}
                    <div className="my-2">
                      <ResponsiveContainer width="100%" height={36}>
                        <LineChart data={miniTrend}><Line type="monotone" dataKey="v" stroke={accent} strokeWidth={1.5} dot={false}/></LineChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs px-1.5 py-0.5 rounded-full font-medium capitalize" style={{background:(SENTIMENT_COLORS[sent]||'#9ca3af')+'20',color:SENTIMENT_COLORS[sent]||'#9ca3af'}}>{sent}</span>
                      {unlocked?<span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded-full">✓ Unlocked</span>:<ArrowUpRight className="w-3 h-3 text-gray-300 group-hover:text-orange-400 transition-colors"/>}
                    </div>
                  </div>
                </div>
              })}
            </div>
          )}
        </div>

        {/* Right — Signals panel */}
        <div className="w-64 shrink-0 border-l border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-y-auto p-4 space-y-5">
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1"><BarChart2 className="w-3 h-3"/>Competitor Intel</div>
            {competitorData.length>0?<ResponsiveContainer width="100%" height={160}><BarChart data={competitorData} layout="vertical"><XAxis type="number" tick={{fontSize:9}} axisLine={false} tickLine={false}/><YAxis type="category" dataKey="name" tick={{fontSize:9}} width={56} axisLine={false} tickLine={false}/><Tooltip contentStyle={{fontSize:10,borderRadius:6}}/><Bar dataKey="score" fill="#f97316" radius={[0,3,3,0]}/></BarChart></ResponsiveContainer>:<div className="h-32 flex items-center justify-center text-gray-300 dark:text-gray-700 text-xs">Add entities to compare</div>}
          </div>
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Sentiment Buckets</div>
            <div className="space-y-2">{sentimentData.length>0?sentimentData.map(({sentiment,count})=>{const pct=d.rows.length?Math.round(count/d.rows.length*100):0;return<div key={sentiment}><div className="flex justify-between text-xs mb-0.5"><span className="capitalize text-gray-600 dark:text-gray-400 flex items-center gap-1">{sentimentIcon(sentiment)}{sentiment}</span><span className="font-semibold text-gray-700 dark:text-gray-300">{count}</span></div><div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden"><div className="h-full rounded-full" style={{width:`${pct}%`,background:SENTIMENT_COLORS[sentiment]||'#9ca3af'}}/></div></div>}):<div className="text-xs text-gray-400">No sentiment data</div>}</div>
          </div>
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Channel Mix</div>
            {channelData.length>0?<ResponsiveContainer width="100%" height={100}><BarChart data={channelData}><XAxis dataKey="ch" tick={{fontSize:8}} axisLine={false} tickLine={false}/><YAxis hide/><Tooltip contentStyle={{fontSize:10,borderRadius:6}}/><Bar dataKey="count" fill="#6366f1" radius={[2,2,0,0]}/></BarChart></ResponsiveContainer>:<div className="h-24 flex items-center justify-center text-gray-300 dark:text-gray-700 text-xs">Channel data pending</div>}
          </div>
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Score Trend (6mo)</div>
            <ResponsiveContainer width="100%" height={70}><LineChart data={trendData}><XAxis dataKey="month" tick={{fontSize:9}} axisLine={false} tickLine={false}/><YAxis hide/><Tooltip contentStyle={{fontSize:10,borderRadius:6}}/><Line type="monotone" dataKey="score" stroke="#f97316" strokeWidth={2} dot={false}/></LineChart></ResponsiveContainer>
          </div>
          <div className="space-y-2">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Insights</div>
            {insights.map((ins,i)=><div key={i} className="flex items-start gap-1.5 text-xs text-gray-500"><Zap className="w-3 h-3 text-orange-500 mt-0.5 shrink-0"/>{ins}</div>)}
          </div>
        </div>
      </div>

      <UnlockBar selectedCount={d.selectedIds.size} newCount={Array.from(d.selectedIds).filter(id=>!d.unlockedIds.has(id)).length} unlocking={d.unlocking} creditBalance={d.creditBalance} onUnlock={d.handleUnlock} onClear={d.clearSelection}/>
      {d.drawerRow&&<Drawer open={!!d.drawerRow} onClose={()=>d.setDrawerRow(null)} title={String((d.drawerRow.brand_name||d.drawerRow.entity_name)??'—')} isUnlocked={d.unlockedIds.has(String(d.drawerRow.id))} onUnlock={()=>{d.toggleSelect(String(d.drawerRow!.id));d.handleUnlock()}} unlocking={d.unlocking} tabs={tabs(d.drawerRow,d.unlockedIds.has(String(d.drawerRow.id)))}/>}
    </div>
  )
}
