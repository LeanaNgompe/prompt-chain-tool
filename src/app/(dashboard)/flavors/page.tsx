'use client'

import { createClient } from '@/utils/supabase/client'
import { useEffect, useState } from 'react'
import { Database } from '@/types/database.types'
import Link from 'next/link'
import { Plus, Pencil, Trash2, ExternalLink, MessageSquareQuote, Copy } from 'lucide-react'

type HumorFlavor = Database['public']['Tables']['humor_flavors']['Row']

export default function FlavorsPage() {
  const supabase = createClient()
  const [flavors, setFlavors] = useState<HumorFlavor[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingFlavor, setEditingFlavor] = useState<HumorFlavor | null>(null)
  const [duplicatingFlavor, setDuplicatingFlavor] = useState<HumorFlavor | null>(null)
  const [newFlavor, setNewFlavor] = useState({ slug: '', description: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const fetchFlavors = async () => {
    setLoading(true)
    const { data, error } = await supabase.from('humor_flavors').select('*').order('slug')
    if (error) {
      console.error('Error fetching flavors:', error.message)
    } else {
      setFlavors(data || [])
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchFlavors()
  }, [])

  const handleCreateOrUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmitting) return
    setIsSubmitting(true)

    try {
      if (editingFlavor) {
        const { error } = await (supabase.from('humor_flavors') as any)
          .update({ slug: newFlavor.slug, description: newFlavor.description })
          .eq('id', editingFlavor.id)
        if (error) alert(error.message)
        else {
          setIsModalOpen(false)
          setEditingFlavor(null)
          setNewFlavor({ slug: '', description: '' })
          fetchFlavors()
        }
      } else if (duplicatingFlavor) {
        const { data, error } = await (supabase.from('humor_flavors') as any)
          .insert([{ slug: newFlavor.slug, description: newFlavor.description }])
          .select()
        
        if (error) {
          alert(error.message)
        } else if (data && data[0]) {
          const createdFlavor = data[0]
          
          // Fetch steps from original flavor
          const { data: originalSteps, error: stepsFetchError } = await supabase
            .from('humor_flavor_steps')
            .select('*')
            .eq('humor_flavor_id', duplicatingFlavor.id)
          
          if (stepsFetchError) {
            alert(`Flavor duplicated but failed to fetch original steps: ${stepsFetchError.message}`)
          } else if (originalSteps && originalSteps.length > 0) {
            // Prepare new steps
            const newSteps = originalSteps.map(step => {
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              const { id, ...stepData } = step as any
              return {
                ...stepData,
                humor_flavor_id: createdFlavor.id
              }
            })

            const { error: stepsInsertError } = await (supabase.from('humor_flavor_steps') as any)
              .insert(newSteps)

            if (stepsInsertError) {
              alert(`Flavor duplicated but failed to copy steps: ${stepsInsertError.message}`)
            }
          }

          setIsModalOpen(false)
          setDuplicatingFlavor(null)
          setNewFlavor({ slug: '', description: '' })
          fetchFlavors()
        }
      } else {
        const { data, error } = await (supabase.from('humor_flavors') as any)
          .insert([{ slug: newFlavor.slug, description: newFlavor.description }])
          .select()
        
        if (error) {
          alert(error.message)
        } else if (data && data[0]) {
          const createdFlavor = data[0]
          const { error: stepError } = await (supabase.from('humor_flavor_steps') as any)
            .insert([{
              humor_flavor_id: createdFlavor.id,
              order_by: 1,
              description: 'Initial Generation',
              llm_system_prompt: 'You are a helpful assistant.',
              llm_user_prompt: 'Generate a response based on the input.',
              llm_temperature: 0.7,
              llm_model_id: 1,
              llm_input_type_id: 1,
              llm_output_type_id: 1,
              humor_flavor_step_type_id: 1
            }])

          if (stepError) {
            alert(`Flavor created but failed to create initial step: ${stepError.message}.`)
            fetchFlavors()
          } else {
            setIsModalOpen(false)
            setNewFlavor({ slug: '', description: '' })
            fetchFlavors()
          }
        }
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (confirm('Are you sure you want to delete this flavor? All associated steps will be deleted.')) {
      const { error: stepsError } = await (supabase.from('humor_flavor_steps') as any)
        .delete()
        .eq('humor_flavor_id', id)
      
      if (stepsError) {
        alert(`Failed to delete steps: ${stepsError.message}`)
        return
      }

      const { error } = await (supabase.from('humor_flavors') as any).delete().eq('id', id)
      if (error) alert(error.message)
      else fetchFlavors()
    }
  }

  const openEditModal = (flavor: HumorFlavor) => {
    setDuplicatingFlavor(null)
    setEditingFlavor(flavor)
    setNewFlavor({ slug: flavor.slug, description: flavor.description || '' })
    setIsModalOpen(true)
  }

  const openDuplicateModal = (flavor: HumorFlavor) => {
    setEditingFlavor(null)
    setDuplicatingFlavor(flavor)
    setNewFlavor({ slug: `${flavor.slug}-copy`, description: flavor.description || '' })
    setIsModalOpen(true)
  }

  return (
    <div className="bg-warm-paper min-h-screen p-8 text-foreground">
      <div className="flex items-center justify-between mb-10">
        <h1 className="text-3xl font-black flex items-center underline decoration-accent decoration-wavy underline-offset-8">
          <div className="p-2 border-sketchy bg-pastel-purple/30 mr-4 shadow-hand">
            <MessageSquareQuote className="h-8 w-8 text-accent" />
          </div>
          Humor Flavors
        </h1>
        <button
          onClick={() => {
            setEditingFlavor(null)
            setDuplicatingFlavor(null)
            setNewFlavor({ slug: '', description: '' })
            setIsModalOpen(true)
          }}
          className="inline-flex items-center border-sketchy bg-accent px-6 py-3 text-lg font-black text-white shadow-hand hover:shadow-hand-hover hover:-translate-y-1 transition-all"
        >
          <Plus className="-ml-1 mr-2 h-6 w-6" strokeWidth={3} />
          New Flavor
        </button>
      </div>

      <div className="border-sketchy bg-card-bg shadow-hand overflow-hidden transform rotate-0.5">
        <table className="min-w-full divide-y-2 divide-sketchy">
          <thead className="bg-pastel-blue/30 dark:bg-blue-900/20">
            <tr>
              <th className="py-4 pl-6 pr-3 text-left text-lg font-black uppercase tracking-wider">Slug</th>
              <th className="px-3 py-4 text-left text-lg font-black uppercase tracking-wider">Description</th>
              <th className="relative py-4 pl-3 pr-6">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y-2 divide-sketchy bg-card-bg">
            {loading ? (
              <tr>
                <td colSpan={3} className="py-10 text-center text-xl font-bold italic opacity-70">Doodling...</td>
              </tr>
            ) : flavors.length === 0 ? (
              <tr>
                <td colSpan={3} className="py-10 text-center text-xl font-bold italic opacity-70">No flavors found in the notebook.</td>
              </tr>
            ) : (
              flavors.map((flavor) => (
                <tr key={flavor.id} className="hover:bg-pastel-yellow/20 dark:hover:bg-yellow-900/10 transition-colors">
                  <td className="whitespace-nowrap py-5 pl-6 pr-3 text-lg font-black">
                    <span className="px-2 py-1 border-sketchy-soft bg-pastel-yellow/30 dark:bg-yellow-900/30">{flavor.slug}</span>
                  </td>
                  <td className="px-3 py-5 text-lg font-bold">
                    {flavor.description}
                  </td>
                  <td className="relative whitespace-nowrap py-5 pl-3 pr-6 text-right font-bold">
                    <div className="flex justify-end space-x-4">
                      <Link
                        href={`/flavors/${flavor.id}`}
                        className="p-2 border-sketchy-soft bg-card-bg text-accent hover:shadow-hand transition-all"
                        title="View Details"
                      >
                        <ExternalLink className="h-5 w-5" strokeWidth={2.5} />
                      </Link>
                      <button
                        onClick={() => openDuplicateModal(flavor)}
                        className="p-2 border-sketchy-soft bg-card-bg text-pastel-purple hover:text-accent hover:shadow-hand transition-all"
                        title="Duplicate"
                      >
                        <Copy className="h-5 w-5" strokeWidth={2.5} />
                      </button>
                      <button
                        onClick={() => openEditModal(flavor)}
                        className="p-2 border-sketchy-soft bg-card-bg text-foreground/70 hover:text-accent hover:shadow-hand transition-all"
                        title="Edit"
                      >
                        <Pencil className="h-5 w-5" strokeWidth={2.5} />
                      </button>
                      <button
                        onClick={() => handleDelete(flavor.id)}
                        className="p-2 border-sketchy-soft bg-card-bg text-red-500 hover:text-red-700 hover:shadow-hand transition-all"
                        title="Delete"
                      >
                        <Trash2 className="h-5 w-5" strokeWidth={2.5} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity" onClick={() => setIsModalOpen(false)}></div>

            <div className="relative transform border-sketchy bg-card-bg p-8 shadow-hand transition-all sm:w-full sm:max-w-lg rotate-1">
              <form onSubmit={handleCreateOrUpdate}>
                <h3 className="text-2xl font-black mb-6 underline decoration-accent decoration-wavy">
                  {editingFlavor ? 'Edit Flavor' : duplicatingFlavor ? 'Duplicate Flavor' : 'New Flavor'}
                </h3>
                <div className="space-y-6">
                  <div>
                    <label htmlFor="slug" className="block text-lg font-black mb-2">Slug</label>
                    <input
                      type="text"
                      required
                      value={newFlavor.slug}
                      onChange={(e) => setNewFlavor({ ...newFlavor, slug: e.target.value })}
                      className="block w-full border-sketchy-soft bg-pastel-yellow/10 dark:bg-zinc-800/50 p-3 text-lg font-bold focus:ring-accent focus:border-accent text-foreground"
                    />
                  </div>
                  <div>
                    <label htmlFor="description" className="block text-lg font-black mb-2">Description</label>
                    <textarea
                      rows={3}
                      value={newFlavor.description}
                      onChange={(e) => setNewFlavor({ ...newFlavor, description: e.target.value })}
                      className="block w-full border-sketchy-soft bg-pastel-blue/10 dark:bg-zinc-800/50 p-3 text-lg font-bold focus:ring-accent focus:border-accent text-foreground"
                    />
                  </div>
                </div>
                <div className="mt-8 flex flex-col sm:flex-row-reverse gap-4">
                  <button
                    type="submit"
                    className="w-full sm:w-auto border-sketchy bg-accent px-8 py-3 text-lg font-black text-white shadow-hand hover:shadow-hand-hover hover:-translate-y-1 transition-all"
                  >
                    {editingFlavor ? 'Save' : duplicatingFlavor ? 'Duplicate' : 'Create'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="w-full sm:w-auto border-sketchy bg-card-bg px-8 py-3 text-lg font-black opacity-70 shadow-hand hover:shadow-hand-hover transition-all"
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
