import { json } from '@remix-run/node';
import db from '../db.server';
import { cors } from "remix-utils/cors";

const extractId = (id) => id?.split('/').pop();

const matchContentId = (storedId, queryId) => {
  if (!storedId || !queryId) return false;
  return extractId(storedId) === extractId(queryId);
};

export const loader = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const contentId = url.searchParams.get("contentId");
    const contentType = url.searchParams.get("contentType");

    if (!contentId || !contentType) {
      const response = json({ error: "Missing parameters" }, { status: 400 });
      return await cors(request, response, {
        origin: "*",
        methods: ["GET", "POST", "OPTIONS"],
      });
    }

    const setting = await db.setting.findUnique({ where: { id: "global-setting" } });
    console.log("🔧 addEventEnabled:", setting?.addEventEnabled);

    let images = [];

    if (setting?.addEventEnabled) {
      const events = await db.event.findMany({
        include: {
          GalleryUpload: {
            where: { status: "approved" },
            include: { images: { where: { status: "approved" } } }
          }
        }
      });

      const matchingEvent = events.find(event =>
        matchContentId(event.shopifyId, contentId)
      );

      if (matchingEvent && matchingEvent.GalleryUpload?.length) {
        images = matchingEvent.GalleryUpload.flatMap(upload =>
          upload.images.map(img => ({
            url: img.url,
            alt: img.altText || `Gallery image ${img.id}`
          }))
        );
        console.log("✅ Event gallery images found:", images.length);
      } else {
        console.log("❌ No matching event gallery found for:", contentId);
      }

    } else {
      const galleries = await db.galleryUpload.findMany({
        where: {
          itemType: contentType,
          status: "approved",
        },
        include: {
          images: { where: { status: "approved" } },
        },
      });

      console.log("🔍 Fetched galleries count:", galleries.length);

      const matchingGalleries = galleries.filter(gallery =>
        matchContentId(gallery.itemId, contentId)
      );

      console.log("🔍 Matching galleries found count:", matchingGalleries.length);
      console.log("🔍 contentId:", contentId);
      console.log("🔍 contentType param:", contentType);
      console.log("🔍 DB itemTypes found:", galleries.map(g => g.itemType));
      console.log("🔍 DB itemIds found:", galleries.map(g => g.itemId));

      if (matchingGalleries.length) {
        images = matchingGalleries.flatMap(gallery =>
          gallery.images.map(img => ({
            url: img.url,
            alt: img.altText || `Gallery image ${img.id}`
          }))
        );
        console.log(`✅ General gallery images found for ${contentType}:`, images.length);
      } else {
        console.log(`❌ No general gallery found for:`, contentId, contentType);
      }
    }

    if (!images.length) {
      const response = json({
        approved: false,
        message: "No approved gallery uploads found",
        debug: { contentId, contentType, addEventEnabled: setting?.addEventEnabled }
      });
      return await cors(request, response, {
        origin: "*",
        methods: ["GET", "POST", "OPTIONS"],
      });
    }

    const response = json({ approved: true, images });
    return await cors(request, response, {
      origin: "*",
      methods: ["GET", "POST", "OPTIONS"],
    });

  } catch (error) {
    console.error("Gallery loader error:", error);
    const response = json({ error: "Server error", details: error.message }, { status: 500 });
    return await cors(request, response, {
      origin: "*",
      methods: ["GET", "POST", "OPTIONS"],
    });
  }
};
