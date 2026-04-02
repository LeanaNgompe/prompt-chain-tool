'use client'

import { createClient } from '@/utils/supabase/client'
import { useEffect, useState } from 'react'
import { Database } from '@/types/database.types'
import { FlaskConical, Loader2, Sparkles, Upload, X } from 'lucide-react'
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
    if (!data) return []
    
    const results: Caption[] = []
    const seenContents = new Set<string>()

    const normalizeLine = (line: string) =>
      line
        .replace(/^\s*(?:\d+[\).\-\:]\s*|[-*•]\s*)/, '')
        .replace(/^["']|["']$/g, '')
        .trim()

    const processItem = (item: unknown, depth = 0) => {
      if (depth > 5 || !item) return

      if (Array.isArray(item)) {
        item.forEach((child) => processItem(child, depth + 1))
        return
      }

      if (typeof item === 'object' && item !== null) {
        const obj = item as Record<string, unknown>
        
        if (typeof obj.content === 'string' && obj.content.trim().length > 0) {
          const trimmed = obj.content.trim()
          if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
            try {
              const parsed = JSON.parse(trimmed)
              if (Array.isArray(parsed)) {
                processItem(parsed, depth + 1)
                return
              }
            } catch {
            }
          }

          const content = normalizeLine(trimmed)
          if (content && !seenContents.has(content)) {
            results.push({
              id: String(obj.id ?? obj.image_id ?? results.length),
              content: content,
              image_id: String(obj.image_id ?? ''),
              humor_flavor_id: obj.humor_flavor_id as number | string | undefined,
            })
            seenContents.add(content)
          }
          return
        }

        const possibleKeys = ['captions', 'caption', 'text', 'output', 'results', 'data', 'items', 'content']
        let foundSomething = false
        for (const key of possibleKeys) {
          if (obj[key] !== undefined && obj[key] !== null) {
            processItem(obj[key], depth + 1)
            foundSomething = true
          }
        }
        
        if (!foundSomething && depth === 0) {
          Object.values(obj).forEach(val => {
            if (typeof val === 'string' && val.length > 10) {
              processItem(val, depth + 1)
            }
          })
        }
        return
      }

      if (typeof item === 'string') {
        const trimmed = item.trim()
        if (!trimmed) return

        if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
          try {
            const parsed = JSON.parse(trimmed)
            processItem(parsed, depth + 1)
            return
          } catch {
          }
        }

        if (trimmed.includes('\n')) {
          trimmed.split('\n').forEach(line => processItem(line, depth + 1))
          return
        }

        const content = normalizeLine(trimmed)
        if (content && !seenContents.has(content)) {
          if (!(content.startsWith('{') && content.endsWith('}')) && 
              !(content.startsWith('[') && content.endsWith(']'))) {
            results.push({ id: String(results.length), content })
            seenContents.add(content)
          }
        }
      }
    }

    processItem(data)
    return results
  }

  const runGeneration = async (forcedId?: string) => {
    setLoading(true)
    setResults(null)
    setError(null)

    try {
      const idToUse = forcedId || selectedImageId
      if (!idToUse) {
        throw new Error('Please select or upload an image.')
      }
      if (!UUID_REGEX.test(idToUse.trim())) {
        throw new Error('Selected image id must be a valid UUID.')
      }

      const data = await generateFromImageId(idToUse.trim(), selectedFlavorId)
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

      const newId = String(data.imageId)
      setSelectedImageId(newId)
      setSelectedImageUrl(String(data.imageUrl))

      setUploadFile(null)
      await runGeneration(newId)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Upload failed.')
    } finally {
      setUploading(false)
    }
  }

  const resetSelection = () => {
    setSelectedImageId('')
    setSelectedImageUrl('')
    setResults(null)
    setError(null)
    setUploadFile(null)
  }

  return (
    <div className="bg-warm-paper min-h-screen p-4 md:p-8 text-foreground font-sans">
      <h1 className="text-3xl font-black flex items-center mb-10 text-foreground underline decoration-accent decoration-wavy underline-offset-8">
        <div className="p-2 border-sketchy bg-pastel-purple/30 mr-4 shadow-hand">
          <FlaskConical className="h-8 w-8 text-accent" />
        </div>
        Test Tool <span className="ml-2 font-normal opacity-50 italic decoration-transparent text-xl">(Caption Generation)</span>
      </h1>

      <div className="max-w-5xl space-y-10">
        <form onSubmit={handleGenerate} className="space-y-8 border-sketchy bg-card-bg p-8 shadow-hand text-foreground">
          <div>
            <label htmlFor="flavor" className="block text-xl font-black mb-2 underline decoration-pastel-yellow decoration-4 text-foreground">
              Step 1: Select Humor Flavor
            </label>
            <select
              id="flavor"
              value={selectedFlavorId}
              onChange={(e) => setSelectedFlavorId(e.target.value)}
              className="mt-1 block w-full border-sketchy-soft bg-pastel-yellow/20 dark:bg-zinc-800 p-4 text-xl font-bold focus:ring-accent focus:border-accent text-foreground"
            >
              {flavors.map((f) => (
                <option key={f.id} value={f.id} className="bg-card-bg text-foreground">
                  {f.slug}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-10 md:grid-cols-2">
            <div className="border-sketchy-soft bg-pastel-blue/10 dark:bg-blue-900/10 p-6 transform rotate-1 shadow-hand text-foreground min-h-[350px] flex flex-col">
              <h3 className="text-xl font-black mb-4 underline decoration-accent decoration-wavy text-foreground">A) Upload a new image</h3>
              
              {selectedImageUrl && !images.some(img => img.imageUrl === selectedImageUrl) ? (
                <div className="flex-1 flex flex-col items-center justify-center space-y-4">
                  <div className="border-sketchy bg-card-bg p-2 shadow-hand transform -rotate-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={selectedImageUrl} alt="Uploaded preview" className="max-h-48 rounded-sm object-contain" />
                  </div>
                  <button 
                    type="button" 
                    onClick={resetSelection}
                    className="flex items-center gap-2 text-red-500 font-bold hover:underline"
                  >
                    <X size={16} strokeWidth={3} /> Change Image
                  </button>
                </div>
              ) : (
                <div className="flex-1 flex flex-col">
                  <div className="mt-3 flex-1 flex items-center justify-center border-2 border-dashed border-sketchy bg-white/50 dark:bg-black/20 p-4 mb-4">
                    {uploadFile ? (
                      <div className="text-center">
                        <p className="font-bold text-accent">{uploadFile.name}</p>
                        <p className="text-xs opacity-60">Ready to sketch!</p>
                      </div>
                    ) : (
                      <div className="text-center opacity-40">
                        <Upload className="mx-auto h-10 w-10 mb-2" />
                        <p className="font-bold uppercase tracking-widest text-xs">Drop your doodle here</p>
                      </div>
                    )}
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                    className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:border-sketchy file:bg-accent file:text-white file:font-bold hover:file:bg-indigo-700 cursor-pointer text-foreground"
                  />
                  <button
                    type="button"
                    onClick={() => void handleUpload()}
                    disabled={uploading || loading || !selectedFlavorId || !uploadFile}
                    className="mt-6 w-full py-3 px-6 border-sketchy bg-card-bg text-lg font-black shadow-hand hover:shadow-hand-hover hover:-translate-y-1 transition-all disabled:opacity-50 text-foreground flex items-center justify-center gap-2"
                  >
                    {uploading ? <Loader2 className="animate-spin" /> : <Sparkles size={18} />}
                    {uploading ? 'Drawing...' : 'Upload & Generate'}
                  </button>
                </div>
              )}
            </div>

            <div className="border-sketchy-soft bg-pastel-pink/10 dark:bg-pink-900/10 p-6 transform -rotate-1 shadow-hand text-foreground min-h-[350px] flex flex-col">
              <h3 className="text-xl font-black mb-4 underline decoration-pink-400 decoration-wavy text-foreground">B) Select from gallery</h3>
              
              {selectedImageUrl && images.some(img => img.imageUrl === selectedImageUrl) ? (
                <div className="flex-1 flex flex-col items-center justify-center space-y-4">
                  <div className="border-sketchy bg-card-bg p-2 shadow-hand transform rotate-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={selectedImageUrl} alt="Gallery preview" className="max-h-48 rounded-sm object-contain" />
                  </div>
                  <button 
                    type="button" 
                    onClick={resetSelection}
                    className="flex items-center gap-2 text-accent font-bold hover:underline"
                  >
                    <X size={16} strokeWidth={3} /> Pick Another
                  </button>
                </div>
              ) : (
                <div className="flex-1 flex flex-col">
                  <div className="mt-3 flex-1 max-h-64 overflow-auto custom-scrollbar bg-white/50 dark:bg-black/20 p-2 border-sketchy-soft">
                    {images.length === 0 ? (
                      <p className="text-sm opacity-60 italic p-4 text-foreground text-center">The gallery is empty...</p>
                    ) : (
                      <div className="grid grid-cols-3 gap-4">
                        {images.map((img) => (
                          <button
                            key={img.id}
                            type="button"
                            onClick={() => {
                              setSelectedImageId(img.id)
                              setSelectedImageUrl(img.imageUrl)
                            }}
                            className="relative overflow-hidden border-sketchy-soft p-1 transition-all shadow-sm grayscale hover:grayscale-0 border-gray-200 dark:border-gray-700 hover:scale-105"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={img.thumbnailUrl} alt="" className="h-20 w-full object-cover" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="mt-4">
                    <p className="text-xs opacity-60 italic text-foreground text-center">Pick a doodle above to blow it up!</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || uploading || !selectedFlavorId || !selectedImageId}
            className="w-full py-6 px-8 border-sketchy bg-accent hover:bg-indigo-600 dark:hover:bg-indigo-500 text-white text-2xl font-black shadow-hand hover:shadow-hand-hover hover:-translate-y-1 transition-all disabled:opacity-50 flex justify-center items-center gap-4 group"
          >
            {loading ? (
              <>
                <Loader2 className="h-8 w-8 animate-spin" />
                <span>THINKING...</span>
              </>
            ) : (
              <>
                <Sparkles className="h-8 w-8 group-hover:animate-bounce" />
                <span className="tracking-widest uppercase">Generate Captions</span>
                <Sparkles className="h-8 w-8 group-hover:animate-bounce" />
              </>
            )}
          </button>
        </form>

        {error && (
          <div className="border-sketchy bg-red-50 dark:bg-red-950/30 p-6 transform -rotate-1 shadow-hand border-red-500 text-foreground">
            <div className="text-lg text-red-700 dark:text-red-400 font-black">Oops! {error}</div>
          </div>
        )}

        {results !== null && (
          <div className="mt-16 animate-in fade-in slide-in-from-bottom-8 duration-700">
            <h2 className="text-3xl font-black mb-8 flex items-center text-foreground">
              <span className="p-3 bg-accent/20 border-sketchy mr-4 shadow-hand transform -rotate-3 text-foreground">📝</span>
              Generated Captions
            </h2>
            <CaptionList captions={results} />
            
            <div className="mt-12 text-center">
              <button 
                onClick={resetSelection}
                className="inline-flex items-center gap-3 border-sketchy bg-card-bg px-8 py-4 text-xl font-black shadow-hand hover:shadow-hand-hover hover:-translate-y-1 transition-all text-foreground"
              >
                <Upload size={24} strokeWidth={3} className="text-accent" />
                START A NEW SKETCH
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
