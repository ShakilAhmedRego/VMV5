// @ts-nocheck
'use client'
import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useVerticalData, safeRender } from '../shared/useVerticalData'
import { VERTICALS } from '@/lib/verticals'
import UnlockBar from '../shared/UnlockBar'
import Drawer, { DrawerField, DrawerSection } from '../shared/Drawer'
import { Lock, Search, Download, BookmarkPlus, BookOpen, Star, Bookmark, Trophy, Building, User } from 'lucide-react'
import type { ReactNode } from 'react'

const vertical = VERTICALS.academicintel

export default function AcademicIntelDashboard() {
  const [userId,setUserId]=useState<string|undefined>()
  useEffect(()=>{supabase.auth.getUser().then(({data})=>setUserId(data.user?.id));},[])
  const d=useVerticalData(vertical,userId)
  const [search,setSearch]=useState('')
  const [yearFilter,setYearFilter]=useState<string>('all')
  const [domainFilter,setDomainFilter]=useState<string>('all')
  const [venueFilter,setVenueFilter]=useState<string>('all')
  const [sort,setSort]=useState<'citations'|'year'|'title'>('citations')
  const [savedViews,setSavedViews]=useState<{name:string;domain:string;year:string;search:string}[]>([])
  const [saveViewName,setSaveViewName]=useState('')
  const [readingList,setReadingList]=useState<string[]>([])
  const [showReadingList,setShowReadingList]=useState(false)

  useEffect(()=>{
    try{const sv=localStorage.getItem('vm-sv-academicintel');if(sv)setSavedViews(JSON.parse(sv))}catch{}
    try{const rl=localStorage.getItem('vm-rl-academicintel');if(rl)setReadingList(JSON.parse(rl))}catch{}
  },[])

  const years=useMemo(()=>['all',...Array.from(new Set(d.rows.map(r=>String(r.publication_year||r.year||'')).filter(Boolean))).sort().reverse().slice(0,8)],[d.rows])
  const domains=useMemo(()=>['all',...Array.from(new Set(d.rows.map(r=>String(r.domain||r.field||'')).filter(Boolean))).slice(0,8)],[d.rows])
  const venues=useMemo(()=>['all',...Array.from(new Set(d.rows.map(r=>String(r.venue||r.journal||'')).filter(Boolean))).slice(0,8)],[d.rows])

  const filtered=useMemo(()=>{
    let rows=showReadingList?d.rows.filter(r=>readingList.includes(String(r.id))):d.rows
    if(search)rows=rows.filter(r=>String(r.title||'').toLowerCase().includes(search.toLowerCase())||String(r.authors||'').toLowerCase().includes(search.toLowerCase()))
    if(yearFilter!=='all')rows=rows.filter(r=>String(r.publication_year||r.year||'')===yearFilter)
    if(domainFilter!=='all')rows=rows.filter(r=>r.domain===domainFilter||r.field===domainFilter)
    if(venueFilter!=='all')rows=rows.filter(r=>r.venue===venueFilter||r.journal===venueFilter)
    return[...rows].sort((a,b)=>{
      if(sort==='citations')return(Number(b.citation_count||b.citations||0))-(Number(a.citation_count||a.citations||0))
      if(sort==='year')return(Number(b.publication_year||b.year||0))-(Number(a.publication_year||a.year||0))
      return String(a.title||'').localeCompare(String(b.title||''))
    })
  },[d.rows,search,yearFilter,domainFilter,venueFilter,sort,showReadingList,readingList])

  const topAuthors=useMemo(()=>{const m=new Map<string,{count:number,citations:number}>();d.rows.forEach(r=>{const auths=String(r.authors||'').split(',').map(a=>a.trim()).filter(Boolean).slice(0,3);auths.forEach(a=>{const e=m.get(a)||{count:0,citations:0};m.set(a,{count:e.count+1,citations:e.citations+(Number(r.citation_count||0))})})});return Array.from(m.entries()).sort((a,b)=>b[1].citations-a[1].citations).slice(0,6).map(([name,stats])=>({name,count:stats.count,citations:stats.citations}))},[d.rows])
  const topVenues=useMemo(()=>{const m=new Map<string,number>();d.rows.forEach(r=>{const v=String(r.venue||r.journal||'');if(v)m.set(v,(m.get(v)||0)+1)});return Array.from(m.entries()).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([venue,count])=>({venue:venue.substring(0,28),count}))},[d.rows])
  const totalCitations=useMemo(()=>d.rows.reduce((s,r)=>s+(Number(r.citation_count||r.citations||0)),0),[d.rows])

  function toggleReadingList(id:string){const nrl=readingList.includes(id)?readingList.filter(x=>x!==id):[...readingList,id];setReadingList(nrl);localStorage.setItem('vm-rl-academicintel',JSON.stringify(nrl))}
  function saveView(){if(!saveViewName.trim())return;const nv=[...savedViews,{name:saveViewName,domain:domainFilter,year:yearFilter,search}];setSavedViews(nv);localStorage.setItem('vm-sv-academicintel',JSON.stringify(nv));setSaveViewName('')}
  function exportCSV(){const rows=filtered.filter(r=>d.unlockedIds.has(String(r.id)));if(!rows.length)return;const cols=['title','authors','venue','publication_year','citation_count','domain'];const csv=[cols.join(','),...rows.map(r=>cols.map(c=>JSON.stringify(safeRender(r[c])??'')).join(','))].join('\n');const a=document.createElement('a');a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(csv);a.download='academicintel-unlocked.csv';a.click()}

  function tabs(row:Record<string,unknown>,unlocked:boolean):{label:string;content:ReactNode}[]{
    const m=!unlocked
    return[
      {label:'Abstract',content:<div className="space-y-5"><DrawerSection title="Paper"><DrawerField label="Title" value={safeRender(row.title)}/><DrawerField label="Year" value={safeRender(row.publication_year||row.year)}/><DrawerField label="Domain" value={safeRender(row.domain||row.field)}/><DrawerField label="Abstract" value={safeRender(row.abstract)}/></DrawerSection></div>},
      {label:'Authors',content:<div className="space-y-5"><DrawerSection title="Authorship"><DrawerField label="Authors" value={safeRender(row.authors)}/><DrawerField label="Affiliation" value={safeRender(row.affiliation)} masked={m}/><DrawerField label="Corresponding" value={safeRender(row.corresponding_author)} masked={m}/><DrawerField label="ORCID" value={safeRender(row.orcid)} masked={m}/></DrawerSection></div>},
      {label:'Citations',content:<div className="space-y-5"><DrawerSection title="Impact"><DrawerField label="Citation Count" value={safeRender(row.citation_count||row.citations)}/><DrawerField label="h-index" value={safeRender(row.h_index)}/><DrawerField label="Impact Factor" value={safeRender(row.impact_factor)}/><DrawerField label="Altmetric" value={safeRender(row.altmetric_score)}/></DrawerSection></div>},
      {label:'Links',content:<div className="space-y-5"><DrawerSection title="Access"><DrawerField label="DOI" value={safeRender(row.doi)} masked={m}/><DrawerField label="PDF URL" value={safeRender(row.pdf_url)} masked={m}/><DrawerField label="Open Access" value={safeRender(row.open_access)}/><DrawerField label="Repository" value={safeRender(row.repository)}/></DrawerSection></div>},
    ]
  }

  return(
    <div className="h-full bg-gray-50 dark:bg-gray-950 flex flex-col">
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-6 py-4">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">🎓 Research Library</h1>
          <div className="flex items-center gap-2">
            <button onClick={exportCSV} className="flex items-center gap-1 text-xs border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-1.5 text-gray-600 hover:text-sky-600 hover:border-sky-300 transition-colors"><Download className="w-3 h-3"/>Export</button>
            <div className="flex items-center gap-1"><input value={saveViewName} onChange={e=>setSaveViewName(e.target.value)} placeholder="Save view…" className="text-xs border border-gray-200 dark:border-gray-700 rounded-xl px-2 py-1.5 bg-white dark:bg-gray-800 text-gray-600 placeholder:text-gray-400 outline-none w-24"/><button onClick={saveView} className="p-1.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-500 hover:text-sky-600 hover:border-sky-300 transition-colors"><BookmarkPlus className="w-3.5 h-3.5"/></button></div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 max-w-xs"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search papers, authors…" className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 placeholder:text-gray-400 outline-none"/></div>
          <button onClick={()=>setShowReadingList(!showReadingList)} className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded-xl border font-medium transition-colors ${showReadingList?'border-sky-500 bg-sky-50 dark:bg-sky-900/20 text-sky-700 dark:text-sky-300':'border-gray-200 dark:border-gray-700 text-gray-500 hover:border-sky-300'}`}><Bookmark className="w-3 h-3"/>Reading List ({readingList.length})</button>
          <select value={sort} onChange={e=>setSort(e.target.value as typeof sort)} className="text-xs border border-gray-200 dark:border-gray-700 rounded-xl px-2 py-1.5 bg-white dark:bg-gray-800 text-gray-600 outline-none">
            <option value="citations">Sort: Citations</option><option value="year">Sort: Year</option><option value="title">Sort: Title</option>
          </select>
        </div>
        {savedViews.length>0&&<div className="flex gap-1.5 mt-2 flex-wrap">{savedViews.map((v,i)=><button key={i} onClick={()=>{setDomainFilter(v.domain);setYearFilter(v.year);setSearch(v.search)}} className="text-xs px-2 py-0.5 bg-sky-50 dark:bg-sky-900/20 text-sky-600 rounded-full border border-sky-100 hover:bg-sky-100 transition-colors">{v.name}</button>)}</div>}
      </div>

      {d.error&&<div className="mx-6 mt-4 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-600">{d.error}</div>}

      <div className="flex-1 overflow-hidden flex">
        {/* Left — Filters */}
        <div className="w-48 shrink-0 border-r border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-y-auto p-4 space-y-5">
          <div><div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Year</div>{years.map(y=><button key={y} onClick={()=>setYearFilter(y)} className={`w-full text-left text-xs px-2 py-1.5 rounded-lg mb-0.5 transition-colors ${yearFilter===y?'bg-sky-50 dark:bg-sky-900/20 text-sky-600 font-medium':'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>{y==='all'?`All Years (${d.rows.length})`:y}</button>)}</div>
          <div><div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Domain</div>{domains.map(dm=><button key={dm} onClick={()=>setDomainFilter(dm)} className={`w-full text-left text-xs px-2 py-1.5 rounded-lg mb-0.5 truncate transition-colors ${domainFilter===dm?'bg-sky-50 dark:bg-sky-900/20 text-sky-600 font-medium':'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>{dm==='all'?'All Domains':dm}</button>)}</div>
          <div><div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Venue</div>{venues.slice(0,6).map(v=><button key={v} onClick={()=>setVenueFilter(v)} className={`w-full text-left text-xs px-2 py-1.5 rounded-lg mb-0.5 truncate transition-colors ${venueFilter===v?'bg-sky-50 dark:bg-sky-900/20 text-sky-600 font-medium':'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>{v==='all'?'All Venues':v}</button>)}</div>
          <div className="bg-sky-50 dark:bg-sky-900/20 rounded-xl p-3 text-center"><div className="text-xl font-bold text-sky-600">{totalCitations.toLocaleString()}</div><div className="text-[10px] text-gray-400">Total Citations</div></div>
        </div>

        {/* Main — paper list */}
        <div className="flex-1 overflow-y-auto min-w-0">
          {d.loading?(<div className="p-5 space-y-3">{[...Array(7)].map((_,i)=><div key={i} className="h-20 rounded-2xl bg-gray-100 dark:bg-gray-800 animate-pulse"/>)}</div>):filtered.length===0?(
            <div className="flex flex-col items-center justify-center py-16"><div className="text-5xl mb-3">🎓</div><div className="text-sm font-medium text-gray-500">{showReadingList?'Your reading list is empty':'No papers found'}</div><button onClick={()=>{setSearch('');setYearFilter('all');setDomainFilter('all');setVenueFilter('all');setShowReadingList(false)}} className="mt-3 text-xs text-sky-600 font-medium">Clear filters</button></div>
          ):(
            <div className="divide-y divide-gray-50 dark:divide-gray-800">
              {filtered.map(row=>{
                const id=String(row.id);const unlocked=d.unlockedIds.has(id);const selected=d.selectedIds.has(id);const inRL=readingList.includes(id)
                const citations=Number(row.citation_count||row.citations||0)
                const authors=String(row.authors||'').split(',').map(a=>a.trim()).filter(Boolean).slice(0,3)
                return<div key={id} className={`px-5 py-4 hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors ${selected?'bg-sky-50/50 dark:bg-sky-900/10':''}`}>
                  <div className="flex items-start gap-3">
                    <div onClick={e=>{e.stopPropagation();d.toggleSelect(id)}} className="mt-0.5 shrink-0"><input type="checkbox" checked={selected} onChange={()=>d.toggleSelect(id)} className="rounded"/></div>
                    <div className="flex-1 min-w-0 cursor-pointer" onClick={()=>d.setDrawerRow(row)}>
                      <div className="flex items-start gap-2">
                        {!unlocked&&<Lock className="w-3 h-3 text-gray-400 mt-0.5 shrink-0"/>}
                        <div className="font-semibold text-sm text-gray-900 dark:text-gray-100 leading-snug">{safeRender(row.title)||'—'}</div>
                        {unlocked&&<span className="shrink-0 text-[10px] font-medium text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded-full mt-0.5">✓</span>}
                      </div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {authors.map((a,i)=><span key={i} className="text-xs text-gray-500 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded-full flex items-center gap-0.5"><User className="w-2.5 h-2.5"/>{a}</span>)}
                      </div>
                      <div className="flex items-center gap-3 mt-1.5">
                        <span className="text-xs text-gray-400">{safeRender(row.venue||row.journal)||'—'} · {safeRender(row.publication_year||row.year)||'—'}</span>
                        {citations>0&&<span className="flex items-center gap-1 text-xs font-medium text-amber-600"><Star className="w-3 h-3"/>{citations} citations</span>}
                        {!!row.domain&&<span className="text-xs px-1.5 py-0.5 bg-sky-50 dark:bg-sky-900/20 text-sky-600 rounded-full">{safeRender(row.domain||row.field)}</span>}
                      </div>
                    </div>
                    <button onClick={()=>toggleReadingList(id)} className={`p-1.5 rounded-lg shrink-0 transition-colors ${inRL?'text-sky-600 bg-sky-50 dark:bg-sky-900/20':'text-gray-300 hover:text-sky-400'}`} title={inRL?'Remove from reading list':'Add to reading list'}><Bookmark className="w-4 h-4"/></button>
                  </div>
                </div>
              })}
            </div>
          )}
        </div>

        {/* Right — Rankings */}
        <div className="w-56 shrink-0 border-l border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-y-auto p-4 space-y-5">
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1"><Trophy className="w-3 h-3 text-amber-500"/>Top Authors</div>
            {topAuthors.length>0?topAuthors.map(({name,count,citations},i)=><div key={name} className="flex items-center gap-2 mb-2 p-2 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
              <span className="text-[10px] font-bold text-gray-400 w-4">#{i+1}</span>
              <div className="flex-1 min-w-0"><div className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">{name}</div><div className="text-[10px] text-gray-400">{count} papers · {citations} cit.</div></div>
            </div>):<div className="text-xs text-gray-400 text-center py-4">No author data</div>}
          </div>
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1"><Building className="w-3 h-3 text-sky-500"/>Top Venues</div>
            {topVenues.length>0?topVenues.map(({venue,count},i)=><div key={venue} className="flex items-center gap-2 mb-2 p-2 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
              <span className="text-[10px] font-bold text-gray-400 w-4">#{i+1}</span>
              <div className="flex-1 min-w-0"><div className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">{venue}</div><div className="text-[10px] text-gray-400">{count} papers</div></div>
            </div>):<div className="text-xs text-gray-400 text-center py-4">No venue data</div>}
          </div>
          <div className="grid grid-cols-1 gap-2">
            <div className="bg-sky-50 dark:bg-sky-900/20 rounded-xl p-2.5 text-center"><div className="text-lg font-bold text-sky-600">{filtered.length}</div><div className="text-[10px] text-gray-400">Papers</div></div>
            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-2.5 text-center"><div className="text-lg font-bold text-amber-600">{topAuthors.length}</div><div className="text-[10px] text-gray-400">Authors</div></div>
            <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-2.5 text-center"><div className="text-lg font-bold text-emerald-600">{readingList.length}</div><div className="text-[10px] text-gray-400">Reading List</div></div>
          </div>
        </div>
      </div>

      <UnlockBar selectedCount={d.selectedIds.size} newCount={Array.from(d.selectedIds).filter(id=>!d.unlockedIds.has(id)).length} unlocking={d.unlocking} creditBalance={d.creditBalance} onUnlock={d.handleUnlock} onClear={d.clearSelection}/>
      {d.drawerRow&&<Drawer open={!!d.drawerRow} onClose={()=>d.setDrawerRow(null)} title={String(d.drawerRow.title??'—')} isUnlocked={d.unlockedIds.has(String(d.drawerRow.id))} onUnlock={()=>{d.toggleSelect(String(d.drawerRow!.id));d.handleUnlock()}} unlocking={d.unlocking} tabs={tabs(d.drawerRow,d.unlockedIds.has(String(d.drawerRow.id)))}/>}
    </div>
  )
}
