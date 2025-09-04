import { redirect } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { getSubcriptionstatus } from "./models/Subscription.server";

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);

  const response = await getSubcriptionstatus(admin.graphql);

  // Use the actual field returned by your API
  const activeSubscriptions =
    Array.isArray(response?.data?.appSubscriptions)
      ? response.data.appSubscriptions
      : [];

  if (activeSubscriptions.length > 0) {
    try {
      const subscription = activeSubscriptions[0];

      const cancelled = await admin.billing.cancel({
        subscriptionId: subscription.id,
        isTest: true,
        prorate: true,
      });

      console.log("Subscription cancelled:", cancelled);
    } catch (error) {
      console.error("Cancellation failed:", error);
    }
  } else {
    console.log("No active subscriptions found.");
  }

  return redirect("/app/pricing");
};

export default function CancelPage() {
  return null;
};
