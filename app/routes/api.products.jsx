import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { fetchProducts } from "../shopifyApiUtils"; // or whichever function you want to test

export async function loader({ request }) {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const accessToken = session.accessToken;

  try {
    // 🧩 Change this line to test other functions like fetchCollections, fetchBlogs, etc.
    const products = await fetchProducts(shop, accessToken);

    return json({
      success: true,
      count: products.length,
      products: products.slice(0, 5), // show only first 5 for brevity
    });
  } catch (err) {
    console.error("Error testing API:", err);
    return json({ success: false, error: err.message }, { status: 500 });
  }
}
