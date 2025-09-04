import { json } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';
import {
  Page,
  LegacyCard,
  Text,
  BlockStack,
  Button,
  InlineStack,
  Icon,
} from '@shopify/polaris';
import { CheckIcon } from '@shopify/polaris-icons';
import { authenticate } from '../shopify.server';
import { getSubcriptionstatus } from './models/Subscription.server';

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const activeSubscriptions = await getSubcriptionstatus(admin.graphql);

  let currentPlan = 'Free';
  if (activeSubscriptions?.length > 0) {
    currentPlan = activeSubscriptions[0].name || 'Free';
  }

  return json({ currentPlan });
};
  
const planData = [
  {
    title: 'Free',
    description: 'Basic plan to get started',
    price: '0',
    url: '/app/upgrade?plan=free',
    features: [
      'Up to 10 uploads per month',
      'Basic gallery display block',
      'Basic approval system',
      'No expiry settings',
      'Standard support',
    ],
    icon: '📨',
    highlight: false,
  },
  {
    title: 'Monthly subscription',
    description: 'Advanced features for growing stores',
    price: '5',
    url: '/app/upgrade?plan=monthly',
    features: [
      'Unlimited uploads',
      'Advanced gallery display block',
      'Full approval system',
      'Expiry settings for uploads',
      'Priority support',
    ],
    icon: '🛫',
    highlight: false,
  },
  {
    title: 'Annual subscription',
    description: 'Same advanced features',
    price: '50',
    url: '/app/upgrade?plan=annual',
    features: [
      'Unlimited uploads',
      'Advanced gallery display block',
      'Full approval system',
      'Expiry settings for uploads',
      'Priority support',
      'Save ~20% annually',
    ],
    icon: '🚀',
    highlight: true,
  },
];

export default function PricingPage() {
  const { currentPlan } = useLoaderData();

  return (
    <Page title="Choose Your Plan">
      {currentPlan !== 'Free' && (
        <InlineStack align="end" style={{ marginBottom: '1.5rem' }}>
          <Button destructive url="/app/cancel">
            Cancel Subscription
          </Button>
        </InlineStack>
      )}

      <div
        style={{
          display: 'flex',
          gap: '10px',
          justifyContent: 'center',
  
        }}
      >
        {planData.map((plan, index) => {
          const isCurrent = currentPlan === plan.title;
          const isHighlight = plan.highlight;

          return (
            <div
              key={index}
              style={{
                transition: 'transform 0.3s, box-shadow 0.3s',
                borderRadius: '12px',
                width: '300px',
                cursor: 'pointer',
                boxShadow: isHighlight
                  ? '0 0 0 4px rgba(253, 251, 255, 0.5)'
                  : '0 1px 5px rgba(0,0,0,0.1)',
                border: isCurrent
                  ? '2px solid #007b5c'
                  : '1px solid #e5e5e5',
                // background: isHighlight ? '#f8f5ff' : '#fff',
                background: '#fff',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.02)';
                e.currentTarget.style.boxShadow =
                  '0 4px 16px rgba(0,0,0,0.15)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = isHighlight
                  ? '0 0 0 4px rgba(254, 253, 255, 0.5)'
                  : '0 1px 5px rgba(0,0,0,0.1)';
              }}
            >
              <div style={{padding:"15px"}} roundedAbove="sm">
                <BlockStack gap="300" align="center">
                  <div style={{ fontSize: '2rem' }}>{plan.icon}</div>

                  <Text variant="headingMd" as="h3">
                    {plan.title.toUpperCase()}
                  </Text>

                  <Text variant="bodyMd" tone="subdued">
                    {plan.description}
                  </Text>

                  <Text variant="headingLg" fontWeight="bold">
                    {plan.price === '0' ? '$0' : `$${plan.price}`}
                    <span style={{ fontSize: '14px', color: '#666' }}>
                      /mo
                    </span>
                  </Text>

                  {isCurrent ? (
                    <Button disabled>Current Plan</Button>
                  ) : (
                    <Button primary url={plan.url}>
                      Upgrade
                    </Button>
                  )}

                  <div style={{display:'flex', flexDirection:'column', alignItems:'start', paddingTop: '10px' }}>
                    {plan.features.map((feature, i) => (
                      <div
                        key={i}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '8px',
                          marginBottom: '8px',
                        }}
                      >
                        <Icon source={CheckIcon} color="success" />
                        <Text as="span" variant="bodyMd">
                          {feature}
                        </Text>
                      </div>
                    ))}
                  </div>
                </BlockStack>
              </div>
            </div>
          );
        })}
      </div>
    </Page>
  );
}
