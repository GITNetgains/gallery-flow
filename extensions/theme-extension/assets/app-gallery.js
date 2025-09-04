document.addEventListener("DOMContentLoaded", async function() {
  const uploadButton = document.getElementById("upload-gallery-button");
  const loginModalContainer = document.getElementById("login-modal-container");
  const uploadGalleryModalContainer = document.getElementById("upload-gallery-modal-container");
  const galleriesContainer = document.getElementById("approved-galleries-container");
  const typeFilterContainer = document.getElementById("type-filter-container");

  // Modal open logic
  if (uploadButton) {
    uploadButton.addEventListener("click", function() {
      const token = localStorage.getItem('customertoken');
      if (token) {
        uploadGalleryModalContainer.style.display = "block";
      } else {
        loginModalContainer.style.display = "block";
      }
    });
  }

  try {
    // Fetch all approved images from your API
    const res = await fetch("https://thin-sir-jersey-use.trycloudflare.com/api/galleries");
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
      imageEl.src = `https://thin-sir-jersey-use.trycloudflare.com${img.url}`;
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
