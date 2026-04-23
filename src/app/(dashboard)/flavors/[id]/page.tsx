'use client'

import { createClient } from '@/utils/supabase/client'
import { useEffect, useState, use } from 'react'
import { Database } from '@/types/database.types'
import { ArrowLeft, Plus, Pencil, Trash2, ArrowUp, ArrowDown, Settings2 } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

type HumorFlavor = Database['public']['Tables']['humor_flavors']['Row']
type HumorFlavorStep = Database['public']['Tables']['humor_flavor_steps']['Row']

export default function FlavorDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const supabase = createClient()
  const router = useRouter()
  const [flavor, setFlavor] = useState<HumorFlavor | null>(null)
  const [steps, setSteps] = useState<HumorFlavorStep[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingStep, setEditingStep] = useState<HumorFlavorStep | null>(null)
  const [newStep, setNewStep] = useState<Partial<HumorFlavorStep>>({
    description: '',
    llm_system_prompt: '',
    llm_user_prompt: '',
    llm_temperature: 0.7,
    llm_model_id: 1,
    llm_input_type_id: 1,
    llm_output_type_id: 1,
    humor_flavor_step_type_id: 1,
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const fetchData = async () => {
    setLoading(true)
    const { data: flavorData } = await supabase.from('humor_flavors').select('*').eq('id', parseInt(id)).single()
    const { data: stepsData } = await supabase
      .from('humor_flavor_steps')
      .select('*')
      .eq('humor_flavor_id', parseInt(id))
      .order('order_by', { ascending: true })

    setFlavor(flavorData)
    setSteps(stepsData || [])
    setLoading(false)
  }

  useEffect(() => {
    fetchData()
  }, [id])

  const handleDeleteFlavor = async () => {
    if (confirm('Are you sure you want to delete this flavor? All associated steps will be deleted.')) {
      const { error: stepsError } = await (supabase.from('humor_flavor_steps') as any)
        .delete()
        .eq('humor_flavor_id', flavor?.id)
      
      if (stepsError) {
        alert(`Failed to delete steps: ${stepsError.message}`)
        return
      }

      const { error } = await (supabase.from('humor_flavors') as any).delete().eq('id', flavor?.id)
      if (error) {
        alert(error.message)
      } else {
        router.push('/flavors')
      }
    }
  }

  const handleCreateOrUpdateStep = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmitting) return
    setIsSubmitting(true)

    try {
      if (editingStep) {
        const { error } = await (supabase.from('humor_flavor_steps') as any)
          .update({
            description: newStep.description,
            llm_system_prompt: newStep.llm_system_prompt,
            llm_user_prompt: newStep.llm_user_prompt,
            llm_temperature: newStep.llm_temperature,
            llm_model_id: newStep.llm_model_id,
            llm_input_type_id: newStep.llm_input_type_id,
            llm_output_type_id: newStep.llm_output_type_id,
            humor_flavor_step_type_id: newStep.humor_flavor_step_type_id,
          })
          .eq('id', editingStep.id)
        if (error) alert(error.message)
        else {
          setIsModalOpen(false)
          setEditingStep(null)
          fetchData()
        }
      } else {
        const nextOrder = steps.length > 0 ? Math.max(...steps.map((s) => s.order_by)) + 1 : 1
        const { id: _unusedId, ...stepDataWithoutId } = newStep as any
        const { error } = await (supabase.from('humor_flavor_steps') as any).insert([
          {
            ...stepDataWithoutId,
            humor_flavor_id: parseInt(id),
            order_by: nextOrder,
          },
        ])
        if (error) alert(error.message)
        else {
          setIsModalOpen(false)
          fetchData()
        }
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteStep = async (stepId: number) => {
    if (steps.length <= 1) {
      alert('A flavor must have at least one step. Keep some ink in the pen!')
      return
    }

    if (confirm('Erase this step from the notebook?')) {
      const { error } = await (supabase.from('humor_flavor_steps') as any).delete().eq('id', stepId)
      if (error) {
        alert(error.message)
      } else {
        const remainingSteps = steps.filter(s => s.id !== stepId)
        for (let i = 0; i < remainingSteps.length; i++) {
          const newOrder = i + 1
          if (remainingSteps[i].order_by !== newOrder) {
            await (supabase.from('humor_flavor_steps') as any)
              .update({ order_by: newOrder })
              .eq('id', remainingSteps[i].id)
          }
        }
        fetchData()
      }
    }
  }

  const moveStep = async (index: number, direction: 'up' | 'down') => {
    const newSteps = [...steps]
    const otherIndex = direction === 'up' ? index - 1 : index + 1

    if (otherIndex < 0 || otherIndex >= steps.length) return

    const temp = newSteps[index]
    newSteps[index] = newSteps[otherIndex]
    newSteps[otherIndex] = temp

    try {
      for (let i = 0; i < newSteps.length; i++) {
        await (supabase.from('humor_flavor_steps') as any)
          .update({ order_by: -(i + 1) })
          .eq('id', newSteps[i].id)
      }
      for (let i = 0; i < newSteps.length; i++) {
        await (supabase.from('humor_flavor_steps') as any)
          .update({ order_by: i + 1 })
          .eq('id', newSteps[i].id)
      }
      fetchData()
    } catch (err) {
      alert('Error shuffling steps')
    }
  }

  const openEditModal = (step: HumorFlavorStep) => {
    setEditingStep(step)
    setNewStep(step)
    setIsModalOpen(true)
  }

  if (loading && !flavor) return <div className="p-4 md:p-8 text-xl font-bold italic opacity-60 text-foreground">Sketching flavor details...</div>

  return (
    <div className="bg-warm-paper min-h-screen p-4 md:p-8 text-foreground">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 md:mb-10 gap-6">
        <div className="flex items-center space-x-4 md:space-x-6">
          <Link href="/flavors" className="p-2 border-sketchy bg-card-bg text-foreground/50 hover:text-accent shadow-hand transition-all">
            <ArrowLeft className="h-5 w-5 md:h-6 md:w-6" strokeWidth={3} />
          </Link>
          <div>
            <h1 className="text-2xl md:text-3xl font-black flex items-center gap-3">
              <span className="px-3 py-1 border-sketchy bg-pastel-yellow/30 dark:bg-yellow-900/20 transform rotate-1">
                {flavor?.slug}
              </span>
            </h1>
            <p className="mt-2 text-base md:text-lg opacity-70 italic">{flavor?.description}</p>
          </div>
        </div>
        <button
          onClick={handleDeleteFlavor}
          className="inline-flex items-center justify-center border-sketchy bg-card-bg px-4 md:px-5 py-2 text-base md:text-lg font-black text-red-500 shadow-hand hover:shadow-hand-hover hover:-translate-y-1 transition-all"
          title="Delete Flavor"
        >
          <Trash2 className="mr-2 h-4 w-4 md:h-5 md:w-5" strokeWidth={3} />
          Delete Flavor
        </button>
      </div>

      <div className="mt-8 md:mt-12 max-w-5xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
          <h2 className="text-xl md:text-2xl font-black flex items-center">
            <div className="p-2 border-sketchy bg-pastel-blue/30 mr-3">
              <Settings2 className="h-5 w-5 md:h-6 md:w-6 text-accent" />
            </div>
            Pipeline Steps
          </h2>
          <button
            onClick={() => {
              setEditingStep(null)
              setNewStep({
                description: '',
                llm_system_prompt: '',
                llm_user_prompt: '',
                llm_temperature: 0.7,
                llm_model_id: 1,
                llm_input_type_id: 1,
                llm_output_type_id: 1,
                humor_flavor_step_type_id: 1,
              })
              setIsModalOpen(true)
            }}
            className="inline-flex items-center justify-center border-sketchy bg-accent px-4 md:px-5 py-2 text-base md:text-lg font-black text-white shadow-hand hover:shadow-hand-hover hover:-translate-y-1 transition-all"
          >
            <Plus className="-ml-1 mr-2 h-5 w-5" strokeWidth={3} />
            Add Step
          </button>
        </div>

        <div className="space-y-6 md:space-y-8">
          {steps.map((step, index) => (
            <div
              key={step.id}
              className="border-sketchy bg-card-bg p-4 md:p-6 shadow-hand transform transition-all hover:rotate-0.5"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b-2 border-sketchy-soft pb-4 mb-6 gap-4">
                <div className="flex items-center space-x-4">
                  <span className="flex h-8 w-8 md:h-10 md:w-10 flex-shrink-0 items-center justify-center border-sketchy bg-pastel-purple/30 dark:bg-purple-900/30 text-lg md:text-xl font-black">
                    {step.order_by}
                  </span>
                  <div>
                    <h3 className="text-lg md:text-xl font-black">{step.description}</h3>
                  </div>
                </div>
                <div className="flex items-center space-x-2 md:space-x-3 self-end sm:self-auto">
                  <button
                    onClick={() => moveStep(index, 'up')}
                    disabled={index === 0}
                    className="p-1.5 md:p-2 border-sketchy-soft bg-card-bg text-foreground/40 hover:text-accent disabled:opacity-30 transition-all"
                  >
                    <ArrowUp className="h-4 w-4 md:h-5 md:w-5" strokeWidth={2.5} />
                  </button>
                  <button
                    onClick={() => moveStep(index, 'down')}
                    disabled={index === steps.length - 1}
                    className="p-1.5 md:p-2 border-sketchy-soft bg-card-bg text-foreground/40 hover:text-accent disabled:opacity-30 transition-all"
                  >
                    <ArrowDown className="h-4 w-4 md:h-5 md:w-5" strokeWidth={2.5} />
                  </button>
                  <button onClick={() => openEditModal(step)} className="p-1.5 md:p-2 border-sketchy-soft bg-card-bg text-foreground/60 hover:text-blue-500 transition-all">
                    <Pencil className="h-4 w-4 md:h-5 md:w-5" strokeWidth={2.5} />
                  </button>
                  <button onClick={() => handleDeleteStep(step.id)} className="p-1.5 md:p-2 border-sketchy-soft bg-card-bg text-red-400 hover:text-red-600 transition-all">
                    <Trash2 className="h-4 w-4 md:h-5 md:w-5" strokeWidth={2.5} />
                  </button>
                </div>
              </div>
              
              <div className="grid grid-cols-1 gap-4 md:gap-6 md:grid-cols-2">
                <div className="p-4 border-sketchy-soft bg-pastel-yellow/10 dark:bg-zinc-800/50">
                  <span className="text-[10px] md:text-xs font-black uppercase tracking-widest opacity-60 underline">System Prompt</span>
                  <p className="mt-2 md:mt-3 text-sm font-bold leading-relaxed line-clamp-4 opacity-80">{step.llm_system_prompt}</p>
                </div>
                <div className="p-4 border-sketchy-soft bg-pastel-blue/10 dark:bg-zinc-800/50">
                  <span className="text-[10px] md:text-xs font-black uppercase tracking-widest opacity-60 underline">User Prompt</span>
                  <p className="mt-2 md:mt-3 text-sm font-bold leading-relaxed line-clamp-4 opacity-80">{step.llm_user_prompt}</p>
                </div>
              </div>
            </div>
          ))}
          {steps.length === 0 && (
            <div className="border-sketchy bg-pastel-blue/5 p-8 md:p-12 text-center text-lg md:text-xl font-bold italic opacity-60">
              No steps found in the draft.
            </div>
          )}
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity" onClick={() => setIsModalOpen(false)}></div>
            <div className="relative w-full max-w-3xl transform border-sketchy bg-card-bg p-6 md:p-8 shadow-hand transition-all rotate-0.5">
              <h3 className="text-xl md:text-2xl font-black mb-6 md:mb-8 underline decoration-accent decoration-wavy">
                {editingStep ? 'Edit Step' : 'New Step'}
              </h3>
              <form onSubmit={handleCreateOrUpdateStep} className="space-y-4 md:space-y-6">
                <div>
                  <label className="block text-base md:text-lg font-bold opacity-80 mb-2">Description</label>
                  <input
                    type="text"
                    required
                    value={newStep.description || ''}
                    onChange={(e) => setNewStep({ ...newStep, description: e.target.value })}
                    className="block w-full border-sketchy-soft bg-pastel-yellow/10 dark:bg-zinc-800 p-2 md:p-3 text-base md:text-lg font-bold focus:ring-accent focus:border-accent text-foreground"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                  <div>
                    <label className="block text-base md:text-lg font-bold opacity-80 mb-2">System Prompt</label>
                    <textarea
                      rows={6}
                      value={newStep.llm_system_prompt || ''}
                      onChange={(e) => setNewStep({ ...newStep, llm_system_prompt: e.target.value })}
                      className="block w-full border-sketchy-soft bg-pastel-blue/10 dark:bg-zinc-800 p-2 md:p-3 text-sm font-bold focus:ring-accent focus:border-accent text-foreground"
                    />
                  </div>
                  <div>
                    <label className="block text-base md:text-lg font-bold opacity-80 mb-2">User Prompt</label>
                    <textarea
                      rows={6}
                      value={newStep.llm_user_prompt || ''}
                      onChange={(e) => setNewStep({ ...newStep, llm_user_prompt: e.target.value })}
                      className="block w-full border-sketchy-soft bg-pastel-pink/10 dark:bg-zinc-800 p-2 md:p-3 text-sm font-bold focus:ring-accent focus:border-accent text-foreground"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 md:gap-6">
                  <div>
                    <label className="block text-base md:text-lg font-bold opacity-80 mb-2">Temp</label>
                    <input
                      type="number"
                      step="0.1"
                      value={newStep.llm_temperature || 0.7}
                      onChange={(e) => setNewStep({ ...newStep, llm_temperature: parseFloat(e.target.value) })}
                      className="block w-full border-sketchy-soft bg-pastel-purple/10 dark:bg-zinc-800 p-2 md:p-3 text-base md:text-lg font-bold focus:ring-accent focus:border-accent text-foreground"
                    />
                  </div>
                  <div>
                    <label className="block text-base md:text-lg font-bold opacity-80 mb-2">Model</label>
                    <input
                      type="number"
                      value={newStep.llm_model_id || 1}
                      onChange={(e) => setNewStep({ ...newStep, llm_model_id: parseInt(e.target.value) })}
                      className="block w-full border-sketchy-soft bg-pastel-green/10 dark:bg-zinc-800 p-2 md:p-3 text-base md:text-lg font-bold focus:ring-accent focus:border-accent text-foreground"
                    />
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row-reverse gap-4 pt-4 md:pt-6">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full sm:w-auto border-sketchy bg-accent px-8 md:px-10 py-2.5 md:py-3 text-lg md:text-xl font-black text-white shadow-hand hover:shadow-hand-hover hover:-translate-y-1 transition-all disabled:opacity-50"
                  >
                    {isSubmitting ? 'Saving...' : (editingStep ? 'Update' : 'Create')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="w-full sm:w-auto border-sketchy bg-card-bg px-8 md:px-10 py-2.5 md:py-3 text-lg md:text-xl font-black opacity-70 shadow-hand hover:shadow-hand-hover transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
