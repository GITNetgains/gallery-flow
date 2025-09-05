document.addEventListener("DOMContentLoaded", function() {
  const modalOverlay = document.getElementById("upload-gallery-modal-overlay");
  const modalContainer = document.getElementById("upload-gallery-modal-container");
  const closeModalBtn = document.getElementById("close-upload-gallery-modal");
  const uploadButton = document.getElementById("upload-gallery-button");
  const form = document.getElementById("upload-gallery-form");
  const message = document.getElementById("upload-gallery-message");
  const loginModalContainer = document.getElementById("login-modal-container");
  const typeSelect = document.getElementById("upload-type");
  const eventSelect = document.getElementById("upload-event");

  let allItems = [];

  if (modalOverlay) {
    document.body.appendChild(modalOverlay);
  }

  waitForTokenAndPopulate();
  fetchAllItems();

  function closeUploadModal() {
    if (modalOverlay) modalOverlay.style.display = "none";
    if (modalContainer) modalContainer.style.display = "none";
  }

  uploadButton?.addEventListener("click", function() {
    const token = localStorage.getItem("customertoken");
    if (token) {
      if (modalContainer) modalContainer.style.display = "block";
      if (modalOverlay) modalOverlay.style.display = "block";
    } else {
      if (loginModalContainer) loginModalContainer.style.display = "block";
    }
  });

  closeModalBtn?.addEventListener("click", closeUploadModal);

  form?.addEventListener("submit", async function(e) {
    e.preventDefault();
    message.textContent = "";
    message.classList.remove("Polaris-Text--success", "Polaris-Text--critical");

    const formData = new FormData(form);

    try {
      const res = await fetch("https://gallery-flow-two.vercel.app/api/gallery", {
        method: "POST",
        body: formData,
      });

      const json = await res.json();

      if (json.success) {
        message.textContent = json.message || "Your request is in process.";
        message.classList.add("Polaris-Text--success");
        form.reset();

        setTimeout(() => {
          closeUploadModal();
        }, 2000);
      } else {
        message.textContent = json.error || "Something went wrong.";
        message.classList.add("Polaris-Text--critical");
      }
    } catch (error) {
      console.error("Upload error:", error);
      message.textContent = "An error occurred. Please try again.";
      message.classList.add("Polaris-Text--critical");
    }
  });

  async function waitForTokenAndPopulate() {
    let token = localStorage.getItem("customertoken");
    const maxAttempts = 10;
    let attempts = 0;

    while (!token && attempts < maxAttempts) {
      await new Promise(res => setTimeout(res, 500));
      token = localStorage.getItem("customertoken");
      attempts++;
    }

    if (token) {
      console.log("Token detected by polling. Populating customer fields.");
      populateCustomerFieldsFromToken();
    } else {
      console.warn("Token not found after polling.");
    }
  }

  async function populateCustomerFieldsFromToken() {
    let token = localStorage.getItem("customertoken");
    const query = `
      {
        customer(customerAccessToken: "${token}") {
          id
          firstName
          lastName
          email
        }
      }
    `;

    try {
      const res = await fetch("https://netgains28.myshopify.com/api/2025-04/graphql.json", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Storefront-Access-Token": "e667bc10b211d8bc9d30c62d919ba267",
        },
        body: JSON.stringify({ query }),
      });

      const json = await res.json();

      if (json.data && json.data.customer) {
        const customer = json.data.customer;
        document.getElementById("upload-customer-id").value = customer.id;
        document.getElementById("upload-customer-name").value = `${customer.firstName} ${customer.lastName}`;
        document.getElementById("upload-customer-email").value = customer.email;

        console.log("✅ Customer fields populated:", customer);
      } else {
        console.error("Customer not found or invalid token", json);
      }
    } catch (error) {
      console.error("Error fetching customer details", error);
    }
  }

  async function fetchAllItems() {
    try {
      const res = await fetch("https://gallery-flow-two.vercel.app/api/gallery");
      const json = await res.json();

      if (!json.success) {
        console.error("API failed:", json);
        return;
      }

      if (json.disabled) {
        // When button disabled → store all products, blogs, collections, pages
        allItems = [
          ...json.products.map(p => ({ id: p.id, name: p.title, type: "product" })),
          ...json.blogs.flatMap(b =>
            b.articles.map(a => ({ id: a.id, name: `${b.title} - ${a.title}`, type: "article" }))
          ),
          ...json.collections.map(c => ({ id: c.id, name: c.title, type: "collection" })),
          ...json.pages.map(p => ({ id: p.id, name: p.title, type: "page" })),
        ];
      } else {
        // When button enabled → only events
        allItems = json.events.map(ev => ({
          id: ev.id,
          name: ev.name,
          date: ev.date,
          type: ev.type,
        }));
      }

      console.log("✅ Loaded items:", allItems);
    } catch (error) {
      console.error("Error fetching items:", error);
    }
  }

  typeSelect?.addEventListener("change", function() {
    const selectedType = this.value;

    if (!selectedType) {
      eventSelect.innerHTML = '<option value="">Select</option>';
      return;
    }

    const filtered = allItems.filter(item => item.type === selectedType);
    populateEventDropdown(filtered);
  });

  function populateEventDropdown(items) {
    eventSelect.innerHTML = '<option value="">Select</option>';

    items.forEach(item => {
      const option = document.createElement("option");
      option.value = item.id;
      option.textContent = item.name + (item.date ? ` (${new Date(item.date).toLocaleDateString()})` : "");
      eventSelect.appendChild(option);
    });
  }
});
