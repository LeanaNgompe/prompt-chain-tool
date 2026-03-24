'use client'

import { createClient } from '@/utils/supabase/client'
import { useEffect, useState } from 'react'
import { Database } from '@/types/database.types'
import { FlaskConical, Loader2 } from 'lucide-react'

type HumorFlavor = Database['public']['Tables']['humor_flavors']['Row']

export default function TestToolPage() {
  const [flavors, setFlavors] = useState<HumorFlavor[]>([])
  const [selectedFlavorId, setSelectedFlavorId] = useState<string>('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<unknown>(null)
  const [error, setError] = useState<string | null>(null)

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
      const parsed = JSON.parse(bodyText) as { message?: string; statusMessage?: string; details?: string }
      const details = parsed.message || parsed.statusMessage || parsed.details
      return details ? `${fallback}: ${details}` : `${fallback} (${response.status})`
    } catch {
      return `${fallback}: ${bodyText}`
    }
  }

  const getUploadErrorMessage = async (response: Response, fallback: string) => {
    const bodyText = await response.text()
    if (!bodyText) return `${fallback} (${response.status})`
    return `${fallback}: ${bodyText.slice(0, 400)}`
  }

  const uploadImageAndGenerate = async (file: File, flavorId: string) => {
    const authHeaders = await getAuthHeaders()

    const presignRes = await fetch('/api/pipeline?step=generate-url', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ contentType: file.type }),
    })

    if (!presignRes.ok) {
      throw new Error(await getErrorMessage(presignRes, 'Failed to generate upload URL'))
    }

    const presignData = await presignRes.json()
    const uploadUrl = presignData.uploadUrl || presignData.url
    const cdnUrl = presignData.cdnUrl || presignData.publicUrl

    if (!uploadUrl) {
      throw new Error('Upload URL missing from response')
    }

    const s3UploadRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': file.type,
      },
      body: file,
    })

    if (!s3UploadRes.ok) {
      throw new Error(await getUploadErrorMessage(s3UploadRes, 'Image upload failed'))
    }

    const registerRes = await fetch('/api/pipeline?step=register', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        imageUrl: cdnUrl || uploadUrl.split('?')[0],
        isCommonUse: false,
      }),
    })

    if (!registerRes.ok) {
      throw new Error(await getErrorMessage(registerRes, 'Failed to register image'))
    }

    const registerData = await registerRes.json()
    const imageId = registerData.imageId || registerData.id || registerData.image?.id
    if (!imageId) {
      throw new Error('Image ID missing from registration response')
    }

    const captionRes = await fetch('/api/pipeline?step=generate-captions', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ imageId, flavorId }),
    })

    if (!captionRes.ok) {
      throw new Error(await getErrorMessage(captionRes, 'Caption generation failed'))
    }

    return captionRes.json()
  }

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setResults(null)
    setError(null)

    try {
      if (!selectedFile) {
        throw new Error('Please select an image file')
      }

      const data = await uploadImageAndGenerate(selectedFile, selectedFlavorId)
      setResults(data)
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
            <label htmlFor="imageFile" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Image File
            </label>
            <input
              type="file"
              id="imageFile"
              accept="image/*"
              required
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !selectedFile || !selectedFlavorId}
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
            <h2 className="text-xl font-medium text-gray-900 dark:text-white">Generated Results</h2>
            <div className="rounded-lg bg-gray-50 dark:bg-gray-900 p-6 border border-gray-200 dark:border-gray-700">
              <pre className="text-sm text-gray-700 dark:text-gray-300 overflow-auto whitespace-pre-wrap">
                {JSON.stringify(results, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
