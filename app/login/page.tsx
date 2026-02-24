// @ts-nocheck
'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Eye, EyeOff, ArrowRight, Database, Shield, Zap, BarChart3, Lock, CheckCircle, ChevronRight, Star } from 'lucide-react'
import { VERTICAL_LIST } from '@/lib/verticals'

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<'landing' | 'login' | 'signup'>('landing')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace('/dashboard/dealflow')
      else setChecking(false)
    })
  }, [router])

  async function handleAuth() {
    if (!email || !password) { setError('Please enter email and password.'); return }
    setLoading(true)
    setError('')

    if (mode === 'signup') {
      const { error: signUpError } = await supabase.auth.signUp({ email, password })
      if (signUpError) { setError(signUpError.message); setLoading(false); return }
      setError('Account created! Please sign in.')
      setMode('login')
      setLoading(false)
      return
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    if (signInError) {
      setError(signInError.message)
      setLoading(false)
      return
    }
    router.replace('/dashboard/dealflow')
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center animate-pulse">
          <span className="text-white font-bold text-sm">VM</span>
        </div>
      </div>
    )
  }

  if (mode === 'landing') {
    return (
      <div className="min-h-screen bg-gray-950 text-white overflow-x-hidden">
        {/* Nav */}
        <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 py-4 bg-gray-950/80 backdrop-blur-md border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl overflow-hidden shrink-0"><Image src="/vm-logo.png" alt="VerifiedMeasure" width={36} height={36} className="w-full h-full object-cover" /></div>
            <span className="font-bold text-white text-lg tracking-tight">VerifiedMeasure</span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setMode('login')} className="text-sm text-gray-400 hover:text-white transition-colors px-4 py-2">Sign in</button>
            <button onClick={() => setMode('signup')} className="text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl transition-colors">Get started</button>
          </div>
        </nav>

        {/* Hero */}
        <section className="pt-32 pb-24 px-8 relative">
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[800px] h-[800px] rounded-full bg-blue-600/10 blur-[120px]" />
            <div className="absolute top-20 left-1/4 w-[400px] h-[400px] rounded-full bg-violet-600/8 blur-[100px]" />
          </div>
          <div className="max-w-5xl mx-auto text-center relative">
            <div className="inline-flex items-center gap-2 bg-blue-950/60 border border-blue-800/50 rounded-full px-4 py-1.5 text-xs text-blue-400 font-medium mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
              16 Intelligence Verticals · Verified Data
            </div>
            <h1 className="text-5xl md:text-7xl font-black tracking-tight leading-[1.05] mb-6">
              <span className="text-white">The Intelligence</span>
              <br />
              <span className="bg-gradient-to-r from-blue-400 via-violet-400 to-blue-500 bg-clip-text text-transparent">Platform for Serious Buyers</span>
            </h1>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed mb-10">
              Access verified data across 16 intelligence verticals — deal flow, cybersecurity, clinical trials, real estate, and more. Pay only for what you unlock.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button onClick={() => setMode('signup')} className="group flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold px-8 py-4 rounded-2xl transition-all text-base">
                Access Platform <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
              <button onClick={() => setMode('login')} className="flex items-center gap-2 text-gray-300 hover:text-white border border-gray-700 hover:border-gray-500 px-8 py-4 rounded-2xl transition-all text-base font-medium">
                Sign In
              </button>
            </div>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-6 text-sm text-gray-500">
              {['No subscription required', 'Credit-based access', 'Enterprise-grade security'].map(t => (
                <div key={t} className="flex items-center gap-1.5"><CheckCircle className="w-4 h-4 text-emerald-500" /><span>{t}</span></div>
              ))}
            </div>
          </div>
        </section>

        {/* Verticals */}
        <section className="py-24 px-8 border-t border-white/5">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-14">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">16 Intelligence Verticals</h2>
              <p className="text-gray-400 text-lg max-w-xl mx-auto">Each a standalone product with unique data, analytics, and unlock mechanics.</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {VERTICAL_LIST.map(v => (
                <div key={v.key} onClick={() => setMode('signup')} className="group cursor-pointer bg-gray-900/60 hover:bg-gray-800/80 border border-white/5 hover:border-white/15 rounded-2xl p-4 transition-all hover:scale-[1.02]">
                  <div className="text-2xl mb-2">{v.icon}</div>
                  <div className="text-sm font-semibold text-gray-200 mb-1">{v.shortLabel}</div>
                  <div className="text-xs text-gray-500 leading-tight">{v.description}</div>
                  <div className="mt-3 flex items-center gap-1 text-xs text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span>Access</span><ChevronRight className="w-3 h-3" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="py-24 px-8 border-t border-white/5">
          <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-8">
            {[
              { icon: <Database className="w-6 h-6" />, color: 'blue', title: 'Verified Data', desc: 'Every record sourced, validated, and regularly refreshed.' },
              { icon: <Lock className="w-6 h-6" />, color: 'violet', title: 'Pay-Per-Unlock', desc: 'Preview all records freely. Spend credits only for sensitive fields.' },
              { icon: <Shield className="w-6 h-6" />, color: 'emerald', title: 'Enterprise Security', desc: 'Row-level security enforced at the database layer.' },
              { icon: <BarChart3 className="w-6 h-6" />, color: 'amber', title: 'Deep Analytics', desc: 'Unique charts, KPIs, and panels built for each data type.' },
              { icon: <Zap className="w-6 h-6" />, color: 'cyan', title: 'Instant Access', desc: 'No contracts. Buy credits and start querying immediately.' },
              { icon: <Star className="w-6 h-6" />, color: 'pink', title: 'Built for Teams', desc: 'Each user maintains their own credit balance and history.' },
            ].map(({ icon, color, title, desc }) => (
              <div key={title} className="flex flex-col gap-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center bg-gray-800 border border-gray-700 text-${color}-400`}>{icon}</div>
                <div>
                  <h3 className="font-semibold text-white mb-1">{title}</h3>
                  <p className="text-sm text-gray-400 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="py-24 px-8 border-t border-white/5">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-4xl font-bold text-white mb-4">Ready to access verified intelligence?</h2>
            <p className="text-gray-400 mb-10 text-lg">Create your account and receive free credits to explore any vertical.</p>
            <button onClick={() => setMode('signup')} className="group inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold px-10 py-4 rounded-2xl transition-all text-lg">
              Get Started Free <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-white/5 py-10 px-8">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg overflow-hidden shrink-0"><Image src="/vm-logo.png" alt="VM" width={28} height={28} className="w-full h-full object-cover" /></div>
              <span className="text-sm font-semibold text-gray-400">VerifiedMeasure</span>
            </div>
            <p className="text-xs text-gray-600">© {new Date().getFullYear()} VerifiedMeasure. All rights reserved.</p>
          </div>
        </footer>
      </div>
    )
  }

  // Auth form
  return (
    <div className="min-h-screen bg-gray-950 flex">
      {/* Left panel */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 p-12 bg-gray-900 border-r border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white font-black text-base">VM</div>
          <span className="font-bold text-white text-xl">VerifiedMeasure</span>
        </div>
        <div>
          <div className="text-sm text-blue-400 font-medium mb-4 uppercase tracking-widest">Intelligence Platform</div>
          <h2 className="text-4xl font-black text-white leading-tight mb-6">
            Verified data.<br />
            <span className="bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">Serious intelligence.</span>
          </h2>
          <p className="text-gray-400 mb-10 text-lg leading-relaxed">
            Access 16 intelligence verticals with a credit-based unlock model. Preview everything, pay only for what matters.
          </p>
          <div className="grid grid-cols-2 gap-3">
            {VERTICAL_LIST.slice(0, 8).map(v => (
              <div key={v.key} className="flex items-center gap-2.5 text-sm text-gray-400">
                <span>{v.icon}</span>
                <span>{v.shortLabel}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="text-xs text-gray-600">© {new Date().getFullYear()} VerifiedMeasure</div>
      </div>

      {/* Right panel — auth form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-10 lg:hidden">
            <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0"><Image src="/vm-logo.png" alt="VerifiedMeasure" width={40} height={40} className="w-full h-full object-cover" /></div>
            <span className="font-bold text-white text-xl">VerifiedMeasure</span>
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-bold text-white mb-1">
              {mode === 'login' ? 'Welcome back' : 'Create account'}
            </h1>
            <p className="text-gray-400 text-sm">
              {mode === 'login'
                ? 'Sign in to access your intelligence dashboard'
                : 'Start with free credits — no credit card required'}
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Email address</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAuth()}
                placeholder="you@company.com"
                className="w-full bg-gray-900 border border-gray-700 focus:border-blue-500 rounded-xl px-4 py-3 text-white placeholder:text-gray-600 text-sm outline-none transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAuth()}
                  placeholder="••••••••"
                  className="w-full bg-gray-900 border border-gray-700 focus:border-blue-500 rounded-xl px-4 py-3 pr-10 text-white placeholder:text-gray-600 text-sm outline-none transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          {error && (
            <div className={`mt-4 text-sm px-4 py-3 rounded-xl ${
              error.includes('created') || error.includes('check')
                ? 'bg-emerald-900/30 border border-emerald-800 text-emerald-400'
                : 'bg-red-900/30 border border-red-800 text-red-400'
            }`}>
              {error}
            </div>
          )}

          <button
            onClick={handleAuth}
            disabled={loading}
            className="mt-6 w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3.5 rounded-xl transition-colors"
          >
            {loading ? (
              <span className="animate-pulse">{mode === 'login' ? 'Signing in…' : 'Creating account…'}</span>
            ) : (
              <>
                {mode === 'login' ? 'Sign in' : 'Create account'}
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          <div className="mt-6 text-center">
            <button
              onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError('') }}
              className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
            >
              {mode === 'login'
                ? "Don't have an account? Sign up"
                : 'Already have an account? Sign in'}
            </button>
          </div>

          <button
            onClick={() => setMode('landing')}
            className="mt-4 w-full text-center text-xs text-gray-600 hover:text-gray-400 transition-colors"
          >
            ← Back to homepage
          </button>
        </div>
      </div>
    </div>
  )
}
