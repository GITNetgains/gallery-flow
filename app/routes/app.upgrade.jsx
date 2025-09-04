import { redirect } from "@remix-run/node";
import { authenticate, MONTHLY_PLAN, ANNUAL_PLAN } from "../shopify.server";
import { getSubcriptionstatus } from "./models/Subscription.server";

export const loader = async ({ request }) => {
    const { admin, billing, session } = await authenticate.admin(request);
    const { shop } = session;

  const url = new URL(request.url);
  const selectedPlan = url.searchParams.get("plan");

  const plan =
    selectedPlan === "annual"
      ? ANNUAL_PLAN
      : selectedPlan === "monthly"
      ? MONTHLY_PLAN
      : null;

  if (!plan) {
    return redirect("/app/pricing");
  }

  const response = await getSubcriptionstatus(admin.graphql);
  const { activeSubscriptions } = response.data.app.installation;

  const alreadySubscribed = activeSubscriptions.some(
    (sub) => sub.name === plan.name
  );

  if (!alreadySubscribed) {
    try {
      const confirmationUrl = await billing.request({
        plan: plan.name,
        isTest: plan.test,
        returnUrl: `https://${shop}/apps/photo-gallery-app-1/app`,
      });

      return redirect(confirmationUrl);
    } catch (error) {
      console.error("Billing request failed:", error);
      throw new Response("Failed to process billing request", { status: 500 });
    }
  }

  return redirect(`/app`);
};
