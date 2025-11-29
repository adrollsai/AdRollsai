import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'
  
  // 1. Check for specific Supabase errors before even trying to exchange code
  const errorDescription = searchParams.get('error_description')
  const errorCode = searchParams.get('error_code')

  if (errorCode) {
    // Redirect back to the profile page with the error details so the frontend can show a toast
    return NextResponse.redirect(`${origin}${next}?error=${encodeURIComponent(errorDescription || 'Unknown Error')}`)
  }

  if (code) {
    const supabase = await createClient()
    const { error, data } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error && data?.session) {
      // 🟢 CAPTURE TOKEN: Only if it's a Facebook token (starts with EAA)
      const token = data.session.provider_token
      const userId = data.session.user.id

      if (token && token.startsWith('EAA')) {
        console.log("✅ Captured Fresh Facebook Token. Saving...")
        await supabase
          .from('profiles')
          .update({ facebook_token: token })
          .eq('id', userId)
      }
      
      // Handle environment redirects (Localhost vs Production)
      const forwardedHost = request.headers.get('x-forwarded-host') 
      const isLocalEnv = origin.includes('localhost')
      
      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${next}`)
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`)
      } else {
        return NextResponse.redirect(`${origin}${next}`)
      }
    }
  }

  // Fallback if code exchange failed silently
  return NextResponse.redirect(`${origin}${next}?error=Authentication failed`)
}