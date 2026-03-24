import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

async function requireMatrixOrAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData.user) {
    return { ok: false as const, status: 401, message: 'Not authenticated.' }
  }

  const userId = userData.user.id
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('is_superadmin, is_matrix_admin')
    .eq('id', userId)
    .single()

  if (profileError) {
    return { ok: false as const, status: 403, message: 'Missing or invalid profile.' }
  }

  const profileSafe = profile as unknown as { is_superadmin?: boolean | null; is_matrix_admin?: boolean | null } | null
  const isAdmin = Boolean(profileSafe?.is_superadmin) || Boolean(profileSafe?.is_matrix_admin)
  if (!isAdmin) {
    return { ok: false as const, status: 403, message: 'Not authorized.' }
  }

  return { ok: true as const, userId }
}

async function insertImageRow(supabase: unknown, imageUrl: string) {
  // Try common column names; we don't have typed schema for `images` in this repo.
  const tries: Array<Record<string, unknown>> = [{ image_url: imageUrl }, { url: imageUrl }]

  const supabaseUntyped = supabase as unknown as {
    from: (table: string) => {
      insert: (values: Record<string, unknown>) => {
        select: () => { single: () => Promise<{ data: unknown; error: { message: string } | null }> }
      }
    }
  }

  for (const payload of tries) {
    const { data, error } = await supabaseUntyped.from('images').insert(payload).select().single()
    if (!error && data) return data as Record<string, unknown>
  }

  // Final attempt: let the caller see the DB error.
  const { error } = await supabaseUntyped.from('images').insert({ image_url: imageUrl }).select().single()
  throw error ?? new Error('Failed to insert image row.')
}

export async function POST(request: Request) {
  const supabase = await createClient()

  const auth = await requireMatrixOrAdmin(supabase)
  if (!auth.ok) {
    return NextResponse.json({ error: true, message: auth.message }, { status: auth.status })
  }

  const formData = await request.formData()
  const imageFile = formData.get('image')
  if (!imageFile || !(imageFile instanceof File)) {
    return NextResponse.json({ error: true, message: 'Missing image file (field: image).' }, { status: 400 })
  }

  if (!imageFile.type.startsWith('image/')) {
    return NextResponse.json({ error: true, message: 'Invalid file type. Expected an image.' }, { status: 400 })
  }

  const bucket = 'images'
  const ext = imageFile.name.includes('.') ? imageFile.name.split('.').pop() : undefined
  const extSafe = ext ? ext.toLowerCase() : 'jpg'
  const objectPath = `${auth.userId}/${crypto.randomUUID()}.${extSafe}`

  const uploadRes = await supabase.storage.from(bucket).upload(objectPath, imageFile, {
    contentType: imageFile.type || 'image/jpeg',
    upsert: false,
  })

  if (uploadRes.error) {
    return NextResponse.json(
      { error: true, message: 'Failed to upload image to storage.', details: uploadRes.error.message },
      { status: 500 }
    )
  }

  const publicUrl = supabase.storage.from(bucket).getPublicUrl(objectPath).data.publicUrl
  if (!publicUrl) {
    return NextResponse.json(
      { error: true, message: 'Storage upload succeeded but public URL is missing.' },
      { status: 500 }
    )
  }

  const imageRow = await insertImageRow(supabase, publicUrl)
  const imageId = imageRow.id ?? imageRow.image_id ?? imageRow.imageId

  if (!imageId) {
    return NextResponse.json({ error: true, message: 'Image row inserted but image id not found.' }, { status: 500 })
  }

  return NextResponse.json(
    {
      imageId: String(imageId),
      imageUrl: imageRow.image_url ?? imageRow.url ?? publicUrl,
      thumbnailUrl: imageRow.thumbnail_url ?? imageRow.thumbnailUrl ?? publicUrl,
    },
    { status: 200 }
  )
}

