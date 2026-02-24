// @ts-nocheck
'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { getCreditBalance } from '@/lib/credits'
import type { VerticalConfig } from '@/lib/verticals'
import type { ReactNode } from 'react'

export interface UseVerticalDataReturn {
  rows: Record<string, unknown>[]
  unlockedIds: Set<string>
  selectedIds: Set<string>
  loading: boolean
  unlocking: boolean
  error: string | null
  creditBalance: number
  drawerRow: Record<string, unknown> | null
  toggleSelect: (id: string) => void
  selectAll: () => void
  clearSelection: () => void
  handleUnlock: () => Promise<void>
  setDrawerRow: (row: Record<string, unknown> | null) => void
  refresh: () => Promise<void>
}

export function safeRender(value: unknown): ReactNode {
  if (typeof value === 'string') return value
  if (typeof value === 'number') return value
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (value === null || value === undefined) return null
  return '—'
}

export function useVerticalData(
  vertical: VerticalConfig,
  userId: string | undefined
): UseVerticalDataReturn {
  const [rows, setRows] = useState<Record<string, unknown>[]>([])
  const [unlockedIds, setUnlockedIds] = useState<Set<string>>(new Set())
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [unlocking, setUnlocking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [creditBalance, setCreditBalance] = useState(0)
  const [drawerRow, setDrawerRow] = useState<Record<string, unknown> | null>(null)

  const fetchData = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    setError(null)

    try {
      const [rowsRes, accessRes, balance] = await Promise.all([
        supabase
          .from(vertical.table)
          .select('*')
          .order(vertical.idField, { ascending: false })
          .limit(200),
        supabase
          .from(vertical.accessTable)
          .select(vertical.accessIdField)
          .eq('user_id', userId),
        getCreditBalance(userId),
      ])

      if (rowsRes.error) {
        setError(`Failed to load data: ${rowsRes.error.message}`)
        setLoading(false)
        return
      }

      setRows((rowsRes.data as Record<string, unknown>[]) ?? [])
      const accessRows = (accessRes.data ?? []) as Record<string, unknown>[]
      const ids = new Set(
        accessRows.map((r) => String(r[vertical.accessIdField]))
      )
      setUnlockedIds(ids)
      setCreditBalance(balance)
    } catch (e) {
      setError('Unexpected error loading data. Please refresh.')
      console.error('[useVerticalData]', e)
    }

    setLoading(false)
  }, [vertical.key, userId])

  useEffect(() => {
    fetchData()
    setSelectedIds(new Set())
    setDrawerRow(null)
  }, [fetchData])

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function selectAll() {
    setSelectedIds(
      new Set(rows.map(r => String(r[vertical.idField] ?? r.id)))
    )
  }

  function clearSelection() {
    setSelectedIds(new Set())
  }

  async function handleUnlock() {
    if (!userId || selectedIds.size === 0) return
    const newIds = Array.from(selectedIds).filter(id => !unlockedIds.has(id))
    if (newIds.length === 0) return

    setUnlocking(true)
    try {
      const { error: rpcError } = await supabase.rpc(vertical.rpc, {
        [vertical.rpcParam]: newIds,
      })
      if (!rpcError) {
        setUnlockedIds(prev => new Set([...Array.from(prev), ...newIds]))
        const newBalance = await getCreditBalance(userId)
        setCreditBalance(newBalance)
        clearSelection()
      } else {
        setError(`Unlock failed: ${rpcError.message}`)
      }
    } catch (e) {
      setError('Unlock failed. Please try again.')
      console.error('[handleUnlock]', e)
    }
    setUnlocking(false)
  }

  return {
    rows,
    unlockedIds,
    selectedIds,
    loading,
    unlocking,
    error,
    creditBalance,
    drawerRow,
    toggleSelect,
    selectAll,
    clearSelection,
    handleUnlock,
    setDrawerRow,
    refresh: fetchData,
  }
}
