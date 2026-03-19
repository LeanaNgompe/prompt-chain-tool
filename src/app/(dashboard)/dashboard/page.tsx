export default function DashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Dashboard</h1>
      <div className="mt-4 rounded-lg bg-white dark:bg-gray-800 p-6 shadow">
        <p className="text-gray-600 dark:text-gray-300">
          Welcome to the Humor Flavor Prompt Chain Tool Admin.
        </p>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Use the sidebar to manage humor flavors, their steps, and test the generation API.
        </p>
      </div>
    </div>
  )
}
