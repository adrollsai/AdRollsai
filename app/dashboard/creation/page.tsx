'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Bot, Image as ImageIcon, Video, Loader2 } from 'lucide-react'

type Message = {
  id: number
  role: 'user' | 'ai'
  text: string
  mediaUrl?: string
  mediaType?: 'image' | 'video'
}

export default function CreationPage() {
  const [mode, setMode] = useState<'image' | 'video'>('image')
  const [input, setInput] = useState('')
  const [isThinking, setIsThinking] = useState(false)
  
  const [messages, setMessages] = useState<Message[]>([
    { 
      id: 1, 
      role: 'ai', 
      text: 'Hi! I\'m connected to n8n. Ask me to create something!' 
    }
  ])
  
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isThinking])

  const handleSend = async () => {
    if (!input.trim() || isThinking) return

    // 1. Add User Message immediately
    const userMsg: Message = { id: Date.now(), role: 'user', text: input }
    setMessages(prev => [...prev, userMsg])
    const currentInput = input
    const currentMode = mode
    setInput('')
    setIsThinking(true)

    try {
      // 2. Call our Next.js API (which calls n8n)
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: currentInput,
          mode: currentMode
        })
      })

      const data = await response.json()

      // 3. Add AI Response
      const aiMsg: Message = { 
        id: Date.now() + 1, 
        role: 'ai', 
        text: data.text || "Here is your result.",
        mediaType: currentMode,
        mediaUrl: data.image // n8n will send this back
      }
      setMessages(prev => [...prev, aiMsg])

    } catch (error) {
      // Error Handling
      const errorMsg: Message = {
        id: Date.now() + 1,
        role: 'ai',
        text: "Sorry, I lost connection to the brain. Please check if n8n is active."
      }
      setMessages(prev => [...prev, errorMsg])
    } finally {
      setIsThinking(false)
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] bg-surface">
      
      {/* Header */}
      <div className="bg-white px-5 py-3 shadow-sm z-10 flex justify-between items-center">
        <h1 className="text-lg font-bold text-slate-800">Designer Agent</h1>
        
        <div className="bg-slate-100 p-1 rounded-full flex">
           <button 
            onClick={() => setMode('image')}
            className={`px-3 py-1.5 rounded-full text-[10px] font-bold transition-all ${mode === 'image' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}
          >
            Image
          </button>
          <button 
            onClick={() => setMode('video')}
            className={`px-3 py-1.5 rounded-full text-[10px] font-bold transition-all ${mode === 'video' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}
          >
            Video
          </button>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div 
            key={msg.id} 
            className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`flex max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
              
              {msg.role === 'ai' && (
                <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center mr-2 flex-shrink-0 mt-1">
                  <Bot size={14} className="text-primary-text" />
                </div>
              )}

              <div className="flex flex-col gap-2">
                <div className={`
                  p-3 text-sm font-medium leading-relaxed shadow-sm
                  ${msg.role === 'user' 
                    ? 'bg-slate-800 text-white rounded-2xl rounded-tr-sm' 
                    : 'bg-white text-slate-700 border border-slate-100 rounded-2xl rounded-tl-sm' 
                  }
                `}>
                  {msg.text}
                </div>

                {msg.mediaUrl && (
                  <div className={`
                    overflow-hidden rounded-2xl border-4 border-white shadow-md bg-slate-100
                    ${msg.mediaType === 'image' ? 'w-48 h-48' : 'w-36 h-64'}
                  `}>
                    <img 
                      src={msg.mediaUrl} 
                      alt="Generated content" 
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
        
        {/* Thinking Indicator */}
        {isThinking && (
          <div className="flex w-full justify-start">
             <div className="flex max-w-[85%] flex-row">
                <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center mr-2 flex-shrink-0 mt-1">
                  <Bot size={14} className="text-primary-text" />
                </div>
                <div className="bg-white text-slate-500 p-3 rounded-2xl rounded-tl-sm shadow-sm border border-slate-100 flex items-center gap-2 text-xs font-bold">
                   <Loader2 size={14} className="animate-spin" />
                   Designing...
                </div>
             </div>
          </div>
        )}
        
        <div ref={chatEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-surface pb-6">
        <div className="relative flex items-center">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder={`Describe your ${mode}...`}
            disabled={isThinking}
            className="w-full bg-white border-none py-3 pl-5 pr-12 rounded-full shadow-lg shadow-blue-50 text-sm text-slate-700 focus:ring-2 focus:ring-primary outline-none disabled:opacity-50"
          />
          <button 
            onClick={handleSend}
            disabled={isThinking}
            className="absolute right-2 bg-primary hover:bg-blue-300 text-primary-text p-2 rounded-full transition-colors disabled:opacity-50"
          >
            <Send size={16} strokeWidth={2.5} />
          </button>
        </div>
      </div>

    </div>
  )
}