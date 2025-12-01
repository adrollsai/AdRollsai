import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function POST(request: Request) {
  try {
    // 1. Validate User
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Get the Requirement Data
    const body = await request.json()
    const { requirementId, title, location, budget, propertyType } = body

    if (!requirementId) {
      return NextResponse.json({ error: 'Missing requirement ID' }, { status: 400 })
    }

    // 3. Prepare Payload for n8n
    const agentPayload = {
      userId: user.id,
      userEmail: user.email,
      requirementId: requirementId,
      searchQuery: `"${location}" "${propertyType}" ${title} price ${budget}`, // Pre-formatted search string
      filters: {
        location: location,
        minBudget: budget?.split('-')[0]?.trim(),
        maxBudget: budget?.split('-')[1]?.trim(),
      }
    }

    // 4. Send to n8n Webhook (Fire and Forget)
    // We don't await this if we want the UI to be fast, but for reliability/logging we often await a simple "Received" ack.
    const n8nUrl = process.env.N8N_AGENT_HUNT_WEBHOOK_URL
    
    if (n8nUrl) {
        console.log("🚀 Triggering Agent Hunt for:", title)
        // We trigger this without 'await' blocking the user response heavily, 
        // OR we await it just to ensure n8n got the message.
        await fetch(n8nUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(agentPayload)
        })
    } else {
        console.warn("⚠️ No N8N_AGENT_HUNT_WEBHOOK_URL set. Agent will not run.")
    }

    return NextResponse.json({ success: true, message: 'Agent dispatched' })

  } catch (error: any) {
    console.error("Agent Hunt Error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}