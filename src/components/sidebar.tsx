'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { LayoutDashboard, FlaskConical, MessageSquareQuote, LogOut, Sun, Moon } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Humor Flavors', href: '/flavors', icon: MessageSquareQuote },
  { name: 'Test Tool', href: '/test', icon: FlaskConical },
]

export function Sidebar() {
  const pathname = usePathname()
  const supabase = createClient()
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const cycleTheme = () => {
    if (theme === 'light') {
      setTheme('dark')
      return
    }
    if (theme === 'dark') {
      setTheme('system')
      return
    }
    setTheme('light')
  }

  const themeLabel = mounted ? (theme === 'system' ? 'System' : theme === 'dark' ? 'Dark' : 'Light') : 'Theme'

  return (
    <div className="flex h-full w-64 flex-col border-r-2 border-sketchy bg-warm-paper text-foreground">
      <div className="flex h-20 items-center justify-center border-b-2 border-sketchy bg-pastel-yellow/20">
        <span className="text-xl font-bold tracking-tight px-4 py-1 border-sketchy bg-card-bg transform -rotate-1">
          PromptChain ✨
        </span>
      </div>
      
      <div className="flex flex-1 flex-col overflow-y-auto pt-8 pb-4 px-4">
        <nav className="flex-1 space-y-4">
          {navigation.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'group flex items-center px-3 py-3 text-sm font-bold border-sketchy-soft transition-all duration-200',
                  isActive
                    ? 'bg-accent text-white shadow-hand translate-x-1 border-sketchy'
                    : 'bg-card-bg text-foreground/70 hover:bg-accent hover:text-white hover:shadow-hand hover:-translate-y-0.5'
                )}
              >
                <item.icon
                  className={cn(
                    'mr-3 h-5 w-5 flex-shrink-0 transition-colors',
                    isActive ? 'text-white' : 'text-foreground/40 group-hover:text-white'
                  )}
                />
                {item.name}
              </Link>
            )
          })}
        </nav>
      </div>

      <div className="p-4 space-y-3 border-t-2 border-sketchy bg-pastel-blue/10">
        <button
          onClick={cycleTheme}
          className="flex w-full items-center justify-between px-3 py-2 text-sm font-bold border-sketchy-soft bg-card-bg hover:shadow-hand transition-all"
        >
          <div className="flex items-center">
            {mounted && (theme === 'dark' ? <Moon className="mr-3 h-4 w-4" /> : <Sun className="mr-3 h-4 w-4 text-orange-400" />)}
            {themeLabel}
          </div>
          <span className="text-[10px] uppercase opacity-50 font-mono">Theme</span>
        </button>

        <button
          onClick={handleSignOut}
          className="flex w-full items-center px-3 py-2 text-sm font-bold border-sketchy-soft bg-card-bg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 hover:shadow-hand transition-all"
        >
          <LogOut className="mr-3 h-4 w-4" />
          Sign Out
        </button>
      </div>
    </div>
  )
}
