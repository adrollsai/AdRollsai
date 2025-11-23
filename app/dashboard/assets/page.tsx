'use client'

import { useState } from 'react'
import { Filter, Download } from 'lucide-react'

const assets = [
  { id: 1, type: 'image', status: 'Published', url: 'https://placehold.co/400x400/e2e8f0/1e293b?text=Post+1' },
  { id: 2, type: 'video', status: 'Pending', url: 'https://placehold.co/400x600/fee2e2/991b1b?text=Reel+1' },
  { id: 3, type: 'image', status: 'Published', url: 'https://placehold.co/400x400/dbeafe/1e40af?text=Post+2' },
  { id: 4, type: 'image', status: 'Review', url: 'https://placehold.co/400x400/fef3c7/92400e?text=Post+3' },
  { id: 5, type: 'video', status: 'Published', url: 'https://placehold.co/400x600/e0e7ff/3730a3?text=Reel+2' },
  { id: 6, type: 'image', status: 'Pending', url: 'https://placehold.co/400x400/f3f4f6/4b5563?text=Post+4' },
  { id: 7, type: 'image', status: 'Published', url: 'https://placehold.co/400x400/ecfccb/3f6212?text=Post+5' },
  { id: 8, type: 'video', status: 'Published', url: 'https://placehold.co/400x600/fae8ff/86198f?text=Reel+3' },
  { id: 9, type: 'image', status: 'Review', url: 'https://placehold.co/400x400/ffedd5/9a3412?text=Post+6' },
]

const filters = ['All', 'Instagram', 'Facebook', 'Pending', 'Published']

export default function AssetsPage() {
  const [activeFilter, setActiveFilter] = useState('All')

  return (
    <div className="p-5 max-w-md mx-auto min-h-screen">
      
      {/* Header Reduced: text-2xl and smaller padding */}
      <div className="flex justify-between items-end mb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Library</h1>
          <p className="text-slate-500 text-xs mt-1">Your marketing assets</p>
        </div>
        <button className="p-2.5 bg-white text-slate-700 rounded-full shadow-sm border border-slate-100">
          <Filter size={18} />
        </button>
      </div>

      {/* Filter Chips Compact: text-xs, smaller padding */}
      <div className="flex gap-2 overflow-x-auto pb-5 -mx-5 px-5 scrollbar-hide">
        {filters.map((filter) => (
          <button
            key={filter}
            onClick={() => setActiveFilter(filter)}
            className={`
              whitespace-nowrap px-4 py-2 rounded-full text-xs font-bold transition-all border
              ${activeFilter === filter 
                ? 'bg-slate-900 text-white border-slate-900 shadow-md' 
                : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}
            `}
          >
            {filter}
          </button>
        ))}
      </div>

      {/* Grid: Tighter gaps (gap-1.5) */}
      <div className="grid grid-cols-3 gap-1.5 mb-24">
        {assets.map((asset) => (
          <div 
            key={asset.id} 
            className="relative aspect-square rounded-xl overflow-hidden bg-slate-100 group"
          >
            <img 
              src={asset.url} 
              alt="Asset" 
              className="w-full h-full object-cover"
            />
            
            <div className={`
              absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full border-2 border-white
              ${asset.status === 'Published' ? 'bg-green-400' : 'bg-amber-400'}
            `} />
          </div>
        ))}
      </div>

      {assets.length === 0 && (
        <div className="text-center py-20">
          <p className="text-slate-400 text-sm">No assets found.</p>
        </div>
      )}

    </div>
  )
}