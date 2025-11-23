'use client'

import { useState } from 'react'
import { CreditCard, LogOut, ChevronRight, Save, Upload } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'

export default function ProfilePage() {
  const router = useRouter()
  const supabase = createClient()
  
  const [isSaving, setIsSaving] = useState(false)
  const [formData, setFormData] = useState({
    businessName: 'Luxury Estates',
    mission: 'Helping families find their dream home in California.',
    contact: '+1 (555) 123-4567',
    color: '#D0E8FF'
  })

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const handleSave = () => {
    setIsSaving(true)
    setTimeout(() => setIsSaving(false), 1000)
  }

  return (
    <div className="p-5 max-w-md mx-auto min-h-screen pb-32">
      
      {/* Header Profile Card Compact */}
      <div className="bg-white p-5 rounded-[2rem] shadow-sm border border-slate-100 mb-6 flex flex-col items-center text-center relative overflow-hidden">
        {/* Smaller Avatar: w-20 h-20 */}
        <div className="w-20 h-20 bg-slate-100 rounded-full mb-3 flex items-center justify-center text-3xl overflow-hidden relative group cursor-pointer">
          <span className="group-hover:opacity-0 transition-opacity">🏢</span>
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <Upload size={18} className="text-white" />
          </div>
        </div>
        <h2 className="text-xl font-bold text-slate-800">John Doe</h2>
        <p className="text-slate-400 text-xs">Real Estate Agent</p>
      </div>

      <div className="mb-6">
        <h3 className="ml-3 mb-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
          AI Knowledge Base
        </h3>
        
        <div className="bg-white p-5 rounded-[2rem] shadow-sm border border-blue-100">
          <div className="space-y-4">
            
            <div>
              <label className="text-[10px] font-bold text-slate-500 ml-2 block mb-1">Business Name</label>
              {/* Smaller Input: py-3 text-sm */}
              <input 
                type="text" 
                value={formData.businessName}
                onChange={(e) => setFormData({...formData, businessName: e.target.value})}
                className="w-full bg-slate-50 py-3 px-4 rounded-xl text-slate-800 text-sm font-medium focus:ring-2 focus:ring-primary outline-none"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-500 ml-2 block mb-1">Mission / Tagline</label>
              <textarea 
                rows={3}
                value={formData.mission}
                onChange={(e) => setFormData({...formData, mission: e.target.value})}
                className="w-full bg-slate-50 py-3 px-4 rounded-xl text-slate-800 text-sm resize-none focus:ring-2 focus:ring-primary outline-none"
              />
              <p className="text-[10px] text-blue-400 mt-1 ml-2">The AI uses this to match your tone.</p>
            </div>

            <div>
                 <label className="text-[10px] font-bold text-slate-500 ml-2 block mb-1">Brand Color</label>
                 <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl">
                   <div 
                     className="w-6 h-6 rounded-md shadow-sm border border-slate-200" 
                     style={{ backgroundColor: formData.color }} 
                   />
                   <input 
                      type="text" 
                      value={formData.color}
                      onChange={(e) => setFormData({...formData, color: e.target.value})}
                      className="bg-transparent font-mono text-xs w-full outline-none"
                   />
                 </div>
            </div>

            <button 
              onClick={handleSave}
              className="w-full bg-slate-900 text-white py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 active:scale-95 transition-transform"
            >
              {isSaving ? 'Saving...' : (
                <>
                  <Save size={16} />
                  Save Business Info
                </>
              )}
            </button>

          </div>
        </div>
      </div>

      <div>
        <h3 className="ml-3 mb-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
          Settings
        </h3>
        <div className="bg-white rounded-[2rem] shadow-sm overflow-hidden">
          
          <button className="w-full p-4 flex items-center justify-between hover:bg-slate-50 transition-colors border-b border-slate-50">
            <div className="flex items-center gap-3">
              <div className="bg-blue-50 p-2 rounded-full text-blue-600">
                <CreditCard size={18} />
              </div>
              <span className="font-bold text-sm text-slate-700">Subscription</span>
            </div>
            <ChevronRight size={18} className="text-slate-300" />
          </button>

          <button 
            onClick={handleSignOut}
            className="w-full p-4 flex items-center justify-between hover:bg-red-50 group transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="bg-red-50 p-2 rounded-full text-red-500 group-hover:bg-red-100 transition-colors">
                <LogOut size={18} />
              </div>
              <span className="font-bold text-sm text-red-500">Sign Out</span>
            </div>
          </button>

        </div>
      </div>

    </div>
  )
}