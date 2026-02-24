// @ts-nocheck
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  ArrowRight, Database, Shield, Zap, BarChart3,
  Lock, ChevronRight, Star, CheckCircle
} from 'lucide-react'
import { VERTICAL_LIST } from '@/lib/verticals'

export default function LandingPage() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace('/dashboard/dealflow')
      else setChecking(false)
    })
  }, [router])

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center animate-pulse">
          <span className="text-white font-bold text-sm">VM</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white overflow-x-hidden">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 py-4 bg-gray-950/80 backdrop-blur-md border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center">
            <span className="text-white font-black text-base">VM</span>
          </div>
          <span className="font-bold text-white text-lg tracking-tight">VerifiedMeasure</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/login')}
            className="text-sm text-gray-400 hover:text-white transition-colors px-4 py-2"
          >
            Sign in
          </button>
          <button
            onClick={() => router.push('/login')}
            className="text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl transition-colors"
          >
            Get started
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-24 px-8 relative">
        {/* Background gradient */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[800px] h-[800px] rounded-full bg-blue-600/10 blur-[120px]" />
          <div className="absolute top-20 left-1/4 w-[400px] h-[400px] rounded-full bg-violet-600/8 blur-[100px]" />
        </div>

        <div className="max-w-5xl mx-auto text-center relative">
          <div className="inline-flex items-center gap-2 bg-blue-950/60 border border-blue-800/50 rounded-full px-4 py-1.5 text-xs text-blue-400 font-medium mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
            16 Intelligence Verticals · Live Data
          </div>

          <h1 className="text-5xl md:text-7xl font-black tracking-tight leading-[1.05] mb-6">
            <span className="text-white">The Intelligence</span>
            <br />
            <span className="bg-gradient-to-r from-blue-400 via-violet-400 to-blue-500 bg-clip-text text-transparent">
              Platform for Serious Buyers
            </span>
          </h1>

          <p className="text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed mb-10">
            Access verified data across 16 intelligence verticals — from deal flow to cybersecurity,
            clinical trials to real estate. Pay only for what you unlock.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => router.push('/login')}
              className="group flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold px-8 py-4 rounded-2xl transition-all hover:shadow-lg hover:shadow-blue-600/25 text-base"
            >
              Access Platform
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
            <button
              onClick={() => router.push('/login')}
              className="flex items-center gap-2 text-gray-300 hover:text-white border border-gray-700 hover:border-gray-500 px-8 py-4 rounded-2xl transition-all text-base font-medium"
            >
              View Demo
            </button>
          </div>

          {/* Social proof */}
          <div className="mt-12 flex items-center justify-center gap-6 text-sm text-gray-500">
            <div className="flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4 text-emerald-500" />
              <span>No subscription required</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4 text-emerald-500" />
              <span>Credit-based access</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4 text-emerald-500" />
              <span>Enterprise-grade security</span>
            </div>
          </div>
        </div>
      </section>

      {/* Verticals grid */}
      <section className="py-24 px-8 border-t border-white/5">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              16 Intelligence Verticals
            </h2>
            <p className="text-gray-400 text-lg max-w-xl mx-auto">
              Each vertical is a standalone intelligence product with unique data, analytics, and unlock mechanics.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {VERTICAL_LIST.map((v, i) => (
              <div
                key={v.key}
                onClick={() => router.push('/login')}
                className="group cursor-pointer bg-gray-900/60 hover:bg-gray-800/80 border border-white/5 hover:border-white/15 rounded-2xl p-4 transition-all hover:scale-[1.02]"
                style={{ animationDelay: `${i * 30}ms` }}
              >
                <div className="text-2xl mb-2">{v.icon}</div>
                <div className="text-sm font-semibold text-gray-200 mb-1">{v.shortLabel}</div>
                <div className="text-xs text-gray-500 leading-tight">{v.description}</div>
                <div className="mt-3 flex items-center gap-1 text-xs text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">
                  <span>Access</span>
                  <ChevronRight className="w-3 h-3" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Feature pillars */}
      <section className="py-24 px-8 border-t border-white/5">
        <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-8">
          {[
            {
              icon: <Database className="w-6 h-6" />,
              color: 'blue',
              title: 'Verified Data',
              desc: 'Every record is sourced, validated, and regularly refreshed. No stale leads or outdated intelligence.',
            },
            {
              icon: <Lock className="w-6 h-6" />,
              color: 'violet',
              title: 'Pay-Per-Unlock',
              desc: 'Preview all records freely. Spend credits only when you need full contact details or sensitive fields.',
            },
            {
              icon: <Shield className="w-6 h-6" />,
              color: 'emerald',
              title: 'Enterprise Security',
              desc: 'Row-level security enforced at the database layer. Your unlocks are yours alone — never shared.',
            },
            {
              icon: <BarChart3 className="w-6 h-6" />,
              color: 'amber',
              title: 'Deep Analytics',
              desc: 'Each vertical ships with unique charts, KPIs, and panels built for that specific data type.',
            },
            {
              icon: <Zap className="w-6 h-6" />,
              color: 'cyan',
              title: 'Instant Access',
              desc: 'No procurement, no contracts. Buy credits and start querying any of 16 verticals immediately.',
            },
            {
              icon: <Star className="w-6 h-6" />,
              color: 'pink',
              title: 'Built for Teams',
              desc: 'Share the platform with your team. Each user maintains their own credit balance and access history.',
            },
          ].map(({ icon, color, title, desc }) => (
            <div key={title} className="flex flex-col gap-4">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center bg-${color}-950/60 border border-${color}-800/40 text-${color}-400`}>
                {icon}
              </div>
              <div>
                <h3 className="font-semibold text-white mb-2">{title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-8 border-t border-white/5">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-white mb-4">
            Ready to access verified intelligence?
          </h2>
          <p className="text-gray-400 mb-10 text-lg">
            Create your account and receive 10 free credits to explore any vertical.
          </p>
          <button
            onClick={() => router.push('/login')}
            className="group inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold px-10 py-4 rounded-2xl transition-all hover:shadow-xl hover:shadow-blue-600/30 text-lg"
          >
            Get Started Free
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-10 px-8">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
              <span className="text-white font-bold text-xs">VM</span>
            </div>
            <span className="text-sm font-semibold text-gray-400">VerifiedMeasure</span>
          </div>
          <p className="text-xs text-gray-600">
            © {new Date().getFullYear()} VerifiedMeasure. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}
