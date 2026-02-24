// @ts-nocheck
import { supabase } from './supabase'

export async function getCreditBalance(userId: string): Promise<number> {
  const { data, error } = await supabase
    .from('credit_ledger')
    .select('delta')
    .eq('user_id', userId)
  if (error) throw error
  return (data ?? []).reduce((acc, row) => acc + (row.delta ?? 0), 0)
}
