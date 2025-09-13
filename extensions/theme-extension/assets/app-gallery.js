document.addEventListener("DOMContentLoaded", async function() {
  const uploadButton = document.getElementById("upload-gallery-button");
  const uploadGalleryModalContainer = document.getElementById("upload-gallery-modal-container");
  const galleriesContainer = document.getElementById("approved-galleries-container");
  const typeFilterContainer = document.getElementById("type-filter-container");

  // Modal open logic
  if (uploadButton) {
    uploadButton.addEventListener("click", function() {
      // Check if Shopify says customer is logged in
      if (window.Shopify && window.Shopify.customer && window.Shopify.customer.id) {
        // Customer is logged in → open upload modal
        uploadGalleryModalContainer.style.display = "block";
      } else {
        // Customer is NOT logged in → redirect to login page
        window.location.href = "/account/login";
      }
    });
  }

  try {
    // Fetch all approved images from your API
    const res = await fetch("https://gallery-flow-two.vercel.app/api/galleries");
    const data = await res.json();

    const images = data.images || [];

    // Remove filter container since no filtering needed
    if (typeFilterContainer) {
      typeFilterContainer.style.display = "none";
    }

    // Render all images
    renderImages(images);

  } catch (error) {
    console.error("Error fetching data:", error);
    galleriesContainer.innerHTML = "<p>Error loading images.</p>";
  }

  function renderImages(images) {
    galleriesContainer.innerHTML = "";
    if (images.length === 0) {
      galleriesContainer.innerHTML = "<p>No approved images found.</p>";
      return;
    }

    images.forEach((img) => {
      const imageEl = document.createElement("img");
      imageEl.src = `https://gallery-flow-two.vercel.app${img.url}`;
      imageEl.alt = `Uploaded image ${img.id}`;
      imageEl.style.width = "100%";
      imageEl.style.borderRadius = "8px";
      imageEl.style.boxShadow = "0 1px 3px rgba(0,0,0,0.2)";
      imageEl.style.maxWidth = "300px";
      imageEl.style.minWidth = "250px";
      galleriesContainer.appendChild(imageEl);
    });
  }
});
