import type { Metadata } from 'next'
import { Quicksand } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '@/components/theme-provider'

const quicksand = Quicksand({ 
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-quicksand',
})

export const metadata: Metadata = {
  title: 'PromptChain Admin',
  description: 'Manage your humor flavor pipeline',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning className={`${quicksand.variable}`}>
      <body className="font-sans antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}

