// utils/social-api.ts

// --- FACEBOOK ---
export async function postToFacebook(accessToken: string, imageUrl: string, caption: string) {
    const url = `https://graph.facebook.com/v19.0/me/photos?access_token=${accessToken}&url=${encodeURIComponent(imageUrl)}&message=${encodeURIComponent(caption)}&published=true`;
    
    const res = await fetch(url, { method: 'POST' });
    const data = await res.json();
  
    if (data.error) throw new Error(`Facebook Error: ${data.error.message}`);
    return data;
  }
  
  // --- INSTAGRAM ---
  export async function postToInstagram(accessToken: string, pageId: string, imageUrl: string, caption: string) {
    // 1. Get Instagram Business Account ID
    const accountRes = await fetch(`https://graph.facebook.com/v19.0/${pageId}?fields=instagram_business_account&access_token=${accessToken}`);
    const accountData = await accountRes.json();
    
    if (!accountData.instagram_business_account?.id) {
      throw new Error("No Instagram Business Account linked to this Facebook Page.");
    }
    const igUserId = accountData.instagram_business_account.id;
  
    // 2. Create Media Container
    const containerUrl = `https://graph.facebook.com/v19.0/${igUserId}/media?image_url=${encodeURIComponent(imageUrl)}&caption=${encodeURIComponent(caption)}&access_token=${accessToken}`;
    const containerRes = await fetch(containerUrl, { method: 'POST' });
    const containerData = await containerRes.json();
  
    if (containerData.error) throw new Error(`IG Container Error: ${containerData.error.message}`);
    const creationId = containerData.id;
  
    // 3. Publish Media
    const publishUrl = `https://graph.facebook.com/v19.0/${igUserId}/media_publish?creation_id=${creationId}&access_token=${accessToken}`;
    const publishRes = await fetch(publishUrl, { method: 'POST' });
    const publishData = await publishRes.json();
  
    if (publishData.error) throw new Error(`IG Publish Error: ${publishData.error.message}`);
    
    return publishData;
  }
  
  // --- LINKEDIN ---
  export async function postToLinkedIn(accessToken: string, imageUrl: string, caption: string) {
    // 1. Get User URN (Profile ID)
    const userRes = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    const userData = await userRes.json();
    if (!userData.sub) throw new Error("Could not fetch LinkedIn User ID");
    const personUrn = `urn:li:person:${userData.sub}`;
  
    // 2. Register Upload
    const registerBody = {
      "registerUploadRequest": {
        "recipes": ["urn:li:digitalmediaRecipe:feedshare-image"],
        "owner": personUrn,
        "serviceRelationships": [{ "relationshipType": "OWNER", "identifier": "urn:li:userGeneratedContent" }]
      }
    };
    
    const regRes = await fetch('https://api.linkedin.com/v2/assets?action=registerUpload', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(registerBody)
    });
    const regData = await regRes.json();
    if (regData.error) throw new Error("LinkedIn Register Upload Failed");
  
    const uploadUrl = regData.value.uploadMechanism["com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"].uploadUrl;
    const assetUrn = regData.value.asset;
  
    // 3. Download Image & Upload to LinkedIn
    const imageBlob = await fetch(imageUrl).then(r => r.blob());
    
    await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${accessToken}` }, // Binary upload usually doesn't need content-type if raw
      body: imageBlob
    });
  
    // 4. Create Post
    const postBody = {
      "author": personUrn,
      "lifecycleState": "PUBLISHED",
      "specificContent": {
        "com.linkedin.ugc.ShareContent": {
          "shareCommentary": { "text": caption },
          "shareMediaCategory": "IMAGE",
          "media": [{
            "status": "READY",
            "description": { "text": "Image" },
            "media": assetUrn,
            "title": { "text": "Shared Image" }
          }]
        }
      },
      "visibility": { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" }
    };
  
    const postRes = await fetch('https://api.linkedin.com/v2/ugcPosts', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(postBody)
    });
    
    const postData = await postRes.json();
    if (postData.id) return postData;
    throw new Error(`LinkedIn Post Failed: ${JSON.stringify(postData)}`);
  }