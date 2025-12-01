'use client'

import { useState, useEffect } from 'react'
import { Plus, MapPin, Loader2, X, Briefcase, IndianRupee, Globe, ExternalLink, RefreshCw, MessageCircle } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'

// Types based on your DB schema
type Requirement = {
  id: string
  title: string
  location: string
  budget_range: string | null
  property_type: string
  urgency: string | null
  status: string
  created_at: string
}

type ExternalListing = {
  id: string
  title: string
  description: string
  location: string
  price: string
  source_platform: string
  source_url: string
  confidence_score: number
  // Updated type to include contact info
  contact_info: { phone?: string, email?: string } | null 
  created_at: string
}

const PROPERTY_TYPES = ['Residential', 'Commercial', 'Plots', 'Industrial']
const URGENCY_LEVELS = ['Immediate', '1 Month', '3 Months', 'Passive']

export default function DealRoomPage() {
  const supabase = createClient()
  
  // State
  const [activeTab, setActiveTab] = useState<'needs' | 'matches'>('needs')
  const [requirements, setRequirements] = useState<Requirement[]>([])
  const [matches, setMatches] = useState<ExternalListing[]>([])
  const [loading, setLoading] = useState(true)
  
  // Modal & Form State
  const [showAddModal, setShowAddModal] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    location: '',
    budgetMin: '',
    budgetMax: '',
    propertyType: 'Residential',
    urgency: 'Immediate',
    description: ''
  })

  // 1. Fetch Data
  const fetchData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // A. Fetch User Requirements
      const { data: reqs } = await supabase
        .from('deal_requirements')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      if (reqs) setRequirements(reqs)

      // B. Fetch External Matches
      const { data: ext } = await supabase
        .from('external_listings')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20)
      if (ext) setMatches(ext)

    } catch (e) {
      console.error("Error fetching data:", e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  // 2. Handle Connect (The Closer Logic)
  const handleConnect = (match: ExternalListing) => {
    const introText = `Hi, I saw your listing for "${match.title}" on ${match.source_platform}. I have a requirement that matches this. Are you the direct owner?`
    
    // Case A: We found a phone number
    if (match.contact_info?.phone) {
        const cleanPhone = match.contact_info.phone.replace(/[^0-9]/g, '')
        // Open WhatsApp
        window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(introText)}`, '_blank')
    } 
    // Case B: No phone, just a link
    else {
        // Copy to clipboard
        navigator.clipboard.writeText(introText)
        alert("📋 Intro message copied! Opening source link...")
        // Open the Source URL (LinkedIn/FB post)
        window.open(match.source_url, '_blank')
    }
  }

  // 3. Handle Post "Need"
  const handlePostRequirement = async () => {
    if (!formData.title || !formData.location || !formData.budgetMin) {
        alert("Please fill in Title, Location and Budget.")
        return
    }

    setIsSubmitting(true)
    try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error("No user")

        const budgetString = `${formData.budgetMin} - ${formData.budgetMax || '+'}`

        // Insert to DB
        const { data: insertedData, error } = await supabase
            .from('deal_requirements')
            .insert({
                user_id: user.id,
                title: formData.title,
                location: formData.location,
                description: formData.description,
                budget_range: budgetString,
                property_type: formData.propertyType,
                urgency: formData.urgency,
                status: 'active'
            })
            .select()
            .single()

        if (error) throw error

        // Trigger AI Agent
        if (insertedData) {
            await fetch('/api/agent-hunt', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    requirementId: insertedData.id,
                    title: formData.title,
                    location: formData.location,
                    budget: budgetString,
                    propertyType: formData.propertyType
                })
            })
        }

        await fetchData()
        setShowAddModal(false)
        setFormData({ title: '', location: '', budgetMin: '', budgetMax: '', propertyType: 'Residential', urgency: 'Immediate', description: '' })
        alert("Requirement posted! The AI Agent is hunting for matches...")

    } catch (e: any) {
        alert("Failed to post: " + e.message)
    } finally {
        setIsSubmitting(false)
    }
  }

  if (loading) return <div className="flex h-screen items-center justify-center text-slate-400"><Loader2 className="animate-spin" /></div>

  return (
    <div className="p-5 max-w-md mx-auto min-h-screen pb-24 relative">
      
      {/* Header */}
      <div className="flex justify-between items-end mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            Deal Room <span className="bg-green-100 text-green-700 text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider">Beta</span>
          </h1>
          <p className="text-slate-500 text-xs mt-1">Match needs with market supply</p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-lg shadow-slate-200 active:scale-95 transition-transform flex items-center gap-2 font-bold text-xs">
            <Plus size={16} /> Post Need
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-6 border-b border-slate-100 mb-6">
        <button 
            onClick={() => setActiveTab('needs')}
            className={`text-sm font-bold pb-2 transition-colors ${activeTab === 'needs' ? 'text-slate-900 border-b-2 border-slate-900' : 'text-slate-400 hover:text-slate-600'}`}
        >
            My Requirements
        </button>
        <button 
            onClick={() => setActiveTab('matches')}
            className={`text-sm font-bold pb-2 transition-colors flex items-center gap-2 ${activeTab === 'matches' ? 'text-slate-900 border-b-2 border-slate-900' : 'text-slate-400 hover:text-slate-600'}`}
        >
            Matches <span className="bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full text-[10px]">{matches.length}</span>
        </button>
      </div>

      {/* CONTENT: My Requirements */}
      {activeTab === 'needs' && (
        <div className="space-y-4 animate-in fade-in slide-in-from-left-4 duration-300">
            {requirements.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-[2rem] border border-dashed border-slate-200">
                    <div className="bg-slate-50 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                        <Briefcase size={20} className="text-slate-400" />
                    </div>
                    <p className="text-slate-500 text-sm font-medium">No active requirements.</p>
                    <p className="text-slate-400 text-xs mt-1 max-w-[200px] mx-auto">Post what your buyers need, and our AI will find off-market deals.</p>
                </div>
            ) : (
                requirements.map((req) => (
                    <div key={req.id} className="bg-white p-4 rounded-[1.5rem] shadow-sm border border-slate-100 relative group">
                        <div className="flex justify-between items-start mb-2">
                            <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-1 rounded-lg uppercase">{req.property_type}</span>
                            <span className="text-[10px] text-slate-400 font-medium">{new Date(req.created_at).toLocaleDateString()}</span>
                        </div>
                        <h3 className="font-bold text-slate-800 text-base mb-1">{req.title}</h3>
                        <div className="flex items-center gap-4 text-xs text-slate-500 mb-3">
                            <div className="flex items-center gap-1"><MapPin size={12} /> {req.location}</div>
                            <div className="flex items-center gap-1"><IndianRupee size={12} /> {req.budget_range}</div>
                        </div>
                        <div className="border-t border-slate-50 pt-3 flex gap-2">
                            <button onClick={() => setActiveTab('matches')} className="flex-1 bg-slate-900 text-white py-2 rounded-xl text-xs font-bold shadow-md shadow-slate-100 hover:opacity-90 transition-opacity">
                                View Matches
                            </button>
                        </div>
                    </div>
                ))
            )}
        </div>
      )}

      {/* CONTENT: AI Matches */}
      {activeTab === 'matches' && (
        <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            
            <div className="flex justify-between items-center mb-2 px-1">
                <p className="text-xs text-slate-400 font-medium">Found via Agent Hunt 🕵️‍♂️</p>
                <button onClick={fetchData} className="text-slate-400 hover:text-blue-500 transition-colors"><RefreshCw size={14} /></button>
            </div>

            {matches.length === 0 ? (
                <div className="text-center py-16">
                    <p className="text-slate-400 text-sm">No matches found yet.</p>
                    <p className="text-slate-300 text-xs mt-1">Try posting a requirement to start the hunt.</p>
                </div>
            ) : (
                matches.map((match) => (
                    <div key={match.id} className="bg-white p-4 rounded-[1.5rem] shadow-sm border border-blue-100 relative overflow-hidden group">
                        
                        {/* AI Badge */}
                        <div className="absolute top-0 right-0 bg-blue-50 px-3 py-1 rounded-bl-xl border-l border-b border-blue-100">
                            <div className="flex items-center gap-1.5">
                                <Globe size={10} className="text-blue-500" />
                                <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wide">{match.source_platform}</span>
                            </div>
                        </div>

                        <div className="pr-12">
                            <h3 className="font-bold text-slate-800 text-sm leading-tight mb-1">{match.title}</h3>
                            <div className="flex items-center gap-1.5 text-slate-500 text-xs mb-2">
                                <span className="font-bold text-slate-700">{match.price || 'Price on Request'}</span>
                                <span className="text-slate-300">•</span>
                                <span className="truncate max-w-[150px]">{match.location}</span>
                            </div>
                        </div>

                        <p className="text-xs text-slate-500 bg-slate-50 p-2 rounded-lg leading-relaxed border border-slate-100 mb-3 line-clamp-2">
                            {match.description}
                        </p>

                        <div className="flex gap-2">
                            <a href={match.source_url} target="_blank" rel="noopener noreferrer" className="flex-1 bg-white border border-slate-200 text-slate-600 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1 hover:bg-slate-50 transition-colors">
                                View Source <ExternalLink size={12} />
                            </a>
                            <button 
                                onClick={() => handleConnect(match)}
                                className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl text-xs font-bold shadow-md shadow-blue-200 hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                            >
                                {match.contact_info?.phone ? <MessageCircle size={14} /> : <Briefcase size={14} />}
                                Connect
                            </button>
                        </div>
                    </div>
                ))
            )}
        </div>
      )}

      {/* ADD MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-[80] bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm rounded-[2rem] p-6 shadow-2xl animate-in slide-in-from-bottom-10 max-h-[90vh] overflow-y-auto">
            
            <div className="flex justify-between items-center mb-5">
              <div>
                <h2 className="text-lg font-bold text-slate-900">New Buyer Need</h2>
                <p className="text-xs text-slate-400">AI will search the web for this.</p>
              </div>
              <button onClick={() => setShowAddModal(false)} className="bg-slate-50 p-2 rounded-full text-slate-500 hover:bg-slate-100"><X size={18} /></button>
            </div>

            <div className="space-y-4">
                {/* Title */}
                <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-2 block mb-1">Requirement Title</label>
                    <input type="text" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} placeholder="e.g. 3 BHK in Mohali for Investor" className="w-full bg-slate-50 p-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary" />
                </div>

                {/* Location */}
                <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-2 block mb-1">Target Location</label>
                    <div className="relative">
                        <MapPin size={14} className="absolute left-3 top-3.5 text-slate-400" />
                        <input type="text" value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} placeholder="Sector 82, Aerocity..." className="w-full bg-slate-50 p-3 pl-9 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary" />
                    </div>
                </div>

                {/* Budget Row */}
                <div className="flex gap-3">
                    <div className="flex-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase ml-2 block mb-1">Min Budget</label>
                        <input type="text" value={formData.budgetMin} onChange={e => setFormData({...formData, budgetMin: e.target.value})} placeholder="1 Cr" className="w-full bg-slate-50 p-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary" />
                    </div>
                    <div className="flex-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase ml-2 block mb-1">Max Budget</label>
                        <input type="text" value={formData.budgetMax} onChange={e => setFormData({...formData, budgetMax: e.target.value})} placeholder="1.5 Cr" className="w-full bg-slate-50 p-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary" />
                    </div>
                </div>

                {/* Chips for Type */}
                <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-2 block mb-1">Property Type</label>
                    <div className="flex flex-wrap gap-2">
                        {PROPERTY_TYPES.map(t => (
                            <button key={t} onClick={() => setFormData({...formData, propertyType: t})} className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${formData.propertyType === t ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-500 border-slate-200'}`}>
                                {t}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Chips for Urgency */}
                <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-2 block mb-1">Urgency</label>
                    <div className="flex flex-wrap gap-2">
                        {URGENCY_LEVELS.map(u => (
                            <button key={u} onClick={() => setFormData({...formData, urgency: u})} className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${formData.urgency === u ? 'bg-green-100 text-green-700 border-green-200' : 'bg-white text-slate-500 border-slate-200'}`}>
                                {u}
                            </button>
                        ))}
                    </div>
                </div>

                <button onClick={handlePostRequirement} disabled={isSubmitting} className="w-full bg-slate-900 text-white py-4 rounded-xl text-sm font-bold shadow-lg shadow-slate-200 active:scale-95 transition-transform disabled:opacity-70 flex items-center justify-center gap-2">
                    {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : ( <><Briefcase size={18} /> Post Requirement</> )}
                </button>

            </div>
          </div>
        </div>
      )}

    </div>
  )
}