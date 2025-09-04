document.getElementById("view-gallery-btn").addEventListener("click", async () => {
  const galleryDiv = document.getElementById("gallery-images");
  galleryDiv.innerHTML = "<div class='loading-spinner'>Loading...</div>";
  
  try {
    const response = await fetch(`https://debut-generic-banner-wma.trycloudflare.com/api/gallery-show?contentId=${window.contentId}&contentType=${window.contentType}`);
    

    console.log(window.contentId , window.contentType)
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const data = await response.json();
    
    if (data.error) {
      galleryDiv.innerHTML = `<div class="error">Error: ${data.error}</div>`;
      return;
    }
    
    if (!data.approved || !data.images?.length) {
      galleryDiv.innerHTML = `
        <div class="no-images">
          <p>No gallery images available for this content.</p>
          ${data.debug ? `<pre class="debug">${JSON.stringify(data.debug, null, 2)}</pre>` : ''}
        </div>
      `;
      return;
    }
    
    // Display images
    galleryDiv.innerHTML = data.images.map(img => `
      <div class="gallery-item">
        <img src="${img.url}" alt="${img.alt}" loading="lazy">
      </div>
    `).join('');
    
  } catch (error) {
    console.error("Gallery load failed:", error);
    galleryDiv.innerHTML = `
      <div class="error">
        Failed to load gallery. Please try again later.
        <button onclick="window.location.reload()">Retry</button>
      </div>
    `;
  }
});