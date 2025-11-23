'use client'

import { useState } from 'react'
import { X, Send, Sparkles } from 'lucide-react'

export default function FloatingAgent() {
  const [isOpen, setIsOpen] = useState(false)
  const [input, setInput] = useState('')

  const toggleOpen = () => setIsOpen(!isOpen)

  return (
    <>
      {/* 1. COMPACT FAB BUTTON */}
      {!isOpen && (
        <button
          onClick={toggleOpen}
          // Smaller padding (p-3.5) and icon (size 20)
          className="fixed right-4 bottom-28 z-[60] bg-slate-900 text-white p-3.5 rounded-2xl shadow-lg shadow-slate-300 hover:scale-105 active:scale-95 transition-all duration-300 flex items-center gap-2 group"
        >
          <Sparkles size={20} className="group-hover:rotate-12 transition-transform" />
          <span className="font-bold text-sm pr-1">Agent</span>
        </button>
      )}

      {/* 2. OVERLAY (Fonts resized) */}
      {isOpen && (
        <div className="fixed inset-0 z-[70] bg-surface flex flex-col animate-in slide-in-from-bottom-10 duration-200">
          
          <div className="bg-white px-5 py-3 shadow-sm flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="bg-slate-900 p-1.5 rounded-lg text-white">
                <Sparkles size={18} />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-800">Business AI</h2>
                <p className="text-[10px] text-slate-500 uppercase tracking-wide">Assistant</p>
              </div>
            </div>
            
            <button 
              onClick={toggleOpen}
              className="bg-slate-100 p-1.5 rounded-full text-slate-500 hover:bg-slate-200 transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 p-5 overflow-y-auto bg-surface">
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-slate-900 flex items-center justify-center flex-shrink-0 mt-1">
                <Sparkles size={14} className="text-white" />
              </div>
              <div className="bg-white p-4 rounded-2xl rounded-tl-none shadow-sm border border-slate-100 max-w-[85%]">
                <p className="text-slate-700 text-sm leading-relaxed">
                  Hello! I'm ready to manage your marketing.
                </p>
                <ul className="mt-2 space-y-2 text-xs text-slate-500 font-medium">
                  <li className="flex items-center gap-2">
                    <span className="w-1 h-1 rounded-full bg-blue-400" />
                    Launch a campaign...
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1 h-1 rounded-full bg-blue-400" />
                    Check new leads...
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <div className="p-4 bg-white border-t border-slate-100">
            <div className="relative flex items-center">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type a command..."
                className="w-full bg-slate-50 border-none py-3 pl-5 pr-12 rounded-xl text-sm text-slate-700 focus:ring-2 focus:ring-slate-900 outline-none"
              />
              <button className="absolute right-2 bg-slate-900 text-white p-2 rounded-lg hover:bg-slate-700 transition-colors">
                <Send size={16} />
              </button>
            </div>
          </div>

        </div>
      )}
    </>
  )
}