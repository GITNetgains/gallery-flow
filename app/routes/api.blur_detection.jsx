import { json } from '@remix-run/node';




// shopifyApiUtils.js - Server-side version
export async function detectBlur(imageUrl, threshold = 100) {
  try {
    // Use a proper image processing library like Sharp
    const response = await fetch(imageUrl);
    const buffer = await response.arrayBuffer();
    
    // Process with Sharp or similar
    const stats = await analyzeImage(buffer); 
    
    return {
      isBlurry: stats.blurScore < threshold,
      score: stats.blurScore,
      threshold,
      status: 'success'
    };
  } catch (error) {
    return {
      error: error.message,
      isBlurry: false,
      score: 0,
      threshold,
      status: 'error'
    };
  }
}
export const action = async ({ request }) => {
  const { imageUrl, threshold = 100 } = await request.json();
  
  if (!imageUrl) {
    return json({ 
      error: 'Image URL is required',
      isBlurry: false,
      score: 0,
      threshold,
      status: 'error'
    }, { status: 400 });
  }

  try {
    const result = await detectBlur(imageUrl, threshold);
    return json(result);
  } catch (error) {
    return json({
      error: error.message || 'Unknown error',
      isBlurry: false,
      score: 0,
      threshold,
      status: 'error'
    }, { status: 500 });
  }
};