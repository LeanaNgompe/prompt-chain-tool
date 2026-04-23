import Link from 'next/link'
import { ShieldAlert } from 'lucide-react'

export default function DeniedPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-warm-paper px-4 text-center">
      <div className="w-full max-w-md border-sketchy bg-card-bg p-8 md:p-12 shadow-hand transform rotate-1">
        <div className="mx-auto h-20 w-20 bg-red-100 dark:bg-red-900/30 border-sketchy flex items-center justify-center mb-6">
          <ShieldAlert className="h-12 w-12 text-red-500" />
        </div>
        <h1 className="text-3xl md:text-4xl font-black text-foreground mb-4 underline decoration-red-400 decoration-wavy">
          Access Denied
        </h1>
        <p className="mt-4 text-lg md:text-xl font-bold text-foreground/70 italic">
          You do not have the required permissions to doodle in this tool.
        </p>
        <div className="mt-10">
          <Link
            href="/login"
            className="inline-block border-sketchy bg-accent px-8 py-3 text-lg md:text-xl font-black text-white shadow-hand hover:shadow-hand-hover hover:-translate-y-1 transition-all"
          >
            BACK TO LOGIN
          </Link>
        </div>
      </div>
    </div>
  )
}
