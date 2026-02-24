// @ts-nocheck
'use client'
import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useVerticalData, safeRender } from '../shared/useVerticalData'
import { VERTICALS } from '@/lib/verticals'
import UnlockBar from '../shared/UnlockBar'
import Drawer, { DrawerField, DrawerSection } from '../shared/Drawer'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { Lock, Search, Download, BookmarkPlus, Users, TrendingUp, Zap, Heart, MessageCircle, Star, Instagram, Youtube, Twitter } from 'lucide-react'
import type { ReactNode } from 'react'

const vertical = VERTICALS.creatorintel
const PLATFORM_COLORS:Record<string,string>={instagram:'#e1306c',youtube:'#ff0000',tiktok:'#000000',twitter:'#1da1f2',linkedin:'#0077b5',twitch:'#9146ff',other:'#6b7280'}
const PLATFORM_ICONS:Record<string,ReactNode>={instagram:<Instagram className="w-3 h-3"/>,youtube:<Youtube className="w-3 h-3"/>,twitter:<Twitter className="w-3 h-3"/>}

function engagementTier(rate:number){if(rate>=10)return{label:'Elite',color:'#f59e0b'};if(rate>=5)return{label:'High',color:'#10b981'};if(rate>=2)return{label:'Mid',color:'#3b82f6'};return{label:'Low',color:'#9ca3af'}}
function fmtFollowers(n:number){if(n>=1e6)return`${(n/1e6).toFixed(1)}M`;if(n>=1e3)return`${(n/1e3).toFixed(0)}K`;return String(n)}

export default function CreatorIntelDashboard() {
  const [userId,setUserId]=useState<string|undefined>()
  useEffect(()=>{supabase.auth.getUser().then(({data})=>setUserId(data.user?.id));},[])
  const d=useVerticalData(vertical,userId)
  const [search,setSearch]=useState('')
  const [platformFilter,setPlatformFilter]=useState<string>('all')
  const [engFilter,setEngFilter]=useState<string>('all')
  const [sort,setSort]=useState<'followers'|'engagement'|'score'>('followers')
  const [savedViews,setSavedViews]=useState<{name:string;platform:string;eng:string;search:string}[]>([])
  const [saveViewName,setSaveViewName]=useState('')

  useEffect(()=>{try{const sv=localStorage.getItem('vm-sv-creatorintel');if(sv)setSavedViews(JSON.parse(sv))}catch{}},[])

  const platforms=useMemo(()=>['all',...Array.from(new Set(d.rows.map(r=>String(r.platform||'')).filter(Boolean)))],[d.rows])
  const filtered=useMemo(()=>{
    let rows=d.rows
    if(search)rows=rows.filter(r=>String(r.creator_name||r.handle||'').toLowerCase().includes(search.toLowerCase())||String(r.niche||r.category||'').toLowerCase().includes(search.toLowerCase()))
    if(platformFilter!=='all')rows=rows.filter(r=>r.platform===platformFilter)
    if(engFilter==='elite')rows=rows.filter(r=>Number(r.engagement_rate||0)>=10)
    else if(engFilter==='high')rows=rows.filter(r=>Number(r.engagement_rate||0)>=5&&Number(r.engagement_rate||0)<10)
    else if(engFilter==='mid')rows=rows.filter(r=>Number(r.engagement_rate||0)>=2&&Number(r.engagement_rate||0)<5)
    return[...rows].sort((a,b)=>{
      if(sort==='followers')return(Number(b.follower_count||b.followers||0))-(Number(a.follower_count||a.followers||0))
      if(sort==='engagement')return(Number(b.engagement_rate||0))-(Number(a.engagement_rate||0))
      return(Number(b.intelligence_score||0))-(Number(a.intelligence_score||0))
    })
  },[d.rows,search,platformFilter,engFilter,sort])

  const engBuckets=useMemo(()=>[{label:'Elite ≥10%',count:d.rows.filter(r=>Number(r.engagement_rate||0)>=10).length,color:'#f59e0b'},{label:'High 5-10%',count:d.rows.filter(r=>Number(r.engagement_rate||0)>=5&&Number(r.engagement_rate||0)<10).length,color:'#10b981'},{label:'Mid 2-5%',count:d.rows.filter(r=>Number(r.engagement_rate||0)>=2&&Number(r.engagement_rate||0)<5).length,color:'#3b82f6'},{label:'Low <2%',count:d.rows.filter(r=>Number(r.engagement_rate||0)<2).length,color:'#9ca3af'}].filter(x=>x.count>0),[d.rows])
  const platformData=useMemo(()=>Array.from(d.rows.reduce((m,r)=>{const p=String(r.platform||'Other');m.set(p,(m.get(p)||0)+1);return m},new Map<string,number>())).map(([platform,count])=>({platform,count})).sort((a,b)=>b.count-a.count),[d.rows])
  const topCreators=useMemo(()=>[...d.rows].sort((a,b)=>(Number(b.engagement_rate||0))-(Number(a.engagement_rate||0))).slice(0,5),[d.rows])
  const insights=useMemo(()=>{if(!d.rows.length)return[];const elite=d.rows.filter(r=>Number(r.engagement_rate||0)>=10).length;const topPlat=platformData[0];return[elite>0?`${elite} elite creators with ≥10% engagement rate`:null,topPlat?`${topPlat.platform} dominates with ${topPlat.count} creators`:null].filter(Boolean) as string[]},[d.rows,platformData])

  // Activity feed derived from data
  const activityFeed=useMemo(()=>{
    const feed:[{type:string;creator:string;value:string;color:string}]=[] as unknown as [{type:string;creator:string;value:string;color:string}]
    const highEng=[...d.rows].filter(r=>Number(r.engagement_rate||0)>=8).slice(0,2)
    highEng.forEach(r=>feed.push({type:'🔥 High Engagement',creator:String(safeRender(r.creator_name)||'—'),value:`${Number(r.engagement_rate||0).toFixed(1)}%`,color:'#f59e0b'}))
    const bigFollowers=[...d.rows].sort((a,b)=>(Number(b.follower_count||0))-(Number(a.follower_count||0))).slice(0,2)
    bigFollowers.forEach(r=>feed.push({type:'📈 Top Reach',creator:String(safeRender(r.creator_name)||'—'),value:fmtFollowers(Number(r.follower_count||0)),color:'#6366f1'}))
    const unlocked=[...d.rows].filter(r=>d.unlockedIds.has(String(r.id))).slice(0,2)
    unlocked.forEach(r=>feed.push({type:'✓ Unlocked',creator:String(safeRender(r.creator_name)||'—'),value:'Full access',color:'#10b981'}))
    return feed.slice(0,8)
  },[d.rows,d.unlockedIds])

  function saveView(){if(!saveViewName.trim())return;const nv=[...savedViews,{name:saveViewName,platform:platformFilter,eng:engFilter,search}];setSavedViews(nv);localStorage.setItem('vm-sv-creatorintel',JSON.stringify(nv));setSaveViewName('')}
  function exportCSV(){const rows=filtered.filter(r=>d.unlockedIds.has(String(r.id)));if(!rows.length)return;const cols=['creator_name','platform','follower_count','engagement_rate','niche','intelligence_score'];const csv=[cols.join(','),...rows.map(r=>cols.map(c=>JSON.stringify(safeRender(r[c])??'')).join(','))].join('\n');const a=document.createElement('a');a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(csv);a.download='creatorintel-unlocked.csv';a.click()}

  function tabs(row:Record<string,unknown>,unlocked:boolean):{label:string;content:ReactNode}[]{
    const m=!unlocked
    return[
      {label:'Profile',content:<div className="space-y-5"><DrawerSection title="Creator"><DrawerField label="Name" value={safeRender(row.creator_name)}/><DrawerField label="Handle" value={safeRender(row.handle)} masked={m}/><DrawerField label="Platform" value={safeRender(row.platform)}/><DrawerField label="Niche" value={safeRender(row.niche||row.category)}/><DrawerField label="Bio" value={safeRender(row.bio)}/></DrawerSection></div>},
      {label:'Metrics',content:<div className="space-y-5"><DrawerSection title="Performance"><DrawerField label="Followers" value={safeRender(row.follower_count||row.followers)}/><DrawerField label="Engagement Rate" value={safeRender(row.engagement_rate)}/><DrawerField label="Avg Views" value={safeRender(row.avg_views)} masked={m}/><DrawerField label="Intel Score" value={safeRender(row.intelligence_score)}/></DrawerSection></div>},
      {label:'Audience',content:<div className="space-y-5"><DrawerSection title="Demographics"><DrawerField label="Primary Age" value={safeRender(row.primary_age_group)}/><DrawerField label="Gender Split" value={safeRender(row.gender_split)} masked={m}/><DrawerField label="Top Locations" value={safeRender(row.top_locations)} masked={m}/><DrawerField label="Audience Quality" value={safeRender(row.audience_quality)}/></DrawerSection></div>},
      {label:'Deals',content:<div className="space-y-5"><DrawerSection title="Commercial"><DrawerField label="Rate Card" value={safeRender(row.rate_card)} masked={m}/><DrawerField label="Sponsored Rate" value={safeRender(row.sponsored_post_rate)} masked={m}/><DrawerField label="Contact Email" value={safeRender(row.contact_email)} masked={m}/><DrawerField label="Management" value={safeRender(row.management_contact)} masked={m}/></DrawerSection></div>},
    ]
  }

  return(
    <div className="h-full bg-gray-50 dark:bg-gray-950 flex flex-col">
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-6 py-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">✨ Creator Discovery</h1>
            {insights.length>0&&<p className="text-xs text-pink-600 dark:text-pink-400 mt-0.5 flex items-center gap-1"><Zap className="w-3 h-3"/>{insights[0]}</p>}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={exportCSV} className="flex items-center gap-1 text-xs border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-1.5 text-gray-600 hover:text-pink-600 hover:border-pink-300 transition-colors"><Download className="w-3 h-3"/>Export</button>
            <div className="flex items-center gap-1"><input value={saveViewName} onChange={e=>setSaveViewName(e.target.value)} placeholder="Save view…" className="text-xs border border-gray-200 dark:border-gray-700 rounded-xl px-2 py-1.5 bg-white dark:bg-gray-800 text-gray-600 placeholder:text-gray-400 outline-none w-24"/><button onClick={saveView} className="p-1.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-500 hover:text-pink-600 hover:border-pink-300 transition-colors"><BookmarkPlus className="w-3.5 h-3.5"/></button></div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search creators, niches…" className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 placeholder:text-gray-400 outline-none w-44"/></div>
          <span className="text-xs text-gray-400">Platform:</span>
          {platforms.map(p=><button key={p} onClick={()=>setPlatformFilter(p)} className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium border transition-all capitalize ${platformFilter===p?'border-pink-500 bg-pink-50 dark:bg-pink-900/20 text-pink-700 dark:text-pink-300':'border-gray-200 dark:border-gray-700 text-gray-500 hover:border-pink-300'}`}>{p!=='all'&&(PLATFORM_ICONS[p]||null)}{p==='all'?`All (${d.rows.length})`:p}</button>)}
          <span className="text-xs text-gray-400">Engagement:</span>
          {[{k:'all',l:'All'},{k:'elite',l:'Elite ≥10%'},{k:'high',l:'High 5-10%'},{k:'mid',l:'Mid 2-5%'}].map(({k,l})=><button key={k} onClick={()=>setEngFilter(k)} className={`text-xs px-2.5 py-1 rounded-full border transition-all ${engFilter===k?'border-pink-500 bg-pink-50 dark:bg-pink-900/20 text-pink-700 dark:text-pink-300':'border-gray-200 dark:border-gray-700 text-gray-500 hover:border-pink-300'}`}>{l}</button>)}
          <select value={sort} onChange={e=>setSort(e.target.value as typeof sort)} className="text-xs border border-gray-200 dark:border-gray-700 rounded-xl px-2 py-1.5 bg-white dark:bg-gray-800 text-gray-600 outline-none ml-auto">
            <option value="followers">Sort: Followers</option><option value="engagement">Sort: Engagement</option><option value="score">Sort: Intel Score</option>
          </select>
        </div>
        {savedViews.length>0&&<div className="flex gap-1.5 mt-2 flex-wrap">{savedViews.map((v,i)=><button key={i} onClick={()=>{setPlatformFilter(v.platform);setEngFilter(v.eng);setSearch(v.search)}} className="text-xs px-2 py-0.5 bg-pink-50 dark:bg-pink-900/20 text-pink-600 rounded-full border border-pink-100 hover:bg-pink-100 transition-colors">{v.name}</button>)}</div>}
      </div>

      {d.error&&<div className="mx-6 mt-4 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-600">{d.error}</div>}

      <div className="flex-1 overflow-hidden flex">
        {/* Main — card grid */}
        <div className="flex-1 overflow-y-auto p-5">
          {d.loading?(
            <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">{[...Array(9)].map((_,i)=><div key={i} className="h-36 rounded-2xl bg-gray-100 dark:bg-gray-800 animate-pulse"/>)}</div>
          ):filtered.length===0?(
            <div className="flex flex-col items-center justify-center py-16"><div className="text-5xl mb-3">✨</div><div className="text-sm font-medium text-gray-500">No creators found</div><button onClick={()=>{setSearch('');setPlatformFilter('all');setEngFilter('all')}} className="mt-3 text-xs text-pink-600 font-medium">Clear filters</button></div>
          ):(
            <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map(row=>{
                const id=String(row.id);const unlocked=d.unlockedIds.has(id);const selected=d.selectedIds.has(id)
                const followers=Number(row.follower_count||row.followers||0)
                const engRate=Number(row.engagement_rate||0)
                const tier=engagementTier(engRate)
                const platform=String(row.platform||'other').toLowerCase()
                const platColor=PLATFORM_COLORS[platform]||'#6b7280'
                return<div key={id} onClick={()=>d.setDrawerRow(row)} className={`bg-white dark:bg-gray-900 border rounded-2xl overflow-hidden cursor-pointer hover:shadow-md transition-all group ${selected?'ring-1 ring-pink-400 border-pink-300':'border-gray-100 dark:border-gray-800 hover:border-pink-200'}`}>
                  <div className="h-1" style={{background:platColor}}/>
                  <div className="p-4">
                    <div className="flex items-start gap-2 mb-2">
                      <div onClick={e=>{e.stopPropagation();d.toggleSelect(id)}} className="shrink-0"><input type="checkbox" checked={selected} onChange={()=>d.toggleSelect(id)} className="rounded mt-0.5"/></div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          {!unlocked&&<Lock className="w-3 h-3 text-gray-400 shrink-0"/>}
                          <span className="font-semibold text-sm text-gray-900 dark:text-gray-100 truncate">{safeRender(row.creator_name)||'—'}</span>
                          {unlocked&&<span className="text-[10px] text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 px-1 py-0.5 rounded-full shrink-0">✓</span>}
                        </div>
                        <div className="text-xs text-gray-400 truncate">{safeRender(row.niche||row.category)||'—'}</div>
                      </div>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0" style={{background:platColor+'20',color:platColor}}>{safeRender(row.platform)||'?'}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-2 text-center"><div className="text-sm font-bold text-gray-700 dark:text-gray-200">{fmtFollowers(followers)}</div><div className="text-[10px] text-gray-400 flex items-center justify-center gap-0.5"><Users className="w-2.5 h-2.5"/>Followers</div></div>
                      <div className="rounded-xl p-2 text-center" style={{background:tier.color+'15'}}><div className="text-sm font-bold" style={{color:tier.color}}>{engRate.toFixed(1)}%</div><div className="text-[10px] text-gray-400 flex items-center justify-center gap-0.5"><Heart className="w-2.5 h-2.5"/>Engagement</div></div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{background:tier.color+'20',color:tier.color}}>{tier.label}</span>
                      {!!row.intelligence_score&&<span className="text-[10px] text-gray-400">Intel: <strong className="text-gray-600 dark:text-gray-300">{Number(row.intelligence_score)}</strong></span>}
                    </div>
                  </div>
                </div>
              })}
            </div>
          )}
        </div>

        {/* Right — Activity feed + charts */}
        <div className="w-60 shrink-0 border-l border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-y-auto p-4 space-y-5">
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1"><Zap className="w-3 h-3 text-pink-500"/>Activity Feed</div>
            {activityFeed.length>0?activityFeed.map((item,i)=><div key={i} className="flex flex-col mb-2.5 p-2.5 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-800">
              <span className="text-[10px] font-medium" style={{color:item.color}}>{item.type}</span>
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">{item.creator}</span>
              <span className="text-[10px] text-gray-400">{item.value}</span>
            </div>):<div className="text-xs text-gray-400 text-center py-4">Activity will appear here</div>}
          </div>
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Engagement Buckets</div>
            {engBuckets.length>0?<div className="space-y-2">{engBuckets.map(({label,count,color})=>{const pct=d.rows.length?Math.round(count/d.rows.length*100):0;return<div key={label}><div className="flex justify-between text-xs mb-0.5"><span className="text-gray-600 dark:text-gray-400">{label}</span><span className="font-semibold" style={{color}}>{count}</span></div><div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden"><div className="h-full rounded-full" style={{width:`${pct}%`,background:color}}/></div></div>})}</div>:<div className="text-xs text-gray-400">No engagement data</div>}
          </div>
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Platform Split</div>
            {platformData.length>0?<ResponsiveContainer width="100%" height={100}><BarChart data={platformData}><XAxis dataKey="platform" tick={{fontSize:8}} axisLine={false} tickLine={false}/><YAxis hide/><Tooltip contentStyle={{fontSize:10,borderRadius:6}}/><Bar dataKey="count" radius={[2,2,0,0]}>{platformData.map((e,i)=><Cell key={i} fill={PLATFORM_COLORS[e.platform]||'#9ca3af'}/>)}</Bar></BarChart></ResponsiveContainer>:<div className="h-24 flex items-center justify-center text-gray-300 dark:text-gray-700 text-xs">Platform data pending</div>}
          </div>
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Top by Engagement</div>
            {topCreators.map((row,i)=><div key={String(row.id)} onClick={()=>d.setDrawerRow(row)} className="flex items-center gap-2 mb-2 p-2 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer">
              <span className="text-[10px] font-bold text-gray-400 w-4">#{i+1}</span>
              <div className="flex-1 min-w-0"><div className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">{safeRender(row.creator_name)||'—'}</div><div className="text-[10px] text-gray-400">{Number(row.engagement_rate||0).toFixed(1)}% eng.</div></div>
              <Star className="w-3 h-3 text-amber-400 shrink-0"/>
            </div>)}
          </div>
        </div>
      </div>

      <UnlockBar selectedCount={d.selectedIds.size} newCount={Array.from(d.selectedIds).filter(id=>!d.unlockedIds.has(id)).length} unlocking={d.unlocking} creditBalance={d.creditBalance} onUnlock={d.handleUnlock} onClear={d.clearSelection}/>
      {d.drawerRow&&<Drawer open={!!d.drawerRow} onClose={()=>d.setDrawerRow(null)} title={String(d.drawerRow.creator_name??'—')} isUnlocked={d.unlockedIds.has(String(d.drawerRow.id))} onUnlock={()=>{d.toggleSelect(String(d.drawerRow!.id));d.handleUnlock()}} unlocking={d.unlocking} tabs={tabs(d.drawerRow,d.unlockedIds.has(String(d.drawerRow.id)))}/>}
    </div>
  )
}
