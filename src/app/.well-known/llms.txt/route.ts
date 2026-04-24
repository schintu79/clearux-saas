import { NextResponse } from 'next/server'
import { readFileSync } from 'fs'
import { join } from 'path'

export async function GET() {
  try {
    const content = readFileSync(join(process.cwd(), 'public', 'llms.txt'), 'utf-8')
    return new NextResponse(content, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  } catch {
    return new NextResponse('Not found', { status: 404 })
  }
}
