import { LayoutDashboard } from 'lucide-react'

export default function DashboardPage() {
  return (
    <div className="bg-warm-paper min-h-full p-8 text-foreground">
      <h1 className="text-3xl font-black flex items-center mb-10 underline decoration-accent decoration-wavy underline-offset-8">
        <div className="p-2 border-sketchy bg-pastel-purple/30 mr-4 shadow-hand">
          <LayoutDashboard className="h-8 w-8 text-accent" />
        </div>
        Dashboard
      </h1>
      
      <div className="max-w-3xl space-y-8">
        <div className="border-sketchy bg-white dark:bg-zinc-900 p-8 shadow-hand transform rotate-1">
          <h2 className="text-xl font-bold text-accent mb-4">Welcome back! ✨</h2>
          <p className="text-lg leading-relaxed">
            Welcome to the <span className="font-bold px-1 bg-pastel-yellow/30 dark:bg-yellow-900/20">Humor Flavor Prompt Chain Tool Admin</span>. 
            This is your workspace for crafting the perfect AI humor.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="border-sketchy-soft bg-pastel-blue/10 dark:bg-blue-900/5 p-6 transform -rotate-1">
            <h3 className="font-bold text-lg mb-2">Flavors 📝</h3>
            <p className="opacity-80">
              Manage your humor categories and the specific steps AI takes to generate captions.
            </p>
          </div>
          
          <div className="border-sketchy-soft bg-pastel-pink/10 dark:bg-pink-900/5 p-6 transform rotate-1">
            <h3 className="font-bold text-lg mb-2">Testing 🧪</h3>
            <p className="opacity-80">
              Run real-time tests on your humor pipeline with different images.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
