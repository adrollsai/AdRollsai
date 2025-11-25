'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Bot, Image as ImageIcon, Video, Loader2, Check, X, Share2 } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'

// Types
type Message = {
  id: number
  role: 'user' | 'ai'
  text: string
  mediaUrl?: string
  mediaType?: 'image' | 'video'
}

type Draft = {
  id: string
  image_url: string
  caption: string
  status: string
}

export default function CreationPage() {
  const supabase = createClient()
  
  // Chat State
  const [mode, setMode] = useState<'image' | 'video'>('image')
  const [input, setInput] = useState('')
  const [isThinking, setIsThinking] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    { id: 1, role: 'ai', text: 'Hi! I generate content based on your inventory. Ask me anything!' }
  ])
  const chatEndRef = useRef<HTMLDivElement>(null)

  // Drafts State
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [loadingDrafts, setLoadingDrafts] = useState(true)
  const [processingDraftId, setProcessingDraftId] = useState<string | null>(null)

  // 1. Fetch Drafts on Load
  useEffect(() => {
    const fetchDrafts = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('daily_drafts')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'pending') // Only show pending items
        .order('created_at', { ascending: false })

      if (data) setDrafts(data)
      setLoadingDrafts(false)
    }
    fetchDrafts()
  }, [])

  // 2. Handle Chat Send (Existing Logic)
  const handleSend = async () => {
    if (!input.trim() || isThinking) return

    const userMsg: Message = { id: Date.now(), role: 'user', text: input }
    setMessages(prev => [...prev, userMsg])
    const currentInput = input
    const currentMode = mode
    setInput('')
    setIsThinking(true)

    try {
      const startResponse = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: currentInput, mode: currentMode })
      })
      
      const startData = await startResponse.json()
      const taskId = startData.taskId 

      // Wait loop
      await new Promise(resolve => setTimeout(resolve, 15000)) // 15s wait

      const checkResponse = await fetch('/api/check-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId })
      })

      const checkData = await checkResponse.json()
      let finalImageUrl = ''
      if (checkData.data && checkData.data.resultJson) {
         const resultObj = JSON.parse(checkData.data.resultJson)
         finalImageUrl = resultObj.resultUrls[0]
      }

      if (finalImageUrl) {
        const aiMsg: Message = { 
          id: Date.now() + 1, 
          role: 'ai', 
          text: "Here is your design!",
          mediaType: currentMode,
          mediaUrl: finalImageUrl
        }
        setMessages(prev => [...prev, aiMsg])
      } else {
         throw new Error("Processing...")
      }

    } catch (error) {
      const errorMsg: Message = {
        id: Date.now() + 1,
        role: 'ai',
        text: "I'm still working on it. Check the Assets library in a minute!"
      }
      setMessages(prev => [...prev, errorMsg])
    } finally {
      setIsThinking(false)
    }
  }

  // --- 3. DRAFT ACTIONS ---

  // Action A: Post to Facebook
  const handlePostDraft = async (draft: Draft) => {
    setProcessingDraftId(draft.id)
    try {
      const response = await fetch('/api/post-social', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: draft.image_url,
          caption: draft.caption
        })
      })

      if (response.ok) {
        // Update DB status to 'posted'
        await supabase.from('daily_drafts').update({ status: 'posted' }).eq('id', draft.id)
        // Remove from UI
        setDrafts(prev => prev.filter(d => d.id !== draft.id))
        alert("Posted successfully!")
      } else {
        alert("Failed to post. Check your connection.")
      }
    } catch (e) {
      console.error(e)
    } finally {
      setProcessingDraftId(null)
    }
  }

  // Action B: Reject (Hide)
  const handleRejectDraft = async (id: string) => {
    setDrafts(prev => prev.filter(d => d.id !== id)) // Instant UI removal
    await supabase.from('daily_drafts').update({ status: 'rejected' }).eq('id', id)
  }

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] bg-surface">
      
      {/* --- SECTION 1: DAILY DRAFTS (The "Executive" View) --- */}
      {drafts.length > 0 && (
        <div className="pt-6 pb-2 pl-5 border-b border-slate-100 bg-slate-50/50">
          <div className="flex justify-between items-center pr-5 mb-3">
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <Share2 size={14} /> Daily Suggestions
            </h2>
            <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
              {drafts.length} New
            </span>
          </div>

          {/* Horizontal Scroll Container */}
          <div className="flex gap-4 overflow-x-auto pb-4 pr-5 scrollbar-hide">
            {drafts.map(draft => (
              <div key={draft.id} className="flex-shrink-0 w-64 bg-white rounded-2xl p-3 shadow-sm border border-slate-100 snap-center">
                {/* Image */}
                <div className="relative h-32 rounded-xl overflow-hidden mb-3 bg-slate-100">
                  <img src={draft.image_url} className="w-full h-full object-cover" />
                </div>
                
                {/* Caption Preview */}
                <p className="text-xs text-slate-600 line-clamp-2 mb-3 min-h-[2.5em]">
                  {draft.caption}
                </p>

                {/* Action Buttons */}
                <div className="flex gap-2">
                  <button 
                    onClick={() => handleRejectDraft(draft.id)}
                    className="flex-1 bg-slate-50 hover:bg-red-50 text-slate-400 hover:text-red-500 py-2 rounded-lg transition-colors"
                  >
                    <X size={18} className="mx-auto" />
                  </button>
                  <button 
                    onClick={() => handlePostDraft(draft)}
                    disabled={processingDraftId === draft.id}
                    className="flex-[3] bg-slate-900 text-white py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 active:scale-95 transition-transform"
                  >
                    {processingDraftId === draft.id ? <Loader2 size={14} className="animate-spin" /> : "Post Now"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* --- SECTION 2: CHAT HEADER --- */}
      <div className="bg-white px-5 py-3 shadow-sm z-10 flex justify-between items-center">
        <h1 className="text-lg font-bold text-slate-800">Designer Agent</h1>
        
        <div className="bg-slate-100 p-1 rounded-full flex">
           <button onClick={() => setMode('image')} className={`px-3 py-1.5 rounded-full text-[10px] font-bold transition-all ${mode === 'image' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}>Image</button>
           <button onClick={() => setMode('video')} className={`px-3 py-1.5 rounded-full text-[10px] font-bold transition-all ${mode === 'video' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}>Video</button>
        </div>
      </div>

      {/* --- SECTION 3: CHAT AREA --- */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`flex max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
              {msg.role === 'ai' && <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center mr-2 flex-shrink-0 mt-1"><Bot size={14} className="text-primary-text" /></div>}
              <div className="flex flex-col gap-2">
                <div className={`p-3 text-sm font-medium leading-relaxed shadow-sm ${msg.role === 'user' ? 'bg-slate-800 text-white rounded-2xl rounded-tr-sm' : 'bg-white text-slate-700 border border-slate-100 rounded-2xl rounded-tl-sm'}`}>
                  {msg.text}
                </div>
                {msg.mediaUrl && (
                  <div className={`overflow-hidden rounded-2xl border-4 border-white shadow-md bg-slate-100 ${msg.mediaType === 'image' ? 'w-48 h-48' : 'w-36 h-64'}`}>
                    <img src={msg.mediaUrl} alt="Generated content" className="w-full h-full object-cover" />
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
        {isThinking && (
          <div className="flex w-full justify-start">
             <div className="flex max-w-[85%] flex-row">
                <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center mr-2 flex-shrink-0 mt-1"><Bot size={14} className="text-primary-text" /></div>
                <div className="bg-white text-slate-500 p-3 rounded-2xl rounded-tl-sm shadow-sm border border-slate-100 flex items-center gap-2 text-xs font-bold"><Loader2 size={14} className="animate-spin" />Designing...</div>
             </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* INPUT */}
      <div className="p-4 bg-surface pb-6">
        <div className="relative flex items-center">
          <input type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSend()} placeholder={`Describe your ${mode}...`} disabled={isThinking} className="w-full bg-white border-none py-3 pl-5 pr-12 rounded-full shadow-lg shadow-blue-50 text-sm text-slate-700 focus:ring-2 focus:ring-primary outline-none disabled:opacity-50" />
          <button onClick={handleSend} disabled={isThinking} className="absolute right-2 bg-primary hover:bg-blue-300 text-primary-text p-2 rounded-full transition-colors disabled:opacity-50"><Send size={16} strokeWidth={2.5} /></button>
        </div>
      </div>

    </div>
  )
}