import { cors } from "remix-utils/cors";
import { json } from "@remix-run/node";
import { v4 as uuidv4 } from "uuid";
import db from "../db.server";
import {
  fetchProducts,
  fetchBlogs,
  fetchCollections,
  fetchPages,
} from "../shopifyApiUtils";
import cloudinary from "cloudinary";
import { authenticate } from "../shopify.server"; 

// -----------------------------
// Cloudinary Config
// -----------------------------
cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// -----------------------------
// 🔒 Dynamic CORS Options
// -----------------------------
function getCorsOptions(request) {
  const origin = request.headers.get("Origin");

  if (origin && origin.endsWith(".myshopify.com")) {
    return {
      origin,
      methods: ["GET", "POST", "OPTIONS"],
      allowedHeaders: ["Content-Type"],
    };
  }

  return {
    origin: "*",
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  };
}

// -----------------------------
// Helper: resolve session
// -----------------------------
async function getSession(request) {
  let shopFromBody;

  if (request.method !== "GET") {
    try {
      const formData = await request.clone().formData();
      shopFromBody = formData.get("shop");
    } catch {}
  } else {
    const url = new URL(request.url);
    shopFromBody = url.searchParams.get("shop");
  }

  let session;
  try {
    const authResult = await authenticate.admin(request);
    session = authResult.session;
  } catch {
    if (!shopFromBody) throw new Error("No shop param provided for DB fallback");
    const sessionRecord = await db.session.findFirst({ where: { shop: shopFromBody } });
    if (!sessionRecord) throw new Error("No DB session found");
    session = { shop: sessionRecord.shop, accessToken: sessionRecord.accessToken };
  }

  return session;
}

// -----------------------------
// Loader with CORS
// -----------------------------
export const loader = async ({ request }) => {
  if (request.method === "OPTIONS") {
    return await cors(
      request,
      new Response(null, { status: 204 }),
      getCorsOptions(request)
    );
  }

  try {
    const session = await getSession(request);
    const shop = session.shop;
    const accessToken = session.accessToken;

    if (!shop || !accessToken) {
      return await cors(
        request,
        json({ success: false, error: "Missing shop or accessToken" }, { status: 400 }),
        getCorsOptions(request)
      );
    }

    const setting = await db.setting.findUnique({ where: { shop } });
    if (!setting) {
      return await cors(
        request,
        json({ success: false, error: "Global setting not found" }, { status: 500 }),
        getCorsOptions(request)
      );
    }

    if (!setting.addEventEnabled) {
      // Events disabled → return products/blogs/pages/collections
      const [products, blogs, collections, pages] = await Promise.all([
        fetchProducts(shop, accessToken),
        fetchBlogs(shop, accessToken),
        fetchCollections(shop, accessToken),
        fetchPages(shop, accessToken),
      ]);

      return await cors(
        request,
        json({
          success: true,
          disabled: true,
          setting,
          products,
          blogs,
          collections,
          pages,
        }),
        getCorsOptions(request)
      );
    } else {
      // Events enabled → return past events **for this shop only**
      const pastEvents = await db.event.findMany({
        where: { date: { lt: new Date() }, shop },
        orderBy: { date: "desc" },
      });

      return await cors(
        request,
        json({
          success: true,
          disabled: false,
          events: pastEvents,
        }),
        getCorsOptions(request)
      );
    }
  } catch (error) {
    console.error("❌ Error in loader:", error);
    return await cors(
      request,
      json({ success: false, error: error.message || "Server error" }, { status: 500 }),
      getCorsOptions(request)
    );
  }
};

// -----------------------------
// Helpers
// -----------------------------
function determineItemType(shopifyId) {
  if (shopifyId.includes("Product")) return "product";
  if (shopifyId.includes("Article")) return "article";
  if (shopifyId.includes("Blog")) return "blog";
  if (shopifyId.includes("Collection")) return "collection";
  if (shopifyId.includes("Page")) return "page";
  return "unknown";
}

// -----------------------------
// Action with Cloudinary Upload
// -----------------------------
export const action = async ({ request }) => {
  if (request.method === "OPTIONS") {
    return await cors(
      request,
      new Response(null, { status: 204 }),
      getCorsOptions(request)
    );
  }

  try {
    const session = await getSession(request);
    const shop = session.shop;
    const accessToken = session.accessToken;

    const setting = await db.setting.findUnique({ where: { shop } });
    if (!setting) throw new Error("Global setting not found");

    const formData = await request.formData();
    const customerId = formData.get("customerId");
    const name = formData.get("name");
    const email = formData.get("email");
    const eventId = formData.get("eventId");
    const files = formData.getAll("images");

    if (!customerId || !email || !eventId || files.length === 0) {
      return await cors(
        request,
        json({ success: false, error: "Missing required fields or files." }, { status: 400 }),
        getCorsOptions(request)
      );
    }

    let galleryData = {
      id: uuidv4(),
      customerId,
      name,
      email,
      status: "Pending",
      shop, // 🔥 save shop
      eventId: null,
      itemId: null,
      itemType: null,
      itemName: null,
    };

    if (setting.addEventEnabled) {
      // Only allow past events for this shop
      const eventRecord = await db.event.findUnique({ where: { id: eventId } });
      if (!eventRecord || eventRecord.shop !== shop || new Date(eventRecord.date) >= new Date()) {
        return await cors(
          request,
          json({ success: false, error: "You can only upload for past events." }, { status: 403 }),
          getCorsOptions(request)
        );
      }
      galleryData.eventId = eventId;
    } else {
      // Events disabled → allow products/blogs/pages/collections
      const type = determineItemType(eventId);
      if (type === "unknown") return json({ success: false, error: "Invalid upload target" }, { status: 400 });

      let itemName = "";
      if (type === "product") {
        const products = await fetchProducts(shop, accessToken);
        const matched = products.find((p) => p.id === eventId);
        itemName = matched?.title || "Product";
      } else if (type === "article") {
        const blogs = await fetchBlogs(shop, accessToken);
        const allArticles = blogs.flatMap((b) => b.articles.map((a) => ({ ...a, blogTitle: b.title })));
        const matched = allArticles.find((a) => a.id === eventId);
        itemName = matched?.title || "Article";
      } else if (type === "collection") {
        const collections = await fetchCollections(shop, accessToken);
        const matched = collections.find((c) => c.id === eventId);
        itemName = matched?.title || "Collection";
      } else if (type === "page") {
        const pages = await fetchPages(shop, accessToken);
        const matched = pages.find((pg) => pg.id === eventId);
        itemName = matched?.title || "Page";
      }

      galleryData.itemId = eventId;
      galleryData.itemType = type;
      galleryData.itemName = itemName;
    }

    // Save gallery
    const newGallery = await db.galleryUpload.create({ data: galleryData });

    // Upload images to Cloudinary
    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const base64 = `data:${file.type};base64,${buffer.toString("base64")}`;
      const uploadRes = await cloudinary.v2.uploader.upload(base64, {
        folder: "shopify-gallery",
        public_id: `${Date.now()}-${file.name}`,
      });

      await db.image.create({
        data: {
          id: uuidv4(),
          url: uploadRes.secure_url,
          galleryId: newGallery.id,
        },
      });
    }

    return await cors(
      request,
      json({ success: true, message: "Your gallery upload is in process." }),
      getCorsOptions(request)
    );
  } catch (error) {
    console.error("❌ Upload gallery error:", error);
    return await cors(
      request,
      json({ success: false, error: "Server error. Please try again." }, { status: 500 }),
      getCorsOptions(request)
    );
  }
};