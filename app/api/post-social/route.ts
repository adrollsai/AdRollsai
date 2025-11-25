import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  
  // 1. Get Current User
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { imageUrl, caption } = body

  // 2. GET THE SPECIFIC PAGE TOKEN FROM DB
  // We look for 'selected_page_token' which matches the page the user clicked in the UI
  const { data: profile } = await supabase
    .from('profiles')
    .select('selected_page_token, selected_page_name')
    .eq('id', user.id)
    .single()

  if (!profile?.selected_page_token) {
    return NextResponse.json({ 
      error: 'No Facebook Page selected. Please go to Profile -> Social Accounts and select a page.' 
    }, { status: 400 })
  }

  // 3. Send to n8n
  try {
    // We send the Page Token as 'accessToken', so n8n can use it directly
    const n8nResponse = await fetch(process.env.N8N_SOCIAL_WEBHOOK_URL!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accessToken: profile.selected_page_token, // Using the Page Token
        imageUrl,
        caption
      }),
    })

    if (!n8nResponse.ok) {
      const text = await n8nResponse.text()
      throw new Error(`n8n error: ${text}`)
    }
    
    const result = await n8nResponse.json()
    return NextResponse.json(result)

  } catch (error: any) {
    console.error(error)
    return NextResponse.json({ error: error.message || 'Posting failed' }, { status: 500 })
  }
}