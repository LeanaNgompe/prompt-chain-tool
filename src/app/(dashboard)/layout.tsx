'use client'

import { Sidebar } from '@/components/sidebar'
import { useState } from 'react'
import { Menu, X } from 'lucide-react'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  return (
    <div className="flex h-screen bg-warm-paper overflow-hidden">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-gray-900/60 backdrop-blur-sm lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar - responsive classes */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-64 transform bg-warm-paper transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <Sidebar onClose={() => setIsSidebarOpen(false)} />
      </div>
      
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile Header */}
        <header className="flex h-16 items-center justify-between border-b-2 border-sketchy bg-warm-paper px-4 lg:hidden">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 border-sketchy bg-card-bg shadow-hand active:shadow-none transition-all"
          >
            <Menu className="h-6 w-6" strokeWidth={3} />
          </button>
          <span className="text-lg font-black tracking-tight px-3 py-1 border-sketchy bg-pastel-yellow/20 transform -rotate-1">
            PromptChain ✨
          </span>
          <div className="w-10" /> {/* Spacer */}
        </header>

        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
