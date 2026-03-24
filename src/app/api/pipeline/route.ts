import { NextResponse } from 'next/server'

const API_BASE_URL = 'https://api.almostcrackd.ai'

type Step = 'generate-url' | 'register' | 'generate-captions'

const STEP_CANDIDATE_PATHS: Record<Step, string[]> = {
  'generate-url': ['/pipeline/generate-url', '/pipeline?step=generate-url', '/generate-url'],
  register: ['/pipeline/register', '/pipeline?step=register', '/register'],
  'generate-captions': ['/pipeline/generate-captions', '/pipeline?step=generate-captions', '/generate-captions'],
}

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url)
  const step = searchParams.get('step') as Step | null

  if (!step || !(step in STEP_CANDIDATE_PATHS)) {
    return NextResponse.json({ error: true, message: 'Invalid pipeline step.' }, { status: 400 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  try {
    const authorization = request.headers.get('authorization')
    let upstream: Response | null = null

    for (const path of STEP_CANDIDATE_PATHS[step]) {
      const res = await fetch(`${API_BASE_URL}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authorization ? { Authorization: authorization } : {}),
        },
        body: JSON.stringify(body),
        cache: 'no-store',
      })

      upstream = res
      if (res.status !== 405) break
    }

    if (!upstream) {
      return NextResponse.json(
        { error: true, message: 'No upstream response received.' },
        { status: 502 }
      )
    }

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
