'use client'

import { createClient } from '@/utils/supabase/client'
import { useEffect, useState } from 'react'
import { Database } from '@/types/database.types'
import Link from 'next/link'
import { Plus, Pencil, Trash2, ExternalLink } from 'lucide-react'

type HumorFlavor = Database['public']['Tables']['humor_flavors']['Row']

export default function FlavorsPage() {
  const supabase = createClient()
  const [flavors, setFlavors] = useState<HumorFlavor[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingFlavor, setEditingFlavor] = useState<HumorFlavor | null>(null)
  const [newFlavor, setNewFlavor] = useState({ slug: '', description: '' })

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
    } else {
      const { error } = await (supabase.from('humor_flavors') as any)
        .insert([{ slug: newFlavor.slug, description: newFlavor.description }])
      if (error) alert(error.message)
      else {
        setIsModalOpen(false)
        setNewFlavor({ slug: '', description: '' })
        fetchFlavors()
      }
    }
  }

  const handleDelete = async (id: number) => {
    if (confirm('Are you sure you want to delete this flavor? All associated steps will be deleted if there are foreign key constraints.')) {
      const { error } = await (supabase.from('humor_flavors') as any).delete().eq('id', id)
      if (error) alert(error.message)
      else fetchFlavors()
    }
  }

  const openEditModal = (flavor: HumorFlavor) => {
    setEditingFlavor(flavor)
    setNewFlavor({ slug: flavor.slug, description: flavor.description || '' })
    setIsModalOpen(true)
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Humor Flavors</h1>
        <button
          onClick={() => {
            setEditingFlavor(null)
            setNewFlavor({ slug: '', description: '' })
            setIsModalOpen(true)
          }}
          className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
        >
          <Plus className="-ml-0.5 mr-1.5 h-5 w-5" aria-hidden="true" />
          New Flavor
        </button>
      </div>

      <div className="mt-8 flow-root">
        <div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
            <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
              <table className="min-w-full divide-y divide-gray-300 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 dark:text-white sm:pl-6">Slug</th>
                    <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">Description</th>
                    <th className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900">
                  {loading ? (
                    <tr>
                      <td colSpan={3} className="py-4 text-center text-sm text-gray-500">Loading...</td>
                    </tr>
                  ) : flavors.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="py-4 text-center text-sm text-gray-500">No flavors found.</td>
                    </tr>
                  ) : (
                    flavors.map((flavor) => (
                      <tr key={flavor.id}>
                        <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 dark:text-white sm:pl-6">
                          {flavor.slug}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300">
                          {flavor.description}
                        </td>
                        <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                          <div className="flex justify-end space-x-3">
                            <Link
                              href={`/flavors/${flavor.id}`}
                              className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300"
                            >
                              <ExternalLink className="h-5 w-5" />
                            </Link>
                            <button
                              onClick={() => openEditModal(flavor)}
                              className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-300"
                            >
                              <Pencil className="h-5 w-5" />
                            </button>
                            <button
                              onClick={() => handleDelete(flavor.id)}
                              className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                            >
                              <Trash2 className="h-5 w-5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4 text-center sm:p-0">
            <div 
              className="fixed inset-0 bg-gray-500/75 transition-opacity" 
              aria-hidden="true"
              onClick={() => setIsModalOpen(false)}
            ></div>

            <div className="relative transform overflow-hidden rounded-lg bg-white dark:bg-gray-800 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg">
              <form onSubmit={handleCreateOrUpdate}>
                <div className="bg-white dark:bg-gray-800 px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <div>
                    <div className="mt-3 text-center sm:mt-0 sm:text-left">
                      <h3 className="text-lg font-medium leading-6 text-gray-900 dark:text-white">
                        {editingFlavor ? 'Edit Flavor' : 'New Flavor'}
                      </h3>
                      <div className="mt-4 space-y-4">
                        <div>
                          <label htmlFor="slug" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Slug</label>
                          <input
                            type="text"
                            name="slug"
                            id="slug"
                            required
                            value={newFlavor.slug}
                            onChange={(e) => setNewFlavor({ ...newFlavor, slug: e.target.value })}
                            className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                          />
                        </div>
                        <div>
                          <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
                          <textarea
                            name="description"
                            id="description"
                            rows={3}
                            value={newFlavor.description}
                            onChange={(e) => setNewFlavor({ ...newFlavor, description: e.target.value })}
                            className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
                  <button
                    type="submit"
                    className="inline-flex w-full justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:ml-3 sm:w-auto sm:text-sm"
                  >
                    {editingFlavor ? 'Update' : 'Create'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
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
