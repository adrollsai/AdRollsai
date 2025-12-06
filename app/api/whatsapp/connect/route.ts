// --- app/api/whatsapp/connect/route.ts ---

import { NextResponse } from 'next/server';

// --- Configuration and Constants ---
// CRITICAL FIX: Mapping the .env.local variables you showed to the code's constants.
const APP_ID = process.env.NEXT_PUBLIC_META_APP_ID || process.env.FACEBOOK_CLIENT_ID;
const APP_SECRET = process.env.FACEBOOK_CLIENT_SECRET; // This must match your secret name!

const META_GRAPH_VERSION = 'v19.0'; 
const META_GRAPH_URL = `https://graph.facebook.com/${META_GRAPH_VERSION}/`;

// --- Type Definitions ---

interface RequestBody {
  accessToken: string;
  fbUserId: string;
}

interface MetaError {
    message: string;
    code: number;
    type: string;
}

interface WabaAccount {
  id: string;
}

// --- Helper Functions ---

/**
 * Exchanges a short-lived access token for a long-lived one.
 */
async function exchangeTokenForLongLived(shortLivedToken: string): Promise<string> {
    if (!APP_ID || !APP_SECRET) {
        // This check throws the specific error you saw in the screenshot
        throw new Error("Configuration Error: Missing Meta App ID or Secret in environment variables.");
    }

    const exchangeUrl = `${META_GRAPH_URL}oauth/access_token?` + 
                        `grant_type=fb_exchange_token&` +
                        `client_id=${APP_ID}&` +
                        `client_secret=${APP_SECRET}&` +
                        `fb_exchange_token=${shortLivedToken}`;

    const res = await fetch(exchangeUrl);
    const data: any = await res.json();

    if (data.error) {
        throw new Error(`Token Exchange Failed: (#${data.error.code}) ${data.error.message}`);
    }

    return data.access_token;
}

// --- Route Handler ---

export async function POST(request: Request) {
  let longLivedToken: string;
  
  try {
    const { accessToken: shortLivedToken, fbUserId }: RequestBody = await request.json();

    if (!shortLivedToken || !fbUserId) {
      return NextResponse.json({ error: 'Missing access token or user ID.' }, { status: 400 });
    }

    // 1. Token Exchange: Secure a long-lived token
    longLivedToken = await exchangeTokenForLongLived(shortLivedToken);
    console.log("Token exchanged successfully for a long-lived token.");


    // 2. Step 1: Get the Business Manager ID connected to the User
    console.log("Step 1: Fetching linked Business Managers...");
    
    // Query the 'businesses' edge on the User node
    const businessesEndpoint = `${META_GRAPH_URL}${fbUserId}/businesses?access_token=${longLivedToken}`;
    
    const businessesRes = await fetch(businessesEndpoint);
    const businessesData: { data: { id: string }[], error?: MetaError } = await businessesRes.json();
    
    if (businessesData.error) {
      throw new Error(`Meta Business Error: (#${businessesData.error.code}) ${businessesData.error.message}`);
    }

    const business = businessesData.data?.[0]; 
    if (!business || !business.id) {
      throw new Error('No Meta Business Manager found connected after signup. User may have canceled or denied permissions.');
    }

    const businessId: string = business.id;
    console.log(`Found Business ID: ${businessId}`);


    // 3. Step 2: Use the Business ID to find the connected WABA ID
    console.log("Step 2: Fetching WABA ID from the Business Manager...");

    // Query the 'client_whatsapp_business_accounts' edge on the Business node
    const wabaEndpoint = `${META_GRAPH_URL}${businessId}/client_whatsapp_business_accounts?access_token=${longLivedToken}`;

    const wabaRes = await fetch(wabaEndpoint);

    const wabaData: { data: WabaAccount[], error?: MetaError } = await wabaRes.json();

    if (wabaData.error) {
       throw new Error(`Meta WABA Error: (#${wabaData.error.code}) ${wabaData.error.message}`);
    }

    const wabaAccount = wabaData.data?.[0];
    if (!wabaAccount || !wabaAccount.id) {
      throw new Error('No WhatsApp Business Account found linked to the Business Manager.');
    }

    const wabaId: string = wabaAccount.id;
    console.log(`Found WABA ID: ${wabaId}`);
    
    // --- 4. Database/Credential Saving (YOUR CUSTOM LOGIC GOES HERE) ---
    
    // Save the final credentials to your database:
    // { wabaId, businessId, longLivedToken, fbUserId }
    // Example: await db.saveCredentials({ wabaId, businessId, token: longLivedToken, userId: fbUserId });

    // --- Final Success Response ---
    return NextResponse.json({ 
        success: true, 
        message: "WhatsApp connected successfully.",
        wabaId: wabaId,
        businessId: businessId,
    }, { status: 200 });

  } catch (error: any) {
    console.error('WhatsApp Connection Handler Error:', error.message);
    
    // Return a descriptive error message to the frontend
    return NextResponse.json({ 
        error: error.message || "An unknown error occurred during connection. Check server logs.",
    }, { status: 500 });
  }
}