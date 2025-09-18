import { json } from "@remix-run/node";
import db from "../db.server";
import { cors } from "remix-utils/cors";
import { authenticate } from "../shopify.server";

// -----------------------------
// Helpers
// -----------------------------
const extractId = (id) => id?.split("/").pop();

const matchContentId = (storedId, queryId) => {
  if (!storedId || !queryId) return false;
  return extractId(storedId) === extractId(queryId);
};

// -----------------------------
// Loader
// -----------------------------
export const loader = async ({ request }) => {
  try {
    // ✅ Get shop from session
    const { session } = await authenticate.public.appProxy(request);
    const shop = session?.shop;

    if (!shop) {
      return await cors(
        request,
        json({ error: "Missing shop context" }, { status: 400 }),
        { origin: "*", methods: ["GET", "POST", "OPTIONS"] }
      );
    }

    const url = new URL(request.url);
    const contentId = url.searchParams.get("contentId");
    const contentType = url.searchParams.get("contentType");

    // ✅ Graceful handling if missing
    if (!contentId || !contentType) {
      return await cors(
        request,
        json({
          approved: false,
          message: "No content ID or type provided (wrong template or block placement).",
          debug: { contentId, contentType },
        }),
        { origin: "*", methods: ["GET", "POST", "OPTIONS"] }
      );
    }

    // ✅ Get per-shop setting
    const setting = await db.setting.findUnique({ where: { shop } });
    console.log(`🔧 [${shop}] addEventEnabled:`, setting?.addEventEnabled);

    let images = [];

    if (setting?.addEventEnabled) {
      // -----------------------------
      // Event-based gallery
      // -----------------------------
      const events = await db.event.findMany({
        where: { shop },
        include: {
          GalleryUpload: {
            where: { status: "approved" },
            include: {
              Image: { where: { status: "approved" } },
            },
          },
        },
      });

      const matchingEvent = events.find((event) =>
        matchContentId(event.shopifyId, contentId)
      );

      if (matchingEvent && matchingEvent.GalleryUpload?.length) {
        images = matchingEvent.GalleryUpload.flatMap((upload) =>
          upload.Image.map((img) => ({
            url: img.url,
            alt: `Gallery image ${img.id}`,
          }))
        );
        console.log("✅ Event gallery images found:", images.length);
      } else {
        console.log("❌ No matching event gallery found for:", contentId);
      }
    } else {
      // -----------------------------
      // Item-based gallery
      // -----------------------------
      const galleries = await db.galleryUpload.findMany({
        where: {
          shop,
          itemType: contentType,
          status: "approved",
        },
        include: {
          Image: { where: { status: "approved" } },
        },
      });

      console.log("🔍 Fetched galleries count:", galleries.length);

      const matchingGalleries = galleries.filter((gallery) =>
        matchContentId(gallery.itemId, contentId)
      );

      if (matchingGalleries.length) {
        images = matchingGalleries.flatMap((gallery) =>
          gallery.Image.map((img) => ({
            url: img.url,
            alt: `Gallery image ${img.id}`,
          }))
        );
        console.log(`✅ General gallery images found for ${contentType}:`, images.length);
      } else {
        console.log(`❌ No general gallery found for:`, contentId, contentType);
      }
    }

    if (!images.length) {
      return await cors(
        request,
        json({
          approved: false,
          message: "No approved gallery uploads found",
          debug: { contentId, contentType, addEventEnabled: setting?.addEventEnabled },
        }),
        { origin: "*", methods: ["GET", "POST", "OPTIONS"] }
      );
    }

    return await cors(
      request,
      json({ approved: true, images }),
      { origin: "*", methods: ["GET", "POST", "OPTIONS"] }
    );
  } catch (error) {
    console.error("Gallery loader error:", error);
    return await cors(
      request,
      json({ error: "Server error", details: error.message }, { status: 500 }),
      { origin: "*", methods: ["GET", "POST", "OPTIONS"] }
    );
  }
};
