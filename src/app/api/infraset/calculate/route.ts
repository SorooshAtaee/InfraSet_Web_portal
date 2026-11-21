import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'node:child_process'
import path from 'node:path'

const ENGINE_PATH = path.join(process.cwd(), 'engine', 'infraset_engine.py')

export const maxDuration = 120

function runEngine(mode: 'match' | 'calc', payload: unknown): Promise<string> {
  return new Promise((resolve, reject) => {
    const py = spawn('python3', [ENGINE_PATH, mode], {
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    const timer = setTimeout(() => {
      py.kill('SIGKILL')
      reject(new Error('Engine timed out'))
    }, 110_000)

    py.stdout.on('data', (d) => { stdout += d.toString() })
    py.stderr.on('data', (d) => { stderr += d.toString() })
    py.on('error', (e) => {
      clearTimeout(timer)
      reject(new Error(`Failed to start Python engine: ${e.message}`))
    })
    py.on('close', (code) => {
      clearTimeout(timer)
      if (code === 0 && stdout.trim()) resolve(stdout)
      else reject(new Error(stderr.trim() || `Engine exited with code ${code}`))
    })
    py.stdin.write(JSON.stringify(payload))
    py.stdin.end()
  })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const out = await runEngine('calc', body)
    return new NextResponse(out, {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
