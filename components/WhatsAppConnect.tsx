'use client'

import { useState } from 'react'
import { MessageCircle, Loader2 } from 'lucide-react'

// Add types for the global FB object
declare global {
  interface Window {
    FB: any;
    fbAsyncInit: () => void;
  }
}

export default function WhatsAppConnect({ onConnected }: { onConnected: () => void }) {
  const [loading, setLoading] = useState(false)

  const launchWhatsAppSignup = () => {
    setLoading(true)

    // 1. Load Facebook SDK if not already loaded
    if (!window.FB) {
      console.log('Loading Facebook SDK...')
      const script = document.createElement('script')
      script.src = "https://connect.facebook.net/en_US/sdk.js"
      script.async = true
      script.defer = true
      script.crossOrigin = "anonymous"
      
      script.onload = () => initFacebook()
      document.body.appendChild(script)
    } else {
      initFacebook()
    }
  }

  const initFacebook = () => {
    if (!process.env.NEXT_PUBLIC_META_APP_ID) {
        alert("Missing Meta App ID in .env.local")
        setLoading(false)
        return
    }

    // Initialize if not already done
    if (!window.FB.getKey) { // Simple check to see if init ran
        window.FB.init({
        appId: process.env.NEXT_PUBLIC_META_APP_ID,
        autoLogAppEvents: true,
        xfbml: true,
        version: 'v19.0'
        })
    }

    // 2. Launch the Embedded Signup Popup
    window.FB.login(async (response: any) => {
      if (response.authResponse) {
        console.log('Facebook Login Success:', response)
        const { accessToken, userID } = response.authResponse
        
        // 3. Send Token to our Backend to save credentials
        await saveCredentials(accessToken, userID)
      } else {
        console.log('User cancelled login or did not fully authorize.')
        setLoading(false)
      }
    }, {
      // CRITICAL: These scopes allow you to manage their WhatsApp Business Account
      scope: 'whatsapp_business_management, whatsapp_business_messaging', 
      extras: {
        feature: 'whatsapp_embedded_signup',
        version: 2
      }
    })
  }

  const saveCredentials = async (accessToken: string, fbUserId: string) => {
    try {
      const res = await fetch('/api/whatsapp/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken, fbUserId })
      })

      if (!res.ok) throw new Error("Failed to save WhatsApp credentials")
      
      alert("WhatsApp Connected Successfully!")
      onConnected() // Refresh the parent page
    } catch (error) {
      console.error(error)
      alert("Connection failed. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <button 
      onClick={launchWhatsAppSignup}
      disabled={loading}
      className="bg-[#25D366] hover:bg-[#20bd5a] text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 shadow-sm transition-all active:scale-95 disabled:opacity-70"
    >
      {loading ? <Loader2 className="animate-spin" size={20} /> : <MessageCircle size={20} />}
      Connect WhatsApp
    </button>
  )
}