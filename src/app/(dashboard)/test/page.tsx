'use client'

import { createClient } from '@/utils/supabase/client'
import { useEffect, useState } from 'react'
import { Database } from '@/types/database.types'
import { FlaskConical, Loader2 } from 'lucide-react'
import { Caption, CaptionList } from '@/components/caption-list'

type HumorFlavor = Database['public']['Tables']['humor_flavors']['Row']
type ImageRow = {
  id: string
  imageUrl: string
  thumbnailUrl: string
}

export default function TestToolPage() {
  const [flavors, setFlavors] = useState<HumorFlavor[]>([])
  const [selectedFlavorId, setSelectedFlavorId] = useState<string>('')
  const [images, setImages] = useState<ImageRow[]>([])
  const [selectedImageId, setSelectedImageId] = useState<string>('')
  const [selectedImageUrl, setSelectedImageUrl] = useState<string>('')
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<Caption[] | null>(null)
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

  useEffect(() => {
    const fetchImages = async () => {
      const supabase = createClient()
      const supabaseUntyped = supabase as unknown as {
        from: (table: string) => { select: (columns?: string) => Promise<{ data: unknown }> }
      }

      const { data } = await supabaseUntyped.from('images').select('*')
      const rows = (Array.isArray(data) ? data : []) as Array<Record<string, unknown>>

      const mapped: ImageRow[] = rows
        .map((row) => {
          const id = row.id ?? row.image_id ?? row.imageId
          const imageUrl = row.image_url ?? row.url ?? row.imageUrl
          const thumbnailUrl = row.thumbnail_url ?? row.thumbnailUrl ?? imageUrl

          if (!id || !imageUrl || !thumbnailUrl) return null
          if (typeof id !== 'string' || typeof imageUrl !== 'string' || typeof thumbnailUrl !== 'string') return null
          if (!UUID_REGEX.test(id)) return null

          return { id, imageUrl, thumbnailUrl }
        })
        .filter(Boolean) as ImageRow[]

      setImages(mapped)

      if (!selectedImageId && mapped.length > 0) {
        setSelectedImageId(mapped[0].id)
        setSelectedImageUrl(mapped[0].imageUrl)
      }
    }

    fetchImages()
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      body: JSON.stringify({ imageId: id, humor_flavor_id: Number(flavorId), imageUrl: selectedImageUrl }),
    })

    if (!captionRes.ok) {
      throw new Error(await getErrorMessage(captionRes, 'Caption generation failed'))
    }

    return captionRes.json()
  }

  const extractCaptions = (data: unknown): Caption[] => {
    if (!data || typeof data !== 'object') return []
    const payload = data as {
      captions?: unknown
      caption?: unknown
      text?: unknown
      output?: unknown
    }

    const raw = payload.captions ?? payload.caption ?? payload.text ?? payload.output
    const normalizeLine = (line: string) =>
      line
        .replace(/^\s*(?:\d+[\).\-\:]\s*|[-*•]\s*)/, '')
        .replace(/^["']|["']$/g, '')
        .trim()

    if (Array.isArray(raw)) {
      const items: Caption[] = []
      raw.forEach((item, index) => {
        if (typeof item === 'object' && item !== null && 'content' in item) {
          const obj = item as Record<string, unknown>
          items.push({
            id: String(obj.id ?? index),
            content: normalizeLine(String(obj.content ?? '')),
            image_id: String(obj.image_id ?? ''),
            humor_flavor_id: obj.humor_flavor_id as number | string | undefined,
          })
        } else {
          const content = normalizeLine(String(item))
          if (content) {
            items.push({ id: String(index), content })
          }
        }
      })
      return items
    }

    if (typeof raw === 'string') {
      const asJson = raw.trim()
      if (asJson.startsWith('[') && asJson.endsWith(']')) {
        try {
          const parsed = JSON.parse(asJson) as unknown
          if (Array.isArray(parsed)) {
            const items: Caption[] = []
            parsed.forEach((item, index) => {
              const content = normalizeLine(String(item))
              if (content) {
                items.push({ id: String(index), content })
              }
            })
            return items
          }
        } catch {
          // Fall back to newline parsing.
        }
      }

      const lines = raw.split('\n')
      const items: Caption[] = []
      lines.forEach((line, index) => {
        const content = normalizeLine(line)
        if (content) {
          items.push({ id: String(index), content })
        }
      })
      return items
    }
    return []
  }

  const runGeneration = async () => {
    setLoading(true)
    setResults(null)
    setError(null)

    try {
      if (!selectedImageId) {
        throw new Error('Please select or upload an image.')
      }
      if (!UUID_REGEX.test(selectedImageId.trim())) {
        throw new Error('Selected image id must be a valid UUID.')
      }

      const data = await generateFromImageId(selectedImageId.trim(), selectedFlavorId)
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

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault()
    await runGeneration()
  }

  const handleUpload = async () => {
    setError(null)
    if (!uploadFile) {
      setError('Please choose an image file to upload.')
      return
    }
    if (!selectedFlavorId) {
      setError('Select a humor flavor first.')
      return
    }

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('image', uploadFile)

      const res = await fetch('/api/images/upload', { method: 'POST', body: formData })
      if (!res.ok) {
        const txt = await res.text()
        throw new Error(`Upload failed: ${txt}`)
      }

      const data = await res.json()
      if (!data.imageId || !data.imageUrl) {
        throw new Error('Upload succeeded but imageId/imageUrl were missing from the response.')
      }

      setSelectedImageId(String(data.imageId))
      setSelectedImageUrl(String(data.imageUrl))

      // Generate captions immediately after upload/registration.
      await runGeneration()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Upload failed.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-white flex items-center">
        <FlaskConical className="mr-2 h-6 w-6 text-indigo-500" />
        Test Tool (Caption Generation)
      </h1>

      <div className="mt-8 max-w-4xl space-y-6">
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

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-4">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">A) Upload a new image</h3>
              <div className="mt-3">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  className="block w-full text-sm text-gray-900 dark:text-gray-100"
                />
              </div>

              <button
                type="button"
                onClick={() => void handleUpload()}
                disabled={uploading || loading || !selectedFlavorId}
                className="mt-4 flex w-full justify-center rounded-md border border-transparent bg-indigo-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
              >
                {uploading ? 'Uploading...' : 'Upload & Generate'}
              </button>
            </div>

            <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-4">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">B) Select an existing image</h3>
              <div className="mt-3 max-h-64 overflow-auto">
                {images.length === 0 ? (
                  <p className="text-sm text-gray-600 dark:text-gray-300">No images found.</p>
                ) : (
                  <div className="grid grid-cols-3 gap-3">
                    {images.map((img) => {
                      const isSelected = img.id === selectedImageId
                      return (
                        <button
                          key={img.id}
                          type="button"
                          onClick={() => {
                            setSelectedImageId(img.id)
                            setSelectedImageUrl(img.imageUrl)
                          }}
                          className={`relative overflow-hidden rounded-md border p-1 ${
                            isSelected
                              ? 'border-indigo-600 ring-2 ring-indigo-200 dark:ring-indigo-900'
                              : 'border-gray-200 hover:border-gray-400 dark:border-gray-700 dark:hover:border-gray-500'
                          }`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={img.thumbnailUrl} alt="" className="h-20 w-full rounded-sm object-cover" />
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              <div className="mt-3">
                {selectedImageId ? (
                  <p className="text-xs text-gray-600 dark:text-gray-300">
                    Selected: <span className="font-mono">{selectedImageId}</span>
                  </p>
                ) : (
                  <p className="text-xs text-gray-600 dark:text-gray-300">Select an image to enable generation.</p>
                )}
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || uploading || !selectedFlavorId || !selectedImageId}
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
            <CaptionList captions={results} />
          </div>
        )}
      </div>
    </div>
  )
}
