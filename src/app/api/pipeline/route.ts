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

  const authorization = request.headers.get('authorization')
  const executionTrail: Array<{ stepId: number; order_by: number; output: string }> = []
  let stepInput = String(payload.imageId ?? payload.imageUrl ?? payload.image ?? '')

  if (!stepInput) {
    return NextResponse.json(
      { error: true, message: 'imageId or imageUrl is required to start the step pipeline.' },
      { status: 400 }
    )
  }

  for (const stepRow of steps) {
    const composedUserPrompt = `${stepRow.llm_user_prompt ?? ''}\n\nInput:\n${stepInput}`.trim()
    const stepPayload = {
      imageId: payload.imageId ?? null,
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

    await (supabase.from('llm_model_responses' as any) as any).insert([
      {
        humor_flavor_id: humorFlavorId,
        humor_flavor_step_id: stepRow.id,
        order_by: stepRow.order_by,
        llm_system_prompt: stepRow.llm_system_prompt,
        llm_user_prompt: composedUserPrompt,
        llm_model_id: stepRow.llm_model_id,
        llm_temperature: stepRow.llm_temperature,
        input_text: stepInput,
        output_text: stepOutput,
      },
    ])

    executionTrail.push({ stepId: stepRow.id, order_by: stepRow.order_by, output: stepOutput })
    stepInput = stepOutput
  }

  const finalOutput = executionTrail[executionTrail.length - 1]?.output ?? ''
  await (supabase.from('captions' as any) as any).insert([
    {
      humor_flavor_id: humorFlavorId,
      image_id: payload.imageId ?? null,
      image_url: payload.imageUrl ?? payload.image ?? null,
      text: finalOutput,
      raw_output: finalOutput,
    },
  ])

  return NextResponse.json({
    humor_flavor_id: humorFlavorId,
    steps_executed: executionTrail.length,
    step_outputs: executionTrail,
    captions: finalOutput,
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
