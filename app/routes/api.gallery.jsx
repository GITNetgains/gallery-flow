

import { cors } from "remix-utils/cors";
import { json } from "@remix-run/node";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import fs from "fs/promises";
import db from "../db.server";
import { fetchProducts, fetchBlogs, fetchCollections, fetchPages } from "../shopifyApiUtils";

// ✅ Loader with CORS

export const loader = async ({ request }) => {
  try {
    // Fetch global setting
    const setting = await db.setting.findUnique({ where: { id: "global-setting" } });

    if (!setting.addEventEnabled) {
      // ✅ If addEvent is disabled, fetch products, blogs, collections, pages
      const [products, blogs, collections, pages] = await Promise.all([
        fetchProducts(),
        fetchBlogs(),
        fetchCollections(),
        fetchPages(),
      ]);

      const response = json({
        success: true,
        disabled: true,
        products,
        blogs,
        collections,
        pages,
      });

      return await cors(request, response, {
        origin: "*",
        methods: ["GET"],
        allowedHeaders: ["Content-Type"],
      });
    } else {
      // ✅ If addEvent is enabled, fetch past events only
      const pastEvents = await db.event.findMany({
        where: {
          date: { lt: new Date() },
        },
        orderBy: { date: "desc" },
      });

      const response = json({
        success: true,
        disabled: false,
        events: pastEvents,
      });

      return await cors(request, response, {
        origin: "*",
        methods: ["GET"],
        allowedHeaders: ["Content-Type"],
      });
    }
  } catch (error) {
    console.error("Error in loader:", error);
    return await cors(
      request,
      json({ success: false, error: "Server error" }, { status: 500 }),
      {
        origin: "*",
        methods: ["GET"],
        allowedHeaders: ["Content-Type"],
      }
    );
  }
};
function determineItemType(shopifyId) {
  if (shopifyId.includes("Product")) return "product";
  if (shopifyId.includes("Article")) return "article"; // 🔥 added
  if (shopifyId.includes("Blog")) return "blog";
  if (shopifyId.includes("Collection")) return "collection";
  if (shopifyId.includes("Page")) return "page";
  return "unknown";
}


export const action = async ({ request }) => {
  const formData = await request.formData();
  const customerId = formData.get("customerId");
  const name = formData.get("name");
  const email = formData.get("email");
  const eventId = formData.get("eventId");
  const files = formData.getAll("images");

  if (!customerId || !email || !eventId || files.length === 0) {
    return json({ success: false, error: "Missing required fields or files." }, { status: 400 });
  }

  try {
    let eventRecord = await db.event.findUnique({ where: { id: eventId } });

    let galleryData = {
      id: uuidv4(),
      customerId,
      name,
      email,
      status: "Pending",
      eventId: null,
      itemId: null,
      itemType: null,
      itemName: null, // 🔥 added field
    };

    if (eventRecord) {
      galleryData.eventId = eventId;
    } else {
      const type = determineItemType(eventId);
      if (type === "unknown") {
        return json({ success: false, error: "Invalid item type" }, { status: 400 });
      }

      let itemName = "";

      if (type === "product") {
        const products = await fetchProducts();
        const matched = products.find(p => p.id === eventId);
        itemName = matched?.title || "Product";
      }
      else if (type === "article") {
  const blogs = await fetchBlogs();

  // Flatten all articles with blog context
  const allArticles = blogs.flatMap(b =>
    b.articles.map(a => ({
      ...a,
      blogTitle: b.title // optional if you want blog context
    }))
  );

  const matched = allArticles.find(a => a.id === eventId);
  itemName = matched?.title || "Article";
}
      else if (type === "collection") {
        const collections = await fetchCollections();
        const matched = collections.find(c => c.id === eventId);
        itemName = matched?.title || "Collection";
      }
      else if (type === "page") {
        const pages = await fetchPages();
        const matched = pages.find(pg => pg.id === eventId);
        itemName = matched?.title || "Page";
      }

      galleryData.itemId = eventId;
      galleryData.itemType = type;
      galleryData.itemName = itemName;
    }

    console.log("🔍 Uploading Gallery Data:", galleryData);

    const newGallery = await db.galleryUpload.create({ data: galleryData });

    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const fileName = `${Date.now()}-${file.name}`;
      const uploadDir = path.join(process.cwd(), "public", "uploads");

      await fs.mkdir(uploadDir, { recursive: true });
      const filePath = path.join(uploadDir, fileName);
      await fs.writeFile(filePath, buffer);

      const imageUrl = `/uploads/${fileName}`;

      await db.image.create({
        data: {
          id: uuidv4(),
          url: imageUrl,
          galleryId: newGallery.id,
        },
      });
    }

    return await cors(
      request,
      json({ success: true, message: "Your gallery upload is in process." }),
      {
        origin: "*",
        methods: ["POST"],
        allowedHeaders: ["Content-Type"],
      }
    );

  } catch (error) {
    console.error("❌ Upload gallery error:", error);
    return json({ success: false, error: "Server error. Please try again." }, { status: 500 });
  }
};
