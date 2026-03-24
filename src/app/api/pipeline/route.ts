import { NextResponse } from 'next/server'

const API_BASE_URL = 'https://api.almostcrackd.ai'

type Step = 'generate-url' | 'register' | 'generate-captions'
type StepAttempt = {
  path: string
  method: 'POST' | 'GET'
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

  try {
    const authorization = request.headers.get('authorization')
    let upstream: Response | null = null
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

      upstream = res
      chosenAttempt = attempt
      if (res.status !== 405) break

      const resText = await res.text()
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

    const rawText = await upstream.text()
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
