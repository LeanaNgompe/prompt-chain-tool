'use client'

import { createClient } from '@/utils/supabase/client'
import { useEffect, useState, use } from 'react'
import { Database } from '@/types/database.types'
import { ArrowLeft, Plus, Pencil, Trash2, ArrowUp, ArrowDown } from 'lucide-react'
import Link from 'next/link'

type HumorFlavor = Database['public']['Tables']['humor_flavors']['Row']
type HumorFlavorStep = Database['public']['Tables']['humor_flavor_steps']['Row']

export default function FlavorDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const supabase = createClient()
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

  const handleCreateOrUpdateStep = async (e: React.FormEvent) => {
    e.preventDefault()
    if (editingStep) {
      const { error } = await supabase
        .from('humor_flavor_steps')
        .update({
          description: newStep.description,
          llm_system_prompt: newStep.llm_system_prompt,
          llm_user_prompt: newStep.llm_user_prompt,
          llm_temperature: newStep.llm_temperature,
          llm_model_id: newStep.llm_model_id,
          llm_input_type_id: newStep.llm_input_type_id,
          llm_output_type_id: newStep.llm_output_type_id,
          humor_flavor_step_type_id: newStep.humor_flavor_step_type_id,
        } as any)
        .eq('id', editingStep.id)
      if (error) alert(error.message)
      else {
        setIsModalOpen(false)
        setEditingStep(null)
        fetchData()
      }
    } else {
      const nextOrder = steps.length > 0 ? Math.max(...steps.map((s) => s.order_by)) + 1 : 1
      const { error } = await supabase.from('humor_flavor_steps').insert([
        {
          ...newStep,
          humor_flavor_id: parseInt(id),
          order_by: nextOrder,
        } as any,
      ])
      if (error) alert(error.message)
      else {
        setIsModalOpen(false)
        fetchData()
      }
    }
  }

  const handleDeleteStep = async (stepId: number) => {
    if (confirm('Delete this step?')) {
      const { error } = await supabase.from('humor_flavor_steps').delete().eq('id', stepId)
      if (error) alert(error.message)
      else fetchData()
    }
  }

  const moveStep = async (index: number, direction: 'up' | 'down') => {
    const newSteps = [...steps]
    const otherIndex = direction === 'up' ? index - 1 : index + 1

    if (otherIndex < 0 || otherIndex >= steps.length) return

    const currentStep = newSteps[index]
    const otherStep = newSteps[otherIndex]

    // Use a temporary value to avoid unique constraint violations during swap
    // We'll use a very large value that shouldn't exist
    const tempOrder = -1 // Assuming order_by is usually positive

    try {
      // 1. Set current to temp
      await supabase.from('humor_flavor_steps').update({ order_by: tempOrder } as any).eq('id', currentStep.id)
      // 2. Set other to current's old order
      await supabase.from('humor_flavor_steps').update({ order_by: currentStep.order_by } as any).eq('id', otherStep.id)
      // 3. Set current to other's old order
      await supabase.from('humor_flavor_steps').update({ order_by: otherStep.order_by } as any).eq('id', currentStep.id)
      
      fetchData()
    } catch (err) {
      alert('Error reordering steps')
    }
  }

  const openEditModal = (step: HumorFlavorStep) => {
    setEditingStep(step)
    setNewStep(step)
    setIsModalOpen(true)
  }

  if (loading && !flavor) return <div>Loading...</div>

  return (
    <div>
      <div className="flex items-center space-x-4">
        <Link href="/flavors" className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
          <ArrowLeft className="h-6 w-6" />
        </Link>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
          {flavor?.slug} <span className="text-sm font-normal text-gray-500">({flavor?.description})</span>
        </h1>
      </div>

      <div className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-medium text-gray-900 dark:text-white">Steps</h2>
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
            className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
          >
            <Plus className="-ml-0.5 mr-1.5 h-5 w-5" />
            Add Step
          </button>
        </div>

        <div className="mt-4 space-y-4">
          {steps.map((step, index) => (
            <div
              key={step.id}
              className="rounded-lg border border-gray-200 bg-white dark:bg-gray-800 dark:border-gray-700 p-4 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300 font-bold">
                    {step.order_by}
                  </span>
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">{step.description}</h3>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => moveStep(index, 'up')}
                    disabled={index === 0}
                    className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                  >
                    <ArrowUp className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => moveStep(index, 'down')}
                    disabled={index === steps.length - 1}
                    className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                  >
                    <ArrowDown className="h-5 w-5" />
                  </button>
                  <button onClick={() => openEditModal(step)} className="p-1 text-gray-400 hover:text-blue-600">
                    <Pencil className="h-5 w-5" />
                  </button>
                  <button onClick={() => handleDeleteStep(step.id)} className="p-1 text-gray-400 hover:text-red-600">
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded bg-gray-50 dark:bg-gray-900 p-3">
                  <span className="text-xs font-bold uppercase text-gray-500">System Prompt</span>
                  <p className="mt-1 text-sm text-gray-700 dark:text-gray-300 line-clamp-3">{step.llm_system_prompt}</p>
                </div>
                <div className="rounded bg-gray-50 dark:bg-gray-900 p-3">
                  <span className="text-xs font-bold uppercase text-gray-500">User Prompt</span>
                  <p className="mt-1 text-sm text-gray-700 dark:text-gray-300 line-clamp-3">{step.llm_user_prompt}</p>
                </div>
              </div>
            </div>
          ))}
          {steps.length === 0 && <p className="text-center text-gray-500 py-8">No steps yet.</p>}
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div className="fixed inset-0 bg-gray-500 opacity-75" onClick={() => setIsModalOpen(false)}></div>
            <div className="relative w-full max-w-2xl transform overflow-hidden rounded-lg bg-white dark:bg-gray-800 p-6 shadow-xl">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                {editingStep ? 'Edit Step' : 'New Step'}
              </h3>
              <form onSubmit={handleCreateOrUpdateStep} className="mt-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
                  <input
                    type="text"
                    required
                    value={newStep.description || ''}
                    onChange={(e) => setNewStep({ ...newStep, description: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">System Prompt</label>
                  <textarea
                    rows={4}
                    value={newStep.llm_system_prompt || ''}
                    onChange={(e) => setNewStep({ ...newStep, llm_system_prompt: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">User Prompt</label>
                  <textarea
                    rows={4}
                    value={newStep.llm_user_prompt || ''}
                    onChange={(e) => setNewStep({ ...newStep, llm_user_prompt: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Temperature</label>
                    <input
                      type="number"
                      step="0.1"
                      value={newStep.llm_temperature || 0.7}
                      onChange={(e) => setNewStep({ ...newStep, llm_temperature: parseFloat(e.target.value) })}
                      className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Model ID</label>
                    <input
                      type="number"
                      value={newStep.llm_model_id || 1}
                      onChange={(e) => setNewStep({ ...newStep, llm_model_id: parseInt(e.target.value) })}
                      className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    />
                  </div>
                </div>
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                  >
                    {editingStep ? 'Update' : 'Create'}
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
