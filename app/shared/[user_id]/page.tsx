'use client'

import { useState, useEffect } from 'react'
import { useParams, useSearchParams, usePathname } from 'next/navigation'
import { MapPin, Phone, Loader2, Image as ImageIcon, AlertCircle } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'

// --- Helper for Price Parsing ---
const parsePrice = (priceStr: string | null) => {
  if (!priceStr) return 0
  const numbersOnly = priceStr.replace(/[^0-9]/g, '')
  return parseInt(numbersOnly || '0')
}

type Property = {
  id: string
  title: string
  address: string
  price: string
  status: string
  image_url: string
  images: string[]
  description?: string
}

export default function PublicInventoryPage() {
  const params = useParams()
  const pathname = usePathname() // Fallback method
  const searchParams = useSearchParams()

  const minQuery = searchParams.get('min')
  const maxQuery = searchParams.get('max')
  const qQuery = searchParams.get('q')

  const supabase = createClient()
  const [properties, setProperties] = useState<Property[]>([])
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<any>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // --- BULLETPROOF ID EXTRACTION ---
  const getSafeUserId = () => {
    // Method 1: Standard useParams (Try 'userId' OR 'id')
    if (params?.userId) return params.userId as string
    if (params?.id) return params.id as string
    
    // Method 2: Any first parameter found
    if (params && Object.keys(params).length > 0) {
        return Object.values(params)[0] as string
    }

    // Method 3: Brute Force from URL path (works if hooks fail)
    // URL is usually /shared/<USER_ID>
    if (pathname) {
        const segments = pathname.split('/')
        // Find the segment after 'shared'
        const sharedIndex = segments.indexOf('shared')
        if (sharedIndex !== -1 && segments[sharedIndex + 1]) {
            return segments[sharedIndex + 1]
        }
    }
    return null
  }

  useEffect(() => {
    const userId = getSafeUserId()

    // 1. Initial Validation
    if (!userId) {
        // Only show error if we've waited a bit and still have nothing
        const timer = setTimeout(() => {
             if (loading) {
                 console.error("ID Extraction Failed. Params:", params, "Path:", pathname)
                 setErrorMsg("Invalid Page Link (No ID found)")
                 setLoading(false)
             }
        }, 500)
        return () => clearTimeout(timer)
    }

    // 2. UUID Validation
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(userId)) {
        console.error("Bad ID format:", userId)
        setErrorMsg("Invalid Page Link (Bad ID)")
        setLoading(false)
        return
    }

    const fetchData = async () => {
      try {
        console.log("--- FETCHING FOR USER ID:", userId)

        // A. Fetch Profile
        const { data: profileData } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single()
        
        if (profileData) setProfile(profileData)

        // B. Fetch Properties
        const { data: props, error } = await supabase
            .from('properties')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })

        if (error) throw error

        if (props) {
            setProperties(props)
        }
      } catch (err: any) {
          console.error("Fetch Error:", err)
          setErrorMsg("Failed to load inventory.")
      } finally {
          setLoading(false)
      }
    }

    fetchData()
  }, [params, pathname]) // Re-run if params or path changes

  // --- FILTER LOGIC ---
  const minPrice = minQuery ? parseInt(minQuery) : 0
  const maxPrice = maxQuery ? parseInt(maxQuery) : Infinity
  const searchTerm = (qQuery || '').toLowerCase()

  const filteredProperties = properties.filter(p => {
    const priceVal = parsePrice(p.price)
    const isActive = p.status?.toLowerCase() === 'active'
    
    const matchesPrice = priceVal >= minPrice && priceVal <= maxPrice
    const matchesSearch = p.title?.toLowerCase().includes(searchTerm) || 
                          p.address?.toLowerCase().includes(searchTerm)
    
    // NOTE: Currently showing ALL statuses for debugging. 
    // Add `&& isActive` to hide drafts.
    return matchesPrice && matchesSearch
  })

  // --- RENDER STATES ---

  if (loading) return (
    <div className="flex h-screen items-center justify-center text-slate-400 bg-slate-50">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="animate-spin" size={32} />
        <p className="text-xs font-medium">Loading inventory...</p>
      </div>
    </div>
  )

  if (errorMsg) return (
    <div className="flex h-screen items-center justify-center text-slate-400 bg-slate-50">
        <div className="flex flex-col items-center gap-2">
            <AlertCircle size={32} className="text-red-300" />
            <p className="text-sm">{errorMsg}</p>
        </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      
      {/* BRANDING HEADER */}
      <div className="bg-white p-6 shadow-sm mb-6 border-b border-slate-100">
        <div className="max-w-md mx-auto flex items-center gap-4">
          {profile?.logo_url ? (
            <img src={profile.logo_url} className="w-16 h-16 rounded-full object-cover border border-slate-100" alt="Logo" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xl">
              {profile?.business_name?.[0] || 'P'}
            </div>
          )}
          <div>
            <h1 className="text-xl font-bold text-slate-900">{profile?.business_name || 'Portfolio'}</h1>
            {profile?.contact_number && (
              <a href={`tel:${profile.contact_number}`} className="flex items-center gap-1.5 text-slate-500 text-xs mt-1 hover:text-blue-600">
                <Phone size={12} /> {profile.contact_number}
              </a>
            )}
          </div>
        </div>
      </div>

      {/* LISTINGS */}
      <div className="max-w-md mx-auto px-5 space-y-4">
        <div className="flex justify-between items-end mb-2">
           <h2 className="font-bold text-slate-700">Available Properties</h2>
           <span className="text-xs text-slate-400">{filteredProperties.length} found</span>
        </div>

        {filteredProperties.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-sm bg-white rounded-[1.5rem] border border-dashed border-slate-200">
            <p>No properties match this filter.</p>
            {(minPrice > 0 || maxPrice < Infinity) && (
                <div className="inline-block mt-3 px-3 py-1.5 bg-slate-50 rounded-lg text-[10px] font-mono text-slate-500">
                    Filter: {minPrice.toLocaleString()} - {maxPrice === Infinity ? '∞' : maxPrice.toLocaleString()}
                </div>
            )}
          </div>
        ) : (
          filteredProperties.map((prop) => (
            <div key={prop.id} className="bg-white p-3 rounded-[1.5rem] shadow-sm border border-slate-100 group">
              <div className="relative h-48 w-full rounded-2xl overflow-hidden bg-slate-100 mb-3">
                <img src={prop.image_url} alt="Property" className="w-full h-full object-cover" />
                <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-[10px] font-bold shadow-sm bg-white/90 text-slate-700 backdrop-blur-sm">
                  {prop.price}
                </span>
                {prop.images && prop.images.length > 1 && (
                    <div className="absolute bottom-2 right-2 bg-black/60 text-white px-2 py-1 rounded-lg text-[10px] font-bold backdrop-blur-sm flex items-center gap-1">
                        <ImageIcon size={10} /> +{prop.images.length - 1}
                    </div>
                )}
              </div>
              <div className="px-1">
                <h3 className="text-lg font-bold text-slate-800">{prop.title}</h3>
                <div className="flex items-center gap-1.5 text-slate-500 mt-1 mb-2">
                  <MapPin size={14} />
                  <span className="text-xs font-medium truncate">{prop.address}</span>
                </div>
                {prop.description && (
                  <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed mb-3">
                    {prop.description}
                  </p>
                )}
                <a 
                  href={`https://wa.me/${profile?.contact_number?.replace(/[^0-9]/g,'')}?text=I'm interested in ${prop.title}`}
                  target="_blank"
                  className="block w-full text-center bg-slate-900 text-white py-3 rounded-xl text-xs font-bold hover:opacity-90 active:scale-95 transition-all"
                >
                  Contact Agent
                </a>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}