import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { user } from '@/lib/schema';
import { eq } from 'drizzle-orm';

// 1. VERIFY WEBHOOK (Meta calls this once to confirm ownership)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  const MY_VERIFY_TOKEN = 'adrolls_secret_123'; 

  if (mode && token) {
    if (mode === 'subscribe' && token === MY_VERIFY_TOKEN) {
      console.log('✅ Webhook Verified!');
      return new NextResponse(challenge, { status: 200 }); 
    } else {
      return new NextResponse('Forbidden', { status: 403 });
    }
  }

  return new NextResponse('Bad Request', { status: 400 });
}

// 2. RECEIVE & REPLY
export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Check if this is a WhatsApp message event
    if (body.object === 'whatsapp_business_account') {
      const entry = body.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;

      if (value?.messages) {
        const message = value.messages[0];
        const senderPhone = message.from; 
        const textBody = message.text?.body;
        
        // IDs needed for lookup and reply
        const wabaId = entry.id; 
        const phoneNumberId = value.metadata.phone_number_id; 

        console.log(`📩 Message from ${senderPhone}: ${textBody}`);

        // 1. Find the User who owns this Business Account (WABA)
        const [owner] = await db.select()
            .from(user)
            .where(eq(user.whatsappBusinessId, wabaId))
            .limit(1);

        if (owner && owner.whatsappAccessToken) {
            console.log("👤 Owner Found:", owner.businessName);
            
            // 2. Send a Reply (Echo for now)
            await replyToWhatsApp(
                owner.whatsappAccessToken, 
                phoneNumberId, 
                senderPhone, 
                `Hello! I received: "${textBody}" \n\n(AI Agent coming soon!)`
            );
        } else {
            console.log("⚠️ No owner found for WABA:", wabaId);
        }
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Not a WhatsApp event' }, { status: 404 });

  } catch (error) {
    console.error('Webhook Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// --- Utility Function to Call Graph API ---
async function replyToWhatsApp(token: string, phoneId: string, to: string, text: string) {
    try {
        const res = await fetch(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                messaging_product: "whatsapp",
                to: to,
                text: { body: text }
            })
        });
        
        const data = await res.json();
        if (data.error) {
            console.error("❌ Reply Failed:", data.error);
        } else {
            console.log("✅ Reply Sent!");
        }
    } catch (e) {
        console.error("Network Error sending reply", e);
    }
}