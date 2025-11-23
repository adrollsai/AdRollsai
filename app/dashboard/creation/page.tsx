'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Bot, Image as ImageIcon, Video } from 'lucide-react'

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
  
  const [messages, setMessages] = useState<Message[]>([
    { 
      id: 1, 
      role: 'ai', 
      text: 'Hi! I\'m ready to design. What are we making today?' 
    }
  ])
  
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = () => {
    if (!input.trim()) return

    const userMsg: Message = { id: Date.now(), role: 'user', text: input }
    setMessages(prev => [...prev, userMsg])
    const currentMode = mode
    setInput('')

    setTimeout(() => {
      const aiMsg: Message = { 
        id: Date.now() + 1, 
        role: 'ai', 
        text: `Here is a draft for your ${currentMode}.`,
        mediaType: currentMode,
        mediaUrl: currentMode === 'image' 
          ? 'https://placehold.co/600x600/e2e8f0/1e293b?text=Generated+Post' 
          : 'https://placehold.co/300x533/e2e8f0/1e293b?text=Generated+Reel'
      }
      setMessages(prev => [...prev, aiMsg])
    }, 1500)
  }

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] bg-surface">
      
      {/* Compact Header: py-3 */}
      <div className="bg-white px-5 py-3 shadow-sm z-10 flex justify-between items-center">
        <h1 className="text-lg font-bold text-slate-800">Designer Agent</h1>
        
        <div className="bg-slate-100 p-1 rounded-full flex">
           <button 
            onClick={() => setMode('image')}
            // Smaller padding and text
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
                    overflow-hidden rounded-2xl border-4 border-white shadow-md
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
        <div ref={chatEndRef} />
      </div>

      {/* Input Compact */}
      <div className="p-4 bg-surface pb-6">
        <div className="relative flex items-center">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder={`Describe your ${mode}...`}
            className="w-full bg-white border-none py-3 pl-5 pr-12 rounded-full shadow-lg shadow-blue-50 text-sm text-slate-700 focus:ring-2 focus:ring-primary outline-none"
          />
          <button 
            onClick={handleSend}
            className="absolute right-2 bg-primary hover:bg-blue-300 text-primary-text p-2 rounded-full transition-colors"
          >
            <Send size={16} strokeWidth={2.5} />
          </button>
        </div>
      </div>

    </div>
  )
}