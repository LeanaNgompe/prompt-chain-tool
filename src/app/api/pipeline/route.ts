import { NextResponse } from 'next/server'

const API_BASE_URL = 'https://api.almostcrackd.ai'

type Step = 'generate-url' | 'register' | 'generate-captions'

const STEP_PATHS: Record<Step, string> = {
  'generate-url': '/generate-url',
  register: '/register',
  'generate-captions': '/generate-captions',
}

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url)
  const step = searchParams.get('step') as Step | null

  if (!step || !(step in STEP_PATHS)) {
    return NextResponse.json({ error: true, message: 'Invalid pipeline step.' }, { status: 400 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  try {
    const upstream = await fetch(`${API_BASE_URL}${STEP_PATHS[step]}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    })

    const rawText = await upstream.text()
    let data: unknown = rawText

    try {
      data = rawText ? JSON.parse(rawText) : {}
    } catch {
      // Keep raw text response for easier debugging when upstream isn't JSON.
    }

    return NextResponse.json(data, { status: upstream.status })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown upstream error'
    return NextResponse.json(
      { error: true, message: 'Pipeline proxy request failed.', details: message },
      { status: 502 }
    )
  }
}
