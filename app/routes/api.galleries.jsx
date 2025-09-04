import { json } from '@remix-run/node';
import { cors } from 'remix-utils/cors';
import db from '../db.server';

export async function loader({ request }) {
  try {
    const events = await db.event.findMany(); // all events
    const images = await db.image.findMany({
      where: { status: "approved" },
      include: {
        gallery: {
          include: {
            event: true,
          },
        },
      },
    });

    return await cors(
      request,
      json({ images, events }),
      {
        origin: [
          "https://netgains28.myshopify.com",
          "http://localhost:*",
        ],
        methods: ["GET"],
        allowedHeaders: ["Content-Type"],
        maxAge: 600
      }
    );
  } catch (error) {
    console.error("Loader error:", error);
    return await cors(
      request,
      json({ error: "Internal Server Error" }, { status: 500 }),
      {
        origin: "*",
        methods: ["GET"],
        allowedHeaders: ["Content-Type"]
      }
    );
  }
}
