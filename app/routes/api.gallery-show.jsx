import { json } from '@remix-run/node';
import { cors } from "remix-utils/cors";
import db from '../db.server';
import { authenticate } from "../shopify.server";

// -----------------------------
// Helpers
// -----------------------------
const extractId = (id) => id?.split('/').pop();

const matchContentId = (storedId, queryId) => {
  if (!storedId || !queryId) return false;
  return extractId(storedId) === extractId(queryId);
};

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
// Loader
// -----------------------------
export const loader = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const contentId = url.searchParams.get("contentId");
    const contentType = url.searchParams.get("contentType");

    if (!contentId || !contentType) {
      return await cors(
        request,
        json({ success: false, error: "Missing parameters" }, { status: 400 }),
        { origin: "*", methods: ["GET", "POST", "OPTIONS"] }
      );
    }

    const session = await getSession(request);
    const shop = session.shop;

    const setting = await db.setting.findUnique({ where: { shop } });
    if (!setting) {
      return await cors(
        request,
        json({ success: false, error: "Setting not found for shop" }, { status: 404 }),
        { origin: "*", methods: ["GET", "POST", "OPTIONS"] }
      );
    }

    let images = [];

    if (setting.addEventEnabled) {
      // ✅ Event galleries only
      const events = await db.event.findMany({
        where: { shop },
        include: {
          GalleryUpload: {
            where: { status: "approved" },
            include: { images: { where: { status: "approved" } } },
          },
        },
      });

      const matchingEvent = events.find(event =>
        matchContentId(event.shopifyId, contentId)
      );

      if (matchingEvent) {
        images = matchingEvent.GalleryUpload.flatMap(upload =>
          upload.images.map(img => ({
            url: img.url,
            alt: img.altText || `Gallery image ${img.id}`,
          }))
        );
      }
    } else {
      // ✅ Global galleries only
      const galleries = await db.galleryUpload.findMany({
        where: {
          shop,
          itemType: contentType,
          status: "approved",
        },
        include: {
          images: { where: { status: "approved" } },
        },
      });

      const matchingGalleries = galleries.filter(gallery =>
        matchContentId(gallery.itemId, contentId)
      );

      images = matchingGalleries.flatMap(gallery =>
        gallery.images.map(img => ({
          url: img.url,
          alt: img.altText || `Gallery image ${img.id}`,
        }))
      );
    }

    if (!images.length) {
      return await cors(
        request,
        json({
          success: false,
          approved: false,
          message: "No approved gallery uploads found",
          debug: { contentId, contentType, addEventEnabled: setting.addEventEnabled },
        }),
        { origin: "*", methods: ["GET", "POST", "OPTIONS"] }
      );
    }

    return await cors(
      request,
      json({ success: true, approved: true, images }),
      { origin: "*", methods: ["GET", "POST", "OPTIONS"] }
    );
  } catch (error) {
    console.error("❌ Gallery loader error:", error);
    return await cors(
      request,
      json({ success: false, error: error.message || "Server error" }, { status: 500 }),
      { origin: "*", methods: ["GET", "POST", "OPTIONS"] }
    );
  }
};
