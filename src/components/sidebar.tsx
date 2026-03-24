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

  const themeLabel = mounted ? (theme === 'system' ? 'Theme: System' : `Theme: ${theme === 'dark' ? 'Dark' : 'Light'}`) : 'Theme'

  return (
    <div className="flex h-full w-64 flex-col border-r border-gray-200 bg-white text-gray-900 dark:border-gray-800 dark:bg-gray-900 dark:text-white">
      <div className="flex h-16 items-center justify-center border-b border-gray-200 dark:border-gray-800">
        <span className="text-xl font-bold">PromptChain Admin</span>
      </div>
      <div className="flex flex-1 flex-col overflow-y-auto pt-5 pb-4">
        <nav className="mt-5 flex-1 space-y-1 px-2">
          {navigation.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  isActive
                    ? 'bg-indigo-100 text-indigo-700 dark:bg-gray-800 dark:text-white'
                    : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white',
                  'group flex items-center rounded-md px-2 py-2 text-sm font-medium'
                )}
              >
                <item.icon
                  className={cn(
                    isActive
                      ? 'text-indigo-600 dark:text-white'
                      : 'text-gray-500 group-hover:text-gray-700 dark:text-gray-400 dark:group-hover:text-gray-300',
                    'mr-3 h-6 w-6 flex-shrink-0'
                  )}
                />
                {item.name}
              </Link>
            )
          })}
        </nav>
      </div>
      <div className="flex border-t border-gray-200 p-4 dark:border-gray-800">
        <button
          onClick={cycleTheme}
          className="flex w-full items-center text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
        >
          {theme === 'dark' ? <Sun className="mr-3 h-6 w-6" /> : <Moon className="mr-3 h-6 w-6" />}
          {themeLabel}
        </button>
      </div>
      <div className="flex border-t border-gray-200 p-4 dark:border-gray-800">
        <button
          onClick={handleSignOut}
          className="flex w-full items-center text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
        >
          <LogOut className="mr-3 h-6 w-6 text-gray-500 dark:text-gray-400" />
          Sign Out
        </button>
      </div>
    </div>
  )
}
