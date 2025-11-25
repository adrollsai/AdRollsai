import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET(request: Request) {
  const supabase = await createClient()
  
  // 1. Validate User
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 2. Get Facebook Token from DB
  const { data: profile } = await supabase
    .from('profiles')
    .select('facebook_token')
    .eq('id', user.id)
    .single()

  if (!profile?.facebook_token) {
    console.log("API Error: No token found in database")
    return NextResponse.json({ error: 'No Facebook token found' }, { status: 400 })
  }

  const token = profile.facebook_token

  try {
    console.log("================ DEBUG FACEBOOK CONNECTION ================")
    
    // STEP A: CHECK IDENTITY (Who is logged in?)
    const meRes = await fetch(`https://graph.facebook.com/v19.0/me?access_token=${token}`)
    const meData = await meRes.json()
    
    if (meData.error) throw new Error("Identity Check Failed: " + meData.error.message)
    
    console.log(`CONNECTED USER: ${meData.name} (ID: ${meData.id})`)

    // STEP B: CHECK PERMISSIONS (Do we have business_management?)
    const permRes = await fetch(`https://graph.facebook.com/v19.0/me/permissions?access_token=${token}`)
    const permData = await permRes.json()
    
    // Log permissions nicely
    const permissions = permData.data?.map((p: any) => `${p.permission} (${p.status})`).join(', ')
    console.log("GRANTED PERMISSIONS:", permissions)

    // STEP C: FETCH PAGES (Request limit=100 to ensure we see everything)
    const pagesRes = await fetch(`https://graph.facebook.com/v19.0/me/accounts?limit=100&access_token=${token}`)
    const pagesData = await pagesRes.json()

    if (pagesData.error) throw new Error("Pages Fetch Failed: " + pagesData.error.message)

    console.log(`PAGES FOUND: ${pagesData.data?.length || 0}`)
    
    // Log names of pages found to verify if "Ad Rolls" is hidden or just missing
    const pageNames = pagesData.data?.map((p: any) => p.name).join(', ')
    console.log("PAGE LIST:", pageNames)
    
    console.log("===========================================================")

    return NextResponse.json({ pages: pagesData.data })

  } catch (error: any) {
    console.error("API CRASH:", error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}