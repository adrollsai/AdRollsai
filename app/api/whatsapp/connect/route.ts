import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { db } from '@/lib/db';
import { user } from '@/lib/schema';
import { eq } from 'drizzle-orm';

export async function POST(request: Request) {
  // 1. Authenticate the user (Your App Login)
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { accessToken, fbUserId } = body;

  if (!accessToken) return NextResponse.json({ error: "Missing Access Token" }, { status: 400 });

  try {
    // 2. Fetch WhatsApp Business Accounts linked to this user
    // We query the Graph API to find what they just set up
    const businessesRes = await fetch(`https://graph.facebook.com/v19.0/me/businesses?access_token=${accessToken}`);
    const businessesData = await businessesRes.json();

    // 3. Find the Phone Number
    // Note: In a real production app, you might want to show a dropdown if they have multiple.
    // For "Super Simple" mode, we try to grab the first valid WhatsApp Phone Number we find.
    
    let wabaId = null;
    let phoneId = null;

    // A. Check for shared WABA (Embedded Signup usually shares it directly)
    const wabaRes = await fetch(`https://graph.facebook.com/v19.0/me?fields=whatsapp_business_accounts&access_token=${accessToken}`);
    const wabaData = await wabaRes.json();

    if (wabaData.whatsapp_business_accounts?.data?.length > 0) {
        const account = wabaData.whatsapp_business_accounts.data[0];
        wabaId = account.id;

        // B. Get Phone Number ID from this WABA
        const phoneRes = await fetch(`https://graph.facebook.com/v19.0/${wabaId}/phone_numbers?access_token=${accessToken}`);
        const phoneData = await phoneRes.json();

        if (phoneData.data?.length > 0) {
            phoneId = phoneData.data[0].id;
        }
    }

    if (!wabaId || !phoneId) {
        return NextResponse.json({ error: "Could not find a WhatsApp Business Account or Phone Number. Did you complete the popup?" }, { status: 400 });
    }

    // 4. Save to Database
    await db.update(user).set({
        whatsappAccessToken: accessToken, // Note: This is a short-lived user token. For production, exchange for System User token.
        whatsappBusinessId: wabaId,
        whatsappPhoneId: phoneId
    }).where(eq(user.id, session.user.id));

    return NextResponse.json({ success: true, wabaId, phoneId });

  } catch (error: any) {
    console.error("WhatsApp Link Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}