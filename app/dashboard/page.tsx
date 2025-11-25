'use client'

import { useState, useEffect, useRef } from 'react'
import { Plus, Search, MapPin, X, Loader2, Share2, Upload, Image as ImageIcon, Trash2 } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'

type Property = {
  id: string
  address: string
  price: string
  status: string
  // We keep image_url for backward compatibility (main thumb), but use 'images' for the gallery
  image_url: string 
  images: string[] 
  description?: string
}

export default function InventoryPage() {
  const supabase = createClient()
  
  // State
  const [properties, setProperties] = useState<Property[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [sharingId, setSharingId] = useState<string | null>(null)
  
  // Form State
  const [newProp, setNewProp] = useState({ address: '', price: '', description: '' })
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 1. Fetch Properties
  const fetchProperties = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('properties')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (data) setProperties(data)
    setLoading(false)
  }

  useEffect(() => {
    fetchProperties()
  }, [])

  // 2. Handle Multiple File Selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files)
      
      // Combine with existing selection
      setSelectedFiles(prev => [...prev, ...newFiles])
      
      // Create previews
      const newPreviews = newFiles.map(file => URL.createObjectURL(file))
      setPreviews(prev => [...prev, ...newPreviews])
    }
  }

  // Remove a file from selection
  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index))
    setPreviews(prev => prev.filter((_, i) => i !== index))
  }

  // 3. Add Property (Multi-Upload)
  const handleAddProperty = async () => {
    if (!newProp.address || !newProp.price) return
    setIsSubmitting(true)

    const { data: { user } } = await supabase.auth.getUser()
    
    if (user) {
      const uploadedUrls: string[] = []

      try {
        // A. Upload All Images in Parallel
        if (selectedFiles.length > 0) {
          const uploadPromises = selectedFiles.map(async (file) => {
            const fileExt = file.name.split('.').pop()
            const fileName = `${user.id}-${Date.now()}-${Math.random()}.${fileExt}`
            
            const { error: uploadError } = await supabase.storage
              .from('properties')
              .upload(fileName, file)

            if (uploadError) throw uploadError

            const { data: { publicUrl } } = supabase.storage
              .from('properties')
              .getPublicUrl(fileName)
            
            return publicUrl
          })

          const results = await Promise.all(uploadPromises)
          uploadedUrls.push(...results)
        } else {
            // Placeholder if no images
            uploadedUrls.push(`https://placehold.co/600x400/e2e8f0/475569?text=${encodeURIComponent(newProp.address)}`)
        }

        // B. Save to Database
        const { error } = await supabase.from('properties').insert({
            user_id: user.id,
            address: newProp.address,
            price: newProp.price,
            description: newProp.description,
            status: 'Draft',
            image_url: uploadedUrls[0], // Main thumbnail
            images: uploadedUrls // The full gallery
          })

        if (error) throw error

        // C. Reset
        await fetchProperties()
        setShowModal(false)
        setNewProp({ address: '', price: '', description: '' })
        setSelectedFiles([])
        setPreviews([])

      } catch (error: any) {
        alert('Error adding property: ' + error.message)
      }
    }
    setIsSubmitting(false)
  }

  // 4. Smart Share (Multi-File)
  const handleNativeShare = async (e: React.MouseEvent, prop: Property) => {
    e.stopPropagation()
    setSharingId(prop.id)

    try {
      const shareText = `🏠 *New Listing Alert!* \n\n📍 ${prop.address}\n💰 Price: ${prop.price}\n\n${prop.description || ''}\n\n✨ Contact me for details!`

      if (navigator.share) {
        // A. Get list of images (Fallback to just main image if array is empty)
        const imagesToShare = (prop.images && prop.images.length > 0) ? prop.images : [prop.image_url]
        
        // B. Fetch all images as Blobs -> Files
        const filePromises = imagesToShare.map(async (url, index) => {
            const response = await fetch(url)
            const blob = await response.blob()
            // WhatsApp needs distinct filenames
            return new File([blob], `listing_${index}.jpg`, { type: "image/jpeg" })
        })

        const files = await Promise.all(filePromises)

        // C. Trigger Share
        await navigator.share({
          files: files,
          title: 'New Listing',
          text: shareText
        })
      } else {
        // Desktop Fallback
        window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank')
      }
    } catch (error) {
      console.log("Share cancelled", error)
    } finally {
      setSharingId(null)
    }
  }

  return (
    <div className="p-5 max-w-md mx-auto relative min-h-screen pb-24">
      
      {/* Header */}
      <div className="flex justify-between items-end mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Inventory</h1>
          <p className="text-slate-500 text-xs mt-1">Manage your active listings</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="bg-primary hover:bg-blue-200 text-primary-text p-3 rounded-full shadow-md active:scale-95 transition-transform"
        >
          <Plus size={20} strokeWidth={3} />
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative mb-6">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"><Search size={18} /></div>
        <input type="text" placeholder="Search address..." className="w-full bg-white border-none py-3 pl-10 pr-4 rounded-xl shadow-sm text-sm text-slate-700 focus:ring-2 focus:ring-primary outline-none" />
      </div>

      {/* Property List */}
      <div className="flex flex-col gap-4">
        {loading ? (
           <div className="text-center py-10 text-slate-400 text-sm">Loading...</div>
        ) : properties.length === 0 ? (
           <div className="text-center py-10 text-slate-400 text-sm">No properties. Click <b>+</b> to add.</div>
        ) : (
          properties.map((prop) => (
            <div key={prop.id} className="bg-white p-3 rounded-[1.5rem] shadow-sm border border-slate-100 relative group">
              
              {/* Image (Show Count Badge) */}
              <div className="relative h-40 w-full rounded-2xl overflow-hidden bg-slate-100 mb-3">
                <img src={prop.image_url} alt="Property" className="w-full h-full object-cover" />
                <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-[10px] font-bold shadow-sm bg-white/90 text-slate-700 backdrop-blur-sm">
                  {prop.status}
                </span>
                {/* Multi-Image Badge */}
                {prop.images && prop.images.length > 1 && (
                    <div className="absolute bottom-2 right-2 bg-black/60 text-white px-2 py-1 rounded-lg text-[10px] font-bold backdrop-blur-sm flex items-center gap-1">
                        <ImageIcon size={10} />
                        +{prop.images.length - 1}
                    </div>
                )}
              </div>

              {/* Info Row */}
              <div className="px-1 pb-1 flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-bold text-slate-800">{prop.price}</h3>
                  <div className="flex items-center gap-1.5 text-slate-500 mt-0.5">
                    <MapPin size={14} />
                    <span className="text-xs font-medium">{prop.address}</span>
                  </div>
                </div>

                {/* Share Button */}
                <button 
                  onClick={(e) => handleNativeShare(e, prop)}
                  disabled={sharingId === prop.id}
                  className="bg-green-50 text-green-600 p-3 rounded-full hover:bg-green-100 transition-colors active:scale-90"
                >
                  {sharingId === prop.id ? <Loader2 size={20} className="animate-spin" /> : <Share2 size={20} />}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* --- ADD PROPERTY MODAL --- */}
      {showModal && (
        <div className="fixed inset-0 z-[80] bg-black/30 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm rounded-[2rem] p-6 shadow-2xl animate-in slide-in-from-bottom-10 max-h-[90vh] overflow-y-auto">
            
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-slate-800">New Listing</h2>
              <button onClick={() => setShowModal(false)} className="bg-slate-100 p-2 rounded-full text-slate-500"><X size={20} /></button>
            </div>

            <div className="space-y-4">
              
              {/* 1. Multi-Photo Upload */}
              <div>
                <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full h-32 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-100 transition-colors relative overflow-hidden"
                >
                    <div className="text-center text-slate-400">
                        <div className="flex justify-center mb-2"><ImageIcon size={24} /></div>
                        <span className="text-xs font-bold uppercase">Add Photos (Select Multiple)</span>
                    </div>
                    <input 
                        type="file" 
                        multiple // <--- Key Change
                        ref={fileInputRef} 
                        onChange={handleFileSelect} 
                        accept="image/*" 
                        className="hidden" 
                    />
                </div>

                {/* Previews Horizontal Scroll */}
                {previews.length > 0 && (
                    <div className="flex gap-2 overflow-x-auto mt-3 pb-2">
                        {previews.map((src, index) => (
                            <div key={index} className="relative w-20 h-20 flex-shrink-0 rounded-xl overflow-hidden border border-slate-100">
                                <img src={src} className="w-full h-full object-cover" />
                                <button 
                                    onClick={() => removeFile(index)}
                                    className="absolute top-1 right-1 bg-black/50 text-white p-1 rounded-full"
                                >
                                    <X size={10} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
              </div>

              {/* 2. Address */}
              <div>
                <label className="text-[10px] font-bold text-slate-500 ml-2 block mb-1">Address</label>
                <input type="text" value={newProp.address} onChange={(e) => setNewProp({...newProp, address: e.target.value})} className="w-full bg-slate-50 py-3 px-4 rounded-xl text-slate-800 text-sm font-medium focus:ring-2 focus:ring-primary outline-none" placeholder="e.g. 123 Palm Springs" />
              </div>

              {/* 3. Price */}
              <div>
                <label className="text-[10px] font-bold text-slate-500 ml-2 block mb-1">Price</label>
                <input type="text" value={newProp.price} onChange={(e) => setNewProp({...newProp, price: e.target.value})} className="w-full bg-slate-50 py-3 px-4 rounded-xl text-slate-800 text-sm font-medium focus:ring-2 focus:ring-primary outline-none" placeholder="e.g. $1,250,000" />
              </div>

              {/* 4. Description */}
              <div>
                <label className="text-[10px] font-bold text-slate-500 ml-2 block mb-1">Details / Caption</label>
                <textarea 
                  rows={3}
                  value={newProp.description}
                  onChange={(e) => setNewProp({...newProp, description: e.target.value})}
                  className="w-full bg-slate-50 py-3 px-4 rounded-xl text-slate-800 text-sm focus:ring-2 focus:ring-primary outline-none resize-none"
                  placeholder="4 Bed, 3 Bath, Pool..."
                />
              </div>

              <button 
                onClick={handleAddProperty} 
                disabled={isSubmitting} 
                className="w-full bg-slate-900 text-white py-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2 mt-2 active:scale-95 transition-transform disabled:opacity-70"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Uploading {selectedFiles.length} photos...
                  </>
                ) : (
                  'Save to Inventory'
                )}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  )
}