'use client'

import { useState, useEffect } from 'react'
import { MessageCircle, UserPlus, CalendarClock, BellRing, LucideIcon, CheckCircle } from 'lucide-react'
import WhatsAppConnect from '@/components/WhatsAppConnect' // Import our new component
import { authClient } from '@/lib/auth-client' // Use Better-Auth

const iconMap: Record<string, LucideIcon> = {
  'UserPlus': UserPlus,
  'CalendarClock': CalendarClock,
  'BellRing': BellRing,
  'MessageCircle': MessageCircle
}

export default function AutomationPage() {
  const { data: session } = authClient.useSession()
  
  // State
  const [isConnected, setIsConnected] = useState(false)
  const [phoneNumberId, setPhoneNumberId] = useState('')
  const [loading, setLoading] = useState(true)

  // Load Status
  const fetchStatus = async () => {
    try {
        const res = await fetch('/api/profile') // Reusing profile API which returns user data
        if (res.ok) {
            const data = await res.json()
            if (data.whatsappPhoneId) {
                setIsConnected(true)
                setPhoneNumberId(data.whatsappPhoneId)
            } else {
                setIsConnected(false)
            }
        }
    } catch(e) { console.error(e) } 
    finally { setLoading(false) }
  }

  useEffect(() => {
    if (session) fetchStatus()
  }, [session])

  if (loading) return <div className="p-10 text-center text-slate-400 text-sm">Loading agents...</div>

  // 1. IF NOT CONNECTED: Show the Setup Button
  if (!isConnected) {
      return (
          <div className="p-8 max-w-md mx-auto min-h-screen flex flex-col items-center justify-center text-center">
              <div className="bg-green-100 p-4 rounded-full mb-6">
                  <MessageCircle size={48} className="text-[#25D366]" />
              </div>
              <h1 className="text-2xl font-bold text-slate-900 mb-2">Connect WhatsApp</h1>
              <p className="text-slate-500 mb-8 max-w-xs">
                  Automate replies and lead follow-ups. You will need a phone number ready to verify.
              </p>
              
              {/* The Magic Button */}
              <WhatsAppConnect onConnected={fetchStatus} />
          </div>
      )
  }

  // 2. IF CONNECTED: Show the Automation Dashboard
  return (
    <div className="p-5 max-w-md mx-auto min-h-screen">
      
      {/* Header */}
      <div className="mb-6 flex justify-between items-center">
        <div>
            <h1 className="text-2xl font-bold text-slate-900">Automation</h1>
            <p className="text-slate-500 text-xs mt-1">Status: Active ({phoneNumberId})</p>
        </div>
        <CheckCircle className="text-green-500" />
      </div>

      <div className="bg-blue-50 p-4 rounded-2xl mb-6 text-sm text-blue-700">
          ✨ Your AI Agent is listening for new messages on this number.
      </div>

      {/* Placeholder for future automations list */}
      <div className="space-y-3 opacity-50 pointer-events-none">
        <div className="p-4 rounded-2xl bg-white border border-slate-100 shadow-sm flex items-center gap-3">
            <UserPlus size={20} className="text-slate-400"/>
            <span className="font-bold text-slate-700">New Lead Welcome</span>
        </div>
        <div className="p-4 rounded-2xl bg-white border border-slate-100 shadow-sm flex items-center gap-3">
            <CalendarClock size={20} className="text-slate-400"/>
            <span className="font-bold text-slate-700">Appointment Scheduler</span>
        </div>
      </div>

    </div>
  )
}