'use client'

import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Sparkles } from 'lucide-react'

export default function LoginPage() {
  const supabase = createClient()
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    setLoading(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (error) {
      console.error('Error logging in:', error.message)
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-warm-paper px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 border-sketchy bg-white dark:bg-zinc-900 p-10 shadow-hand transform -rotate-1">
        <div className="text-center">
          <div className="mx-auto h-16 w-16 bg-pastel-yellow/30 border-sketchy flex items-center justify-center mb-4">
            <Sparkles className="h-10 w-10 text-accent" />
          </div>
          <h2 className="text-4xl font-black text-gray-900 dark:text-white tracking-tight">
            PromptChain
          </h2>
          <p className="mt-4 text-xl font-bold text-gray-600 dark:text-gray-400 italic">
            Admin Drawing Room
          </p>
        </div>
        <div className="mt-10">
          <button
            onClick={handleLogin}
            disabled={loading}
            className="group relative flex w-full justify-center border-sketchy bg-accent py-5 px-6 text-2xl font-black text-white shadow-hand hover:shadow-hand-hover hover:-translate-y-1 transition-all disabled:opacity-50"
          >
            {loading ? 'Entering...' : 'LOGIN WITH GOOGLE'}
          </button>
          <p className="mt-6 text-center text-xs font-black text-gray-500 uppercase tracking-[0.2em]">
            Restricted to Authorized Admin Doodlers
          </p>
        </div>
      </div>
    </div>
  )
}
