import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

const API_BASE_URL = 'https://api.almostcrackd.ai'

type Step = 'generate-url' | 'register' | 'generate-captions'
type StepAttempt = {
  path: string
  method: 'POST' | 'GET'
}
type FlavorStep = {
  id: number
  humor_flavor_id: number
  order_by: number
  llm_system_prompt: string | null
  llm_user_prompt: string | null
  llm_model_id: number | null
  llm_temperature: number | null
}

const STEP_ATTEMPTS: Record<Step, StepAttempt[]> = {
  'generate-url': [
    { path: '/pipeline/generate-url', method: 'POST' },
    { path: '/pipeline?step=generate-url', method: 'POST' },
    { path: '/generate-url', method: 'POST' },
    { path: '/pipeline/generate-url', method: 'GET' },
    { path: '/pipeline?step=generate-url', method: 'GET' },
    { path: '/generate-url', method: 'GET' },
  ],
  register: [
    { path: '/pipeline/register', method: 'POST' },
    { path: '/pipeline?step=register', method: 'POST' },
    { path: '/register', method: 'POST' },
  ],
  'generate-captions': [
    { path: '/pipeline/generate-captions', method: 'POST' },
    { path: '/pipeline?step=generate-captions', method: 'POST' },
    { path: '/generate-captions', method: 'POST' },
  ],
}

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url)
  const step = searchParams.get('step') as Step | null

  if (!step || !(step in STEP_ATTEMPTS)) {
    return NextResponse.json({ error: true, message: 'Invalid pipeline step.' }, { status: 400 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  if (step === 'generate-captions') {
    return handleGenerateCaptions(body, request)
  }

  try {
    const authorization = request.headers.get('authorization')
    let upstream: Response | null = null
    let upstreamRawText = ''
    let chosenAttempt: StepAttempt | null = null
    const failedAttempts: Array<{ method: string; path: string; status: number; message: string }> = []

    for (const attempt of STEP_ATTEMPTS[step]) {
      const targetUrl =
        attempt.method === 'GET' && step === 'generate-url'
          ? `${API_BASE_URL}${attempt.path}${attempt.path.includes('?') ? '&' : '?'}contentType=image%2Fjpeg`
          : `${API_BASE_URL}${attempt.path}`

      const res = await fetch(targetUrl, {
        method: attempt.method,
        headers: {
          'Content-Type': 'application/json',
          ...(authorization ? { Authorization: authorization } : {}),
        },
        ...(attempt.method === 'POST' ? { body: JSON.stringify(body) } : {}),
        cache: 'no-store',
      })

      const resText = await res.text()
      upstream = res
      upstreamRawText = resText
      chosenAttempt = attempt
      if (res.status !== 405) break

      failedAttempts.push({
        method: attempt.method,
        path: attempt.path,
        status: res.status,
        message: resText.slice(0, 180),
      })
    }

    if (!upstream) {
      return NextResponse.json(
        { error: true, message: 'No upstream response received.' },
        { status: 502 }
      )
    }

    const rawText = upstreamRawText
    let data: unknown = rawText

    try {
      data = rawText ? JSON.parse(rawText) : {}
    } catch {
      // Keep raw text response for easier debugging when upstream isn't JSON.
    }

    if (upstream.status === 405) {
      return NextResponse.json(
        {
          error: true,
          message: 'All upstream candidates returned 405.',
          attempted: failedAttempts,
        },
        { status: 405 }
      )
    }

    return NextResponse.json(
      {
        ...(typeof data === 'object' && data !== null ? data : { data }),
        _debug: chosenAttempt ? { upstreamPath: chosenAttempt.path, upstreamMethod: chosenAttempt.method } : undefined,
      },
      { status: upstream.status }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown upstream error'
    return NextResponse.json(
      { error: true, message: 'Pipeline proxy request failed.', details: message },
      { status: 502 }
    )
  }
}

async function handleGenerateCaptions(body: unknown, request: Request) {
  const payload = (body ?? {}) as Record<string, unknown>
  const humorFlavorIdValue = payload.humor_flavor_id ?? payload.flavorId ?? payload.flavor_id
  const humorFlavorId = Number(humorFlavorIdValue)

  if (!Number.isFinite(humorFlavorId)) {
    return NextResponse.json(
      { error: true, message: 'humor_flavor_id is required for step-based caption generation.' },
      { status: 400 }
    )
  }

  const supabase = await createClient()
  const { data: stepsData, error: stepsError } = await supabase
    .from('humor_flavor_steps')
    .select('id, humor_flavor_id, order_by, llm_system_prompt, llm_user_prompt, llm_model_id, llm_temperature')
    .eq('humor_flavor_id', humorFlavorId)
    .order('order_by', { ascending: true })

  if (stepsError) {
    return NextResponse.json(
      { error: true, message: 'Failed to fetch humor_flavor_steps.', details: stepsError.message },
      { status: 500 }
    )
  }

  const steps = (stepsData ?? []) as FlavorStep[]
  if (steps.length === 0) {
    return NextResponse.json(
      { error: true, message: 'No steps found for this humor flavor. Caption generation is blocked.' },
      { status: 422 }
    )
  }

  // Untyped DB access for tables not present in `src/types/database.types.ts`.
  const dbUntyped = supabase as unknown as {
    from: (table: string) => {
      insert: (values: unknown[]) => Promise<{ error: { message?: string } | null }>
    }
  }

  const authorization = request.headers.get('authorization')
  const executionTrail: Array<{ stepId: number; order_by: number; output: string }> = []
  // Previous step output that we pipe into the next step.
  // For step 1 there is no previous textual output, so we keep it empty.
  let stepInput = ''

  const imageIdValue = payload.imageId ?? payload.image_id ?? payload.imageId
  const imageId = imageIdValue ? String(imageIdValue) : ''

  if (!imageId) {
    return NextResponse.json(
      { error: true, message: 'imageId is required to start the step pipeline.' },
      { status: 400 }
    )
  }

  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(imageId)) {
    return NextResponse.json({ error: true, message: 'imageId must be a valid UUID.' }, { status: 400 })
  }

  const { data: userData } = await supabase.auth.getUser()
  const profileId = userData.user?.id

  if (!profileId) {
    return NextResponse.json({ error: true, message: 'Not authenticated.' }, { status: 401 })
  }

  let captionRequestId = Number(payload.caption_request_id ?? payload.requestId ?? 0)

  if (captionRequestId <= 0) {
    const { data: latestRequest } = await supabase
      .from('caption_requests')
      .select('id')
      .eq('image_id', imageId)
      .eq('profile_id', profileId)
      .order('created_datetime_utc', { ascending: false })
      .limit(1)
      .single()

    if (latestRequest) {
      captionRequestId = Number(latestRequest.id)
    } else {
      // Create one if none exists (for manual tool testing).
      const { data: newReq, error: newReqError } = await (supabase as any)
        .from('caption_requests')
        .insert([{ image_id: imageId, profile_id: profileId }])
        .select('id')
        .single()
      
      if (newReqError) {
        return NextResponse.json(
          { error: true, message: 'Failed to find or create caption_request.', details: newReqError.message },
          { status: 500 }
        )
      }
      captionRequestId = Number(newReq.id)
    }
  }

  for (const [idx, stepRow] of steps.entries()) {
    const composedUserPrompt =
      idx === 0
        ? String(stepRow.llm_user_prompt ?? '')
        : `${stepRow.llm_user_prompt ?? ''}\n\nInput:\n${stepInput}`.trim()
    const stepPayload = {
      imageId,
      imageUrl: payload.imageUrl ?? payload.image ?? null,
      humor_flavor_id: humorFlavorId,
      step_id: stepRow.id,
      step_order: stepRow.order_by,
      llm_system_prompt: stepRow.llm_system_prompt,
      llm_user_prompt: composedUserPrompt,
      llm_model_id: stepRow.llm_model_id,
      llm_temperature: stepRow.llm_temperature,
      input: stepInput,
    }

    const startTime = Date.now()
    const stepRes = await fetch(`${API_BASE_URL}/pipeline/generate-captions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authorization ? { Authorization: authorization } : {}),
      },
      body: JSON.stringify(stepPayload),
      cache: 'no-store',
    })

    const stepText = await stepRes.text()
    const durationSeconds = Math.max(1, Math.round((Date.now() - startTime) / 1000))

    if (!stepRes.ok) {
      return NextResponse.json(
        {
          error: true,
          message: `Step ${stepRow.order_by} failed.`,
          details: stepText || `Upstream status ${stepRes.status}`,
        },
        { status: stepRes.status }
      )
    }

    let parsed: unknown = stepText
    try {
      parsed = stepText ? JSON.parse(stepText) : {}
    } catch {
      // Keep non-JSON text as output fallback.
    }

    const stepOutput =
      extractOutputText(parsed) ||
      (typeof parsed === 'string' ? parsed : stepText) ||
      `Step ${stepRow.order_by} returned empty output.`

    const { error: insertStepError } = await dbUntyped.from('llm_model_responses').insert([
      {
        humor_flavor_id: humorFlavorId,
        humor_flavor_step_id: stepRow.id,
        llm_system_prompt: stepRow.llm_system_prompt,
        llm_user_prompt: composedUserPrompt,
        llm_model_id: stepRow.llm_model_id ?? 1,
        llm_temperature: stepRow.llm_temperature,
        llm_model_response: stepOutput,
        processing_time_seconds: durationSeconds,
        profile_id: profileId,
        caption_request_id: captionRequestId,
      },
    ])

    if (insertStepError) {
      return NextResponse.json(
        { error: true, message: 'Failed to store step output.', details: insertStepError.message },
        { status: 500 }
      )
    }

    executionTrail.push({ stepId: stepRow.id, order_by: stepRow.order_by, output: stepOutput })
    stepInput = stepOutput
  }

  const finalOutput = executionTrail[executionTrail.length - 1]?.output ?? ''
  const { error: insertCaptionError } = await dbUntyped.from('captions').insert([
    {
      humor_flavor_id: humorFlavorId,
      image_id: imageId,
      content: finalOutput,
      profile_id: profileId,
      caption_request_id: captionRequestId,
      is_public: true,
    },
  ])

  if (insertCaptionError) {
    return NextResponse.json(
      { error: true, message: 'Failed to store caption output.', details: insertCaptionError.message },
      { status: 500 }
    )
  }

  const captionsList = splitCaptions(finalOutput)

  return NextResponse.json({
    humor_flavor_id: humorFlavorId,
    steps_executed: executionTrail.length,
    step_outputs: executionTrail,
    captions: captionsList,
    captions_text: finalOutput,
  })
}

function extractOutputText(parsed: unknown): string {
  if (!parsed || typeof parsed !== 'object') return ''

  const candidate = parsed as {
    output?: unknown
    text?: unknown
    caption?: unknown
    captions?: unknown
    data?: { output?: unknown; text?: unknown; caption?: unknown; captions?: unknown }
  }
  const direct = candidate.output ?? candidate.text ?? candidate.caption ?? candidate.captions
  if (typeof direct === 'string') return direct
  if (Array.isArray(direct)) return direct.join('\n')

  const nested = candidate.data?.output ?? candidate.data?.text ?? candidate.data?.caption ?? candidate.data?.captions
  if (typeof nested === 'string') return nested
  if (Array.isArray(nested)) return nested.join('\n')

  return ''
}

function splitCaptions(text: string): string[] {
  const normalizeLine = (line: string) =>
    line
      .replace(/^\s*(?:\d+[\).\-\:]\s*|[-*•]\s*)/, '')
      .replace(/^["']|["']$/g, '')
      .trim()

  return text
    .split('\n')
    .map((l) => normalizeLine(l))
    .filter((l) => l.length > 0)
}
