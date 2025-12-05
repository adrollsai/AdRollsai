import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { postToFacebook } from '@/utils/social-api' // Import the utility

export async function POST(request: Request) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { imageUrl, caption } = body

  // Get Page Token
  const { data: profile } = await supabase
    .from('profiles')
    .select('selected_page_token')
    .eq('id', user.id)
    .single()

  if (!profile?.selected_page_token) {
    return NextResponse.json({ error: 'No Facebook Page selected.' }, { status: 400 })
  }

  try {
    // Call our internal utility instead of n8n
    const result = await postToFacebook(profile.selected_page_token, imageUrl, caption)
    return NextResponse.json({ success: true, data: result })

  } catch (error: any) {
    console.error(error)
    return NextResponse.json({ error: error.message || 'Posting failed' }, { status: 500 })
  }
}