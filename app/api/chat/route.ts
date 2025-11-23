import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function POST(request: Request) {
  // 1. Check if user is logged in
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Get the message from the frontend
  const body = await request.json()
  const { message, mode } = body

  // 3. Send to n8n
  try {
    const n8nResponse = await fetch(process.env.N8N_WEBHOOK_URL!, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: user.id,      // We send the ID so n8n can look up the Business Info later
        userEmail: user.email,
        prompt: message,
        mode: mode            // 'image' or 'video'
      }),
    })

    if (!n8nResponse.ok) {
      throw new Error(`n8n error: ${n8nResponse.statusText}`)
    }

    const data = await n8nResponse.json()
    return NextResponse.json(data)

  } catch (error) {
    console.error('Error talking to n8n:', error)
    return NextResponse.json(
      { text: "I'm having trouble reaching the AI brain right now. Please try again." }, 
      { status: 500 }
    )
  }
}