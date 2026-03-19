'use client'

import { useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from './client'
import type { Database } from '@/types/database.types'

export function useSupabaseClient(): SupabaseClient<Database> | null {
  const [supabase, setSupabase] = useState<SupabaseClient<Database> | null>(null)

  useEffect(() => {
    setSupabase(createClient())
  }, [])

  return supabase
}
