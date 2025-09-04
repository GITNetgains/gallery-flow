import "@shopify/shopify-app-remix/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  shopifyApp,
  BillingInterval,
} from "@shopify/shopify-app-remix/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import prisma from "./db.server";

import { restResources } from '@shopify/shopify-api/rest/admin/2024-04';

// Define plan names as constants for reuse across billing and app logic
export const MONTHLY_PLAN = {
  name: 'Monthly subscription',  // Must match exactly
  amount: 5,
  currencyCode: 'USD',
  interval: BillingInterval.Every30Days,
  trialDays: 14,
  test: true
};
export const ANNUAL_PLAN = {
  name: 'Annual subscription',
  amount: 100,
  currencyCode: 'USD',
  interval: BillingInterval.Annual,
  trialDays: 14,
  test: true
};
const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  apiVersion: ApiVersion.January25,
  scopes: process.env.SCOPES?.split(","),
  appUrl: process.env.SHOPIFY_APP_URL || "",
  authPathPrefix: "/auth",
  sessionStorage: new PrismaSessionStorage(prisma),
  distribution: AppDistribution.AppStore,
  future: {
    unstable_newEmbeddedAuthStrategy: true,
    removeRest: true,
  },

  ...(process.env.SHOP_CUSTOM_DOMAIN
    ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] }
    : {}),
  restResources,
  billing: {
    [MONTHLY_PLAN.name]: {  // Use the name as key
      amount: MONTHLY_PLAN.amount,
      currencyCode: MONTHLY_PLAN.currencyCode,
      interval: MONTHLY_PLAN.interval,
      trialDays: MONTHLY_PLAN.trialDays,
      test: MONTHLY_PLAN.test
    },
     [ANNUAL_PLAN.name]: {
    amount: ANNUAL_PLAN.amount,
    currencyCode: ANNUAL_PLAN.currencyCode,
    interval: ANNUAL_PLAN.interval,
    trialDays: ANNUAL_PLAN.trialDays,
    test: ANNUAL_PLAN.test
  }
  }
});

export default shopify;
export const apiVersion = ApiVersion.January25;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;
