'use client'

import { useState, useEffect, useRef } from 'react'
import { CreditCard, LogOut, ChevronRight, Save, Upload, Phone, Loader2 } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'

export default function ProfilePage() {
  const router = useRouter()
  const supabase = createClient()
  
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)

  // Form State
  const [formData, setFormData] = useState({
    businessName: '',
    mission: '',
    color: '#D0E8FF',
    contact: '',
    logoUrl: ''
  })

  // Reference to the hidden file input
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 1. Fetch Data on Load
  useEffect(() => {
    const getData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/')
        return
      }
      setUserId(user.id)

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (data) {
        setFormData({
          businessName: data.business_name || '',
          mission: data.mission_statement || '',
          color: data.brand_color || '#D0E8FF',
          contact: data.contact_number || '',
          logoUrl: data.logo_url || ''
        })
      }
      setLoading(false)
    }
    getData()
  }, [router, supabase])

  // 2. Handle Logo Upload (With Auto-Save to DB)
  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      if (!event.target.files || event.target.files.length === 0) {
        return
      }
      setUploadingLogo(true)
      
      // Safety check for user ID
      if (!userId) return;

      const file = event.target.files[0]
      const fileExt = file.name.split('.').pop()
      // Create a unique name to prevent caching issues
      const fileName = `${userId}-${Date.now()}.${fileExt}`
      const filePath = `${fileName}`

      // A. Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('logos')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      // B. Get the Public URL
      const { data: { publicUrl } } = supabase.storage
        .from('logos')
        .getPublicUrl(filePath)

      // C. Update State (Immediate Visual Feedback)
      setFormData(prev => ({ ...prev, logoUrl: publicUrl }))

      // D. AUTO-SAVE to Database immediately
      // We use .update() here because we only want to patch the logo_url
      const { error: dbError } = await supabase
        .from('profiles')
        .update({ logo_url: publicUrl })
        .eq('id', userId)

      if (dbError) throw dbError

    } catch (error) {
      alert('Error uploading logo')
      console.error(error)
    } finally {
      setUploadingLogo(false)
    }
  }

  // 3. Save Text Data (Upsert)
  const handleSave = async () => {
    setIsSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) return

    const { error } = await supabase
      .from('profiles')
      .upsert({
        id: user.id,
        email: user.email,
        business_name: formData.businessName,
        mission_statement: formData.mission,
        brand_color: formData.color,
        contact_number: formData.contact,
        // We include logoUrl here too, just in case it wasn't auto-saved yet
        logo_url: formData.logoUrl 
      })

    if (error) {
      console.error("Supabase Error:", error)
      alert(`Error saving: ${error.message}`)
    } else {
      // Optional: Feedback
      // alert('Saved!')
    }
    
    setIsSaving(false)
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (loading) return <div className="p-10 text-center text-slate-400 text-sm">Loading settings...</div>

  return (
    <div className="p-5 max-w-md mx-auto min-h-screen pb-32">
      
      {/* --- HEADER: PROFILE & LOGO --- */}
      <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 mb-6 flex flex-col items-center text-center relative">
        
        {/* Logo Upload Circle */}
        <div 
          onClick={() => !uploadingLogo && fileInputRef.current?.click()}
          className="w-24 h-24 bg-slate-50 rounded-full mb-3 flex items-center justify-center overflow-hidden relative group cursor-pointer border-2 border-dashed border-slate-200 hover:border-primary transition-all"
        >
          {uploadingLogo ? (
            <Loader2 className="animate-spin text-slate-400" />
          ) : formData.logoUrl ? (
            <img src={formData.logoUrl} alt="Logo" className="w-full h-full object-cover" />
          ) : (
            <div className="flex flex-col items-center gap-1">
               <Upload size={20} className="text-slate-300" />
               <span className="text-[8px] text-slate-400 font-bold uppercase">Upload</span>
            </div>
          )}
          
          {/* Hidden File Input */}
          <input 
            type="file" 
            ref={fileInputRef}
            onChange={handleLogoUpload}
            accept="image/*"
            className="hidden"
          />
        </div>

        <h2 className="text-xl font-bold text-slate-800">{formData.businessName || 'Your Business'}</h2>
        <p className="text-slate-400 text-xs">Tap circle to add logo</p>
      </div>

      {/* --- FORM: AI KNOWLEDGE BASE --- */}
      <div className="mb-6">
        <h3 className="ml-3 mb-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
          AI Knowledge Base
        </h3>
        
        <div className="bg-white p-5 rounded-[2rem] shadow-sm border border-blue-100">
          <div className="space-y-4">
            
            {/* Business Name */}
            <div>
              <label className="text-[10px] font-bold text-slate-500 ml-2 block mb-1">Business Name</label>
              <input 
                type="text" 
                value={formData.businessName}
                onChange={(e) => setFormData({...formData, businessName: e.target.value})}
                className="w-full bg-slate-50 py-3 px-4 rounded-xl text-slate-800 text-sm font-medium focus:ring-2 focus:ring-primary outline-none"
                placeholder="e.g. Sunny Isles Realty"
              />
            </div>

            {/* Contact Number */}
            <div>
              <label className="text-[10px] font-bold text-slate-500 ml-2 block mb-1">Contact Number</label>
              <div className="relative">
                <Phone size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="tel" 
                  value={formData.contact}
                  onChange={(e) => setFormData({...formData, contact: e.target.value})}
                  className="w-full bg-slate-50 py-3 pl-10 pr-4 rounded-xl text-slate-800 text-sm font-medium focus:ring-2 focus:ring-primary outline-none"
                  placeholder="+1 (555) 000-0000"
                />
              </div>
              <p className="text-[10px] text-blue-400 mt-1 ml-2">Used on flyers & business cards.</p>
            </div>

            {/* Mission Statement */}
            <div>
              <label className="text-[10px] font-bold text-slate-500 ml-2 block mb-1">Mission / Info</label>
              <textarea 
                rows={3}
                value={formData.mission}
                onChange={(e) => setFormData({...formData, mission: e.target.value})}
                className="w-full bg-slate-50 py-3 px-4 rounded-xl text-slate-800 text-sm resize-none focus:ring-2 focus:ring-primary outline-none"
                placeholder="We sell luxury homes in California..."
              />
            </div>

            {/* Brand Color */}
            <div>
                 <label className="text-[10px] font-bold text-slate-500 ml-2 block mb-1">Brand Color (Hex)</label>
                 <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl">
                   <div 
                     className="w-6 h-6 rounded-md shadow-sm border border-slate-200 transition-colors duration-300" 
                     style={{ backgroundColor: formData.color }} 
                   />
                   <input 
                      type="text" 
                      value={formData.color}
                      onChange={(e) => setFormData({...formData, color: e.target.value})}
                      className="bg-transparent font-mono text-xs w-full outline-none uppercase"
                      placeholder="#000000"
                   />
                 </div>
            </div>

            {/* Save Button */}
            <button 
              onClick={handleSave}
              disabled={isSaving || uploadingLogo}
              className="w-full bg-slate-900 text-white py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-70"
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

      {/* --- SETTINGS LINKS --- */}
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