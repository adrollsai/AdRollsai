import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function POST(request: Request) {
  console.log("--- API/CHAT DEBUG START ---")
  
  try {
    // 1. Check Auth
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      console.log("Auth Failed: No user")
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Inspect Incoming Data
    const body = await request.json()
    
    // LOGGING EXACTLY WHAT FRONTEND SENT
    console.log("Received Body Keys:", Object.keys(body))
    console.log("User Instructions:", body.userInstructions)
    console.log("Prop Desc:", body.propertyDescription ? "Present" : "Missing")
    console.log("Images Count:", body.imageUrls?.length)
    console.log("Aspect Ratio:", body.aspectRatio)

    // 3. Check n8n URL
    const webhookUrl = process.env.N8N_WEBHOOK_URL
    if (!webhookUrl) {
      throw new Error("Missing N8N_WEBHOOK_URL in .env.local")
    }

    // 4. Send to n8n
    console.log(`Sending to n8n (${webhookUrl})...`)
    
    const n8nResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: user.id,
        userEmail: user.email,
        
        // Passing the Creative Ingredients
        userInstructions: body.userInstructions || "",
        propertyDescription: body.propertyDescription || "",
        propertyTitle: body.propertyTitle || "",
        contactNumber: body.contactNumber || "",
        businessName: body.businessName || "",
        
        // Technical Specs
        mode: body.mode,
        imageUrls: body.imageUrls || [],
        aspectRatio: body.aspectRatio || "1:1"
      }),
    })

    // 5. Handle n8n Response safely
    console.log("n8n HTTP Status:", n8nResponse.status)
    
    const responseText = await n8nResponse.text()
    console.log("n8n Raw Response:", responseText) // <--- THIS IS THE KEY TO THE ERROR

    if (!n8nResponse.ok) {
      throw new Error(`n8n Error: ${n8nResponse.status} - ${responseText}`)
    }

    // Parse JSON only if successful
    let data
    try {
      data = JSON.parse(responseText)
    } catch (e) {
      // If n8n returns just "Workflow started" (text), we handle it
      data = { message: responseText, taskId: responseText } // Fallback
    }

    console.log("--- API/CHAT DEBUG END (Success) ---")
    return NextResponse.json(data)

  } catch (error: any) {
    console.error("!!! API CRASHED !!!")
    console.error(error)
    return NextResponse.json(
      { error: error.message || "Internal Server Error" }, 
      { status: 500 }
    )
  }
}