'use client'

import { useState, useEffect } from 'react'
import { MessageCircle, Loader2 } from 'lucide-react'

// --- Type Declarations ---
declare global {
  interface Window {
    FB: {
      init: (params: { appId: string | undefined; cookie: boolean; xfbml: boolean; version: string }) => void;
      login: (callback: (response: any) => void, params: { scope: string; extras: any }) => void;
    };
    fbAsyncInit: () => void;
  }
}
// --- Component ---

export default function WhatsAppConnect({ onConnected }: { onConnected: () => void }) {
  const [loading, setLoading] = useState(false)
  const [sdkLoaded, setSdkLoaded] = useState(false)

  // 1. Load SDK on Mount
  useEffect(() => {
    if (window.FB) {
      setSdkLoaded(true)
      return
    }

    window.fbAsyncInit = function() {
      // Ensure NEXT_PUBLIC_META_APP_ID is available here
      window.FB.init({
        appId: process.env.NEXT_PUBLIC_META_APP_ID,
        cookie: true,
        xfbml: true,
        version: 'v19.0'
      });
      setSdkLoaded(true)
    };

    // Load the SDK script
    const loadScript = (d: Document, s: string, id: string) => {
      const fjs = d.getElementsByTagName(s)[0];
      if (d.getElementById(id)) { return; }
      const js = d.createElement(s) as HTMLScriptElement;
      js.id = id;
      js.src = "https://connect.facebook.net/en_US/sdk.js";
      // @ts-ignore
      fjs.parentNode.insertBefore(js, fjs);
    };

    loadScript(document, 'script', 'facebook-jssdk');
  }, [])

  // Function to save credentials on successful signup
  const saveCredentials = async (accessToken: string, fbUserId: string) => {
    try {
      const res = await fetch('/api/whatsapp/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken, fbUserId })
      })

      const data = await res.json()

      if (!res.ok) throw new Error(data.error || "Failed to connect")
      
      alert("✅ WhatsApp Connected Successfully!")
      onConnected() 
    } catch (error: any) {
      console.error("Backend Save Error:", error)
      alert("Connection Failed: " + error.message)
    } finally {
      setLoading(false)
    }
  }

  const launchWhatsAppSignup = () => {
    if (!sdkLoaded || !window.FB) {
      alert("Facebook SDK not loaded yet. Please wait or refresh.")
      return
    }
    
    setLoading(true)

    // 2. Launch Popup
    window.FB.login((response: any) => {
      if (response.authResponse) {
        console.log('Facebook Login Success, calling backend save...');
        const { accessToken, userID } = response.authResponse
        // Call the async function here, which handles final loading state
        saveCredentials(accessToken, userID) 
      } else {
        console.log('User cancelled login or did not fully authorize.')
        setLoading(false) // Must reset loading state if user cancels
      }
    }, {
      // 3. Permissions required for WhatsApp
      scope: 'whatsapp_business_management, whatsapp_business_messaging', 
      // 4. Embedded Signup Configuration
      extras: {
        feature: 'whatsapp_embedded_signup',
        version: 2,
        session_info_version: 2, 
      }
    })
  }

  return (
    <button 
      onClick={launchWhatsAppSignup} // Direct call (no need for an arrow function wrapper)
      disabled={loading || !sdkLoaded}
      className="bg-[#25D366] hover:bg-[#20bd5a] text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 shadow-sm transition-all active:scale-95 disabled:opacity-70 disabled:grayscale"
    >
      {loading ? <Loader2 className="animate-spin" size={20} /> : <MessageCircle size={20} />}
      {loading ? "Connecting..." : (sdkLoaded ? "Connect WhatsApp" : "Loading SDK...")}
    </button>
  )
}