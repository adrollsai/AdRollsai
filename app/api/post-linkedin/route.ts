import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { postToLinkedIn } from '@/utils/social-api'

export async function POST(request: Request) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { imageUrl, caption } = body

  const { data: profile } = await supabase
    .from('profiles')
    .select('linkedin_token')
    .eq('id', user.id)
    .single()

  if (!profile?.linkedin_token) {
    return NextResponse.json({ error: 'No LinkedIn account linked.' }, { status: 400 })
  }

  try {
    const result = await postToLinkedIn(profile.linkedin_token, imageUrl, caption)
    return NextResponse.json({ success: true, data: result })

  } catch (error: any) {
    console.error(error)
    return NextResponse.json({ error: error.message || 'Posting failed' }, { status: 500 })
  }
}