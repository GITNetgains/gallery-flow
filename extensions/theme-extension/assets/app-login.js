document.addEventListener("DOMContentLoaded", function() {
  const loginModalContainer = document.getElementById("login-modal-container");
  const loginModalOverlay = document.getElementById("login-modal-overlay");
  const closeModalBtn = document.getElementById("close-login-modal");
  const loginSubmitBtn = document.getElementById("login-submit");
  const loginEmailInput = document.getElementById("login-email");
  const loginPasswordInput = document.getElementById("login-password");
  const loginError = document.getElementById("login-error");
  const loginSuccess = document.getElementById("login-success");

  // ✅ Values injected from Liquid
  const shopDomain = window.shopDomain;
  const storefrontToken = window.storefrontToken;

  if (loginModalContainer) {
    document.body.appendChild(loginModalContainer);
  }

  function closeLoginModal() {
    if (loginModalOverlay) loginModalOverlay.style.display = "none";
    if (loginModalContainer) loginModalContainer.style.display = "none";
  }

  closeModalBtn?.addEventListener("click", closeLoginModal);

  loginSubmitBtn?.addEventListener("click", async function() {
    const email = loginEmailInput.value.trim();
    const password = loginPasswordInput.value.trim();

    loginError.style.display = "none";
    loginSuccess.style.display = "none";

    if (!email || !password) {
      loginError.textContent = "Please enter email and password.";
      loginError.style.display = "block";
      return;
    }

    const query = `
      mutation customerAccessTokenCreate($input: CustomerAccessTokenCreateInput!) {
        customerAccessTokenCreate(input: $input) {
          customerAccessToken {
            accessToken
            expiresAt
          }
          customerUserErrors {
            code
            field
            message
          }
        }
      }
    `;

    const variables = { input: { email, password } };

    try {
      const res = await fetch(`https://${shopDomain}/api/2025-04/graphql.json`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Storefront-Access-Token": storefrontToken,
        },
        body: JSON.stringify({ query, variables }),
      });

      const json = await res.json();
      const data = json.data?.customerAccessTokenCreate;

      if (data?.customerUserErrors?.length) {
        loginError.textContent = data.customerUserErrors[0].message;
        loginError.style.display = "block";
      } else {
        const token = data.customerAccessToken.accessToken;
        localStorage.setItem("customertoken", token);
        loginSuccess.style.display = "block";

        setTimeout(() => {
          closeLoginModal();
          const loginEvent = new CustomEvent("loginSuccess", { detail: { email } });
          document.dispatchEvent(loginEvent);
        }, 1000);
      }
    } catch (error) {
      console.error("Login error:", error);
      loginError.textContent = "An error occurred. Please try again.";
      loginError.style.display = "block";
    }
  });
});
