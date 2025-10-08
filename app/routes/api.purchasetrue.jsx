
import { cors } from "remix-utils/cors";
import { json } from "@remix-run/node";
import { v4 as uuidv4 } from "uuid";
import db from "../db.server";
import { authenticate } from "../shopify.server"; 

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

    if (!setting.onlyPurchasedItem) {
     
      return await cors(
        request,
        json({
          success: true,
          onlyPurchasedItem: true,
        }),
        getCorsOptions(request)
      );
    } else {

      return await cors(
        request,
        json({
          success: true,
          onlyPurchasedItem: false,
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
