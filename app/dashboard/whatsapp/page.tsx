'use client'

import { useState } from 'react'
import { MessageCircle, UserPlus, CalendarClock, BellRing } from 'lucide-react'

const initialFlows = [
  { 
    id: 1, 
    title: 'New Lead Funnel', 
    desc: 'Instant reply + 3 day follow-up sequence', 
    icon: UserPlus,
    active: true,
    stats: '12 leads this week'
  },
  { 
    id: 2, 
    title: 'Open House Reminders', 
    desc: 'WhatsApp blast to registered visitors', 
    icon: CalendarClock,
    active: false,
    stats: 'Paused'
  },
  { 
    id: 3, 
    title: 'Review Request', 
    desc: 'Ask happy clients for Google reviews', 
    icon: BellRing,
    active: true,
    stats: '4.8 avg rating'
  },
  { 
    id: 4, 
    title: 'General Inquiry AI', 
    desc: 'Handle FAQ questions 24/7', 
    icon: MessageCircle,
    active: true,
    stats: '35 replies today'
  }
]

export default function AutomationPage() {
  const [flows, setFlows] = useState(initialFlows)

  const toggleFlow = (id: number) => {
    setFlows(flows.map(flow => 
      flow.id === id ? { ...flow, active: !flow.active } : flow
    ))
  }

  return (
    <div className="p-5 max-w-md mx-auto min-h-screen">
      
      {/* Header Reduced */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Automation</h1>
        <p className="text-slate-500 text-xs mt-1">Control your WhatsApp agents</p>
      </div>

      <div className="space-y-3 mb-24">
        {flows.map((flow) => (
          <div 
            key={flow.id}
            // Smaller padding (p-4 instead of p-5)
            className={`
              relative p-4 rounded-[1.5rem] border transition-all duration-300
              ${flow.active 
                ? 'bg-white border-blue-100 shadow-md shadow-blue-50/50' 
                : 'bg-slate-50 border-slate-100 opacity-80'
              }
            `}
          >
            <div className="flex justify-between items-start mb-3">
              
              <div className="flex gap-3">
                {/* Smaller Icon Box */}
                <div className={`
                  p-2.5 rounded-xl flex items-center justify-center transition-colors
                  ${flow.active ? 'bg-primary text-primary-text' : 'bg-slate-200 text-slate-400'}
                `}>
                  <flow.icon size={20} />
                </div>
                <div>
                  {/* Smaller Text */}
                  <h3 className={`font-bold text-sm ${flow.active ? 'text-slate-800' : 'text-slate-500'}`}>
                    {flow.title}
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5 max-w-[140px] leading-relaxed">
                    {flow.desc}
                  </p>
                </div>
              </div>

              {/* Smaller Toggle Switch */}
              <button 
                onClick={() => toggleFlow(flow.id)}
                className={`
                  w-10 h-6 rounded-full flex items-center transition-all duration-300 px-0.5
                  ${flow.active ? 'bg-slate-900' : 'bg-slate-300'}
                `}
              >
                <div className={`
                  w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-300
                  ${flow.active ? 'translate-x-4' : 'translate-x-0'}
                `} />
              </button>
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-slate-100/50">
              <span className={`text-[10px] font-bold ${flow.active ? 'text-green-600' : 'text-slate-400'}`}>
                {flow.active ? '● Active' : '○ Inactive'}
              </span>
              <span className="text-[10px] text-slate-400 font-medium">
                {flow.stats}
              </span>
            </div>

          </div>
        ))}
      </div>

    </div>
  )
}