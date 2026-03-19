import Link from 'next/link'

export default function DeniedPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <h1 className="text-4xl font-bold text-gray-900 dark:text-white">Access Denied</h1>
      <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">
        You do not have the required permissions to access this tool.
      </p>
      <Link
        href="/login"
        className="mt-8 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
      >
        Back to Login
      </Link>
    </div>
  )
}
