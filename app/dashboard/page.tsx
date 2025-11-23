'use client'

import { Plus, Search, MapPin } from 'lucide-react'

const properties = [
  {
    id: 1,
    address: '456 Oak Street, CA',
    price: '$850,000',
    status: 'Live - 4 Campaigns',
    statusColor: 'bg-green-100 text-green-700',
    image: 'https://placehold.co/600x400/e2e8f0/475569?text=House+1' 
  },
  {
    id: 2,
    address: '12 Marina Bay, FL',
    price: '$1.2M',
    status: 'Drafting Content',
    statusColor: 'bg-amber-100 text-amber-700',
    image: 'https://placehold.co/600x400/ffe4e6/be123c?text=House+2'
  },
  {
    id: 3,
    address: '88 Sunset Blvd, LA',
    price: '$2.1M',
    status: 'Pending Review',
    statusColor: 'bg-primary text-blue-800',
    image: 'https://placehold.co/600x400/dbeafe/1e40af?text=House+3'
  }
]

export default function InventoryPage() {
  return (
    <div className="p-5 max-w-md mx-auto">
      
      {/* Header Reduced: text-2xl instead of 3xl */}
      <div className="flex justify-between items-end mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Inventory</h1>
          <p className="text-slate-500 text-xs mt-1">Manage your active listings</p>
        </div>
        
        {/* Smaller Button: p-3 and size 20 */}
        <button className="bg-primary hover:bg-blue-200 text-primary-text p-3 rounded-full shadow-md active:scale-95 transition-transform">
          <Plus size={20} strokeWidth={3} />
        </button>
      </div>

      {/* Search Bar Compact: py-3 */}
      <div className="relative mb-6">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
          <Search size={18} />
        </div>
        <input 
          type="text" 
          placeholder="Search address..." 
          className="w-full bg-white border-none py-3 pl-10 pr-4 rounded-xl shadow-sm text-sm text-slate-700 focus:ring-2 focus:ring-primary outline-none"
        />
      </div>

      {/* Property List Compact */}
      <div className="flex flex-col gap-4">
        {properties.map((prop) => (
          <div key={prop.id} className="bg-white p-3 rounded-[1.5rem] shadow-sm border border-slate-100">
            
            {/* Image Height Reduced: h-32 */}
            <div className="relative h-32 w-full rounded-2xl overflow-hidden bg-slate-100 mb-3">
              <img 
                src={prop.image} 
                alt="Property" 
                className="w-full h-full object-cover"
              />
              <span className={`absolute top-3 left-3 px-2.5 py-1 rounded-full text-[10px] font-bold shadow-sm ${prop.statusColor}`}>
                {prop.status}
              </span>
            </div>

            {/* Content Text Reduced */}
            <div className="px-1 pb-1">
              <h3 className="text-lg font-bold text-slate-800">{prop.price}</h3>
              <div className="flex items-center gap-1.5 text-slate-500 mt-0.5">
                <MapPin size={14} />
                <span className="text-xs font-medium">{prop.address}</span>
              </div>
            </div>

          </div>
        ))}
      </div>
      
    </div>
  )
}