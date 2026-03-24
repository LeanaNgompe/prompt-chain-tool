'use client'

import { createClient } from '@/utils/supabase/client'
import { useEffect, useState } from 'react'
import { Database } from '@/types/database.types'
import { FlaskConical, Loader2 } from 'lucide-react'

type HumorFlavor = Database['public']['Tables']['humor_flavors']['Row']

export default function TestToolPage() {
  const [flavors, setFlavors] = useState<HumorFlavor[]>([])
  const [selectedFlavorId, setSelectedFlavorId] = useState<string>('')
  const [imageId, setImageId] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<string[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

  useEffect(() => {
    const fetchFlavors = async () => {
      const supabase = createClient()
      const { data } = await supabase.from('humor_flavors').select('*').order('slug')
      const typedFlavors: HumorFlavor[] = (data ?? []) as HumorFlavor[]
      setFlavors(typedFlavors)
      if (typedFlavors.length > 0) setSelectedFlavorId(typedFlavors[0].id.toString())
    }
    fetchFlavors()
  }, [])

  const getAuthHeaders = async (): Promise<Record<string, string>> => {
    const supabase = createClient()
    const { data } = await supabase.auth.getSession()
    const accessToken = data.session?.access_token

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`
    }
    return headers
  }

  const getErrorMessage = async (response: Response, fallback: string) => {
    const bodyText = await response.text()
    if (!bodyText) return `${fallback} (${response.status})`

    try {
      const parsed = JSON.parse(bodyText) as {
        message?: string
        statusMessage?: string
        details?: string
        attempted?: Array<{ method?: string; path?: string; status?: number }>
      }
      const primary = parsed.message || parsed.statusMessage
      if (parsed.attempted && parsed.attempted.length > 0) {
        const attempts = parsed.attempted
          .map((a) => `${a.method ?? 'METHOD'} ${a.path ?? 'PATH'} -> ${a.status ?? 'unknown'}`)
          .join(' | ')
        return `${fallback}: ${primary ?? 'Request failed'} (${attempts})`
      }
      if (primary && parsed.details) {
        return `${fallback}: ${primary} (${parsed.details})`
      }
      const details = primary || parsed.details
      return details ? `${fallback}: ${details}` : `${fallback} (${response.status})`
    } catch {
      return `${fallback}: ${bodyText}`
    }
  }

  const generateFromImageId = async (id: string, flavorId: string) => {
    const authHeaders = await getAuthHeaders()

    const captionRes = await fetch('/api/pipeline?step=generate-captions', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ imageId: id, humor_flavor_id: Number(flavorId) }),
    })

    if (!captionRes.ok) {
      throw new Error(await getErrorMessage(captionRes, 'Caption generation failed'))
    }

    return captionRes.json()
  }

  const extractCaptions = (data: unknown): string[] => {
    if (!data || typeof data !== 'object') return []
    const payload = data as {
      captions?: unknown
      caption?: unknown
      text?: unknown
      output?: unknown
    }

    const raw = payload.captions ?? payload.caption ?? payload.text ?? payload.output
    if (Array.isArray(raw)) {
      return raw.map((item) => String(item)).filter(Boolean)
    }
    if (typeof raw === 'string') {
      return raw
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
    }
    return []
  }

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setResults(null)
    setError(null)

    try {
      if (!imageId) {
        throw new Error('Please provide an image ID')
      }
      if (!UUID_REGEX.test(imageId.trim())) {
        throw new Error('Image ID must be a valid UUID from your uploaded/registered image record')
      }

      const data = await generateFromImageId(imageId.trim(), selectedFlavorId)
      const captions = extractCaptions(data)
      if (captions.length === 0) {
        throw new Error('No captions were returned by the generation pipeline')
      }
      setResults(captions)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-white flex items-center">
        <FlaskConical className="mr-2 h-6 w-6 text-indigo-500" />
        Test Tool (Caption Generation)
      </h1>

      <div className="mt-8 max-w-2xl">
        <form onSubmit={handleGenerate} className="space-y-6 rounded-lg bg-white dark:bg-gray-800 p-6 shadow">
          <div>
            <label htmlFor="flavor" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Select Humor Flavor
            </label>
            <select
              id="flavor"
              value={selectedFlavorId}
              onChange={(e) => setSelectedFlavorId(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            >
              {flavors.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.slug}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="imageId" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Image ID
            </label>
            <input
              type="text"
              id="imageId"
              required
              placeholder="e.g. 123"
              value={imageId}
              onChange={(e) => setImageId(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !imageId || !selectedFlavorId}
            className="flex w-full justify-center rounded-md border border-transparent bg-indigo-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Generating...
              </>
            ) : (
              'Generate Captions'
            )}
          </button>
        </form>

        {error && (
          <div className="mt-6 rounded-md bg-red-50 dark:bg-red-900/20 p-4">
            <div className="text-sm text-red-700 dark:text-red-400">{error}</div>
          </div>
        )}

        {results !== null && (
          <div className="mt-8 space-y-4">
            <h2 className="text-xl font-medium text-gray-900 dark:text-white">Generated Captions</h2>
            <div className="rounded-lg bg-gray-50 dark:bg-gray-900 p-6 border border-gray-200 dark:border-gray-700">
              <ul className="list-disc pl-5 space-y-2 text-sm text-gray-700 dark:text-gray-300">
                {results.map((caption, index) => (
                  <li key={`${index}-${caption}`}>{caption}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
