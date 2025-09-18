import { json } from '@remix-run/node';
import { useLoaderData, Link } from '@remix-run/react';
import { Page, Card, Text, Layout, Badge, Icon } from '@shopify/polaris';
import { PersonIcon, ImageIcon, ThumbsUpIcon, ThumbsDownIcon } from '@shopify/polaris-icons';
import db from '../db.server';
import { authenticate } from '../shopify.server';

// ---------------- Theme Editor Button -----------------
function ThemeEditorButton() {
  const handleOpenThemeEditor = () => {
    try {
      const url = new URL(window.location.href);
      const shop = url.searchParams.get('shop');
      const host = url.searchParams.get('host');

      if (!shop) throw new Error('Shop parameter not found in URL');

      const appEmbedValue = '4e1fbe99fba5bf48f094895616d6f622/app_gallery';
      let themeEditorUrl = new URL(`https://${shop}/admin/themes/145028382891/editor`);
      themeEditorUrl.searchParams.set('context', 'apps');
      themeEditorUrl.searchParams.set('appEmbed', encodeURIComponent(appEmbedValue));

      if (host) {
        window.top.location.href = themeEditorUrl.toString();
      } else {
        window.location.href = themeEditorUrl.toString();
      }
    } catch (error) {
      console.error('Error opening theme editor (specific theme):', error.message);
      try {
        const shop = new URL(window.location.href).searchParams.get('shop');
        if (shop) {
          const fallbackUrl = new URL(`https://${shop}/admin/themes/current/editor`);
          const appEmbedValue = '4e1fbe99fba5bf48f094895616d6f622/app_gallery';
          fallbackUrl.searchParams.set('context', 'apps');
          fallbackUrl.searchParams.set('appEmbed', encodeURIComponent(appEmbedValue));
          window.location.href = fallbackUrl.toString();
        }
      } catch (fallbackError) {
        console.error('Error opening theme editor (fallback):', fallbackError.message);
        const shop = new URL(window.location.href).searchParams.get('shop');
        if (shop) {
          const finalFallbackUrl = `https://${shop}/admin/themes/current/editor?context=apps`;
          window.open(finalFallbackUrl, '_blank');
        }
      }
    }
  };

  return (
    <button
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        background: 'linear-gradient(to bottom, #3d3c3c, #111111)',
        color: 'white',
        border: 'none',
        borderRadius: '6px',
        padding: '6px 12px',
        fontWeight: '600',
        cursor: 'pointer',
      }}
      onClick={handleOpenThemeEditor}
    >
      Activate extensions
    </button>
  );
}

// ---------------- Loader -----------------
export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  // ✅ Per-shop unique customers
  const uniqueCustomers = await db.galleryUpload.findMany({
    where: { shop },
    distinct: ['email'],
    select: { email: true },
  });

  // ✅ Per-shop images
  const submittedImages = await db.image.count({
    where: { shop },
  });

  const approvedImages = await db.image.count({
    where: { shop, status: 'approved' },
  });

  const declinedImages = await db.image.count({
    where: { shop, status: 'declined' },
  });

  // ✅ Per-shop setting
  const setting = await db.setting.upsert({
    where: { shop },
    update: {},
    create: { shop, addEventEnabled: true },
  });

  return json({
    numberOfCustomers: uniqueCustomers.length,
    numberOfImagesApproved: approvedImages,
    numberOfImagesDeclined: declinedImages,
    numberOfSubmittedImages: submittedImages,
    expiryEnabled: setting.addEventEnabled,
  });
};

// ---------------- Dashboard -----------------
export default function Dashboard() {
  const {
    numberOfCustomers,
    numberOfImagesApproved,
    numberOfImagesDeclined,
    numberOfSubmittedImages,
    expiryEnabled,
  } = useLoaderData();

  return (
    <Page>
      <Layout>
        {/* App Setup Steps */}
        <Layout.Section>
          <Card>
            <div style={{ padding: '20px' }}>
              <Text variant="headingLg">App Setup Steps</Text>
              <ol style={{ marginTop: '10px', paddingLeft: '20px' }}>
                <li>
                  <Text as="span" variant="headingMd" fontWeight="bold">
                    Add the Upload Gallery Block
                  </Text>
                  <p style={{ margin: '10px 0' }}>
                    Insert the Upload Gallery block into your theme where you want customers to upload their images.
                  </p>
                </li>
                <li style={{ marginTop: '10px' }}>
                  <Text as="span" variant="headingMd" fontWeight="bold">
                    Add the Show Gallery Block
                  </Text>
                  <p style={{ margin: '10px 0' }}>
                    Insert the Show Gallery block into product, blog, collection, or page templates.
                  </p>
                </li>
                <li style={{ marginTop: '10px' }}>
                  <Text variant="headingMd">Approvals</Text>
                  <p style={{ margin: '10px 0' }}>Approve or decline uploaded items from customers</p>
                  <Link to="/app/customer" style={{ textDecoration: 'none' }}>
                    <button
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        background: 'linear-gradient(to bottom, #3d3c3c, #111111)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '6px 12px',
                        fontWeight: '600',
                        cursor: 'pointer',
                      }}
                    >
                      Go to Approvals
                    </button>
                  </Link>
                </li>
                <li style={{ marginTop: '10px' }}>
                  <Text as="span" variant="headingMd" fontWeight="bold">Configure Gallery Settings</Text>
                  <p style={{ margin: '10px 0' }}>
                    Enable expiry if you want to show only expiry products for upload, or disable to show all products.
                  </p>
                  <Link to="/app/AddEvent" style={{ textDecoration: 'none' }}>
                    <button
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        background: 'linear-gradient(to bottom, #3d3c3c, #111111)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '6px 12px',
                        fontWeight: '600',
                        cursor: 'pointer',
                      }}
                    >
                      Configure
                    </button>
                  </Link>
                </li>
              </ol>
            </div>
          </Card>
        </Layout.Section>

        {/* Campaign Section */}
        <Layout.Section>
          <Card sectioned title="Create campaign">
            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', width: '100%' }}>
              {/* Approvals */}
              <div style={{
                flex: '1',
                border: '1px solid #e1e3e5',
                borderRadius: '8px',
                padding: '20px',
                background: 'white',
              }}>
                <Text variant="headingSm">Approvals</Text>
                <p style={{ margin: '10px 0' }}>Approve or decline uploaded items from customers</p>
                <Link to="/app/customer" style={{ textDecoration: 'none' }}>
                  <button style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: 'linear-gradient(to bottom, #3d3c3c, #111111)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '6px 12px',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}>
                    Go to Approvals
                  </button>
                </Link>
              </div>

              {/* Settings */}
              <div style={{
                flex: '1',
                border: '1px solid #e1e3e5',
                borderRadius: '8px',
                padding: '20px',
                background: 'white',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}>
                <Text variant="headingSm">Settings</Text>
                <p style={{ margin: '10px 0' }}>Manage app settings including expiry options</p>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Link to="/app/AddEvent" style={{ textDecoration: 'none' }}>
                    <button style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      background: 'linear-gradient(to bottom, #3d3c3c, #111111)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '6px 12px',
                      fontWeight: '600',
                      cursor: 'pointer',
                    }}>
                      Configure
                    </button>
                  </Link>
                  <Badge tone={expiryEnabled ? 'success' : 'critical'}>
                    {expiryEnabled ? 'Enabled' : 'Disabled'}
                  </Badge>
                </div>
              </div>
            </div>
          </Card>
        </Layout.Section>

        {/* Metrics */}
        <Layout.Section>
          <div style={{
            display: 'flex',
            gap: '20px',
            marginTop: '20px',
            flexWrap: 'wrap',
            background: 'white',
            padding: '20px',
            borderRadius: '8px',
            border: '1px solid #e1e3e5',
          }}>
            {[
              { title: 'Number of Customers', value: numberOfCustomers, icon: PersonIcon },
              { title: 'Images Approved', value: numberOfImagesApproved, icon: ThumbsUpIcon },
              { title: 'Images Declined', value: numberOfImagesDeclined, icon: ThumbsDownIcon },
              { title: 'Submitted Images', value: numberOfSubmittedImages, icon: ImageIcon },
            ].map((metric, idx) => (
              <div key={idx} style={{
                flex: '1 1 200px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'start',
                background: '#f9fafb',
                border: '1px solid #e1e3e5',
                borderRadius: '8px',
                padding: '20px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Icon source={metric.icon} color="base" />
                  <p style={{ fontSize: '13px', margin: '5px 0' }}>{metric.title}</p>
                </div>
                <p style={{ fontSize: '23px', fontWeight: 'bold', margin: '5px 0' }}>{metric.value}</p>
              </div>
            ))}
          </div>
        </Layout.Section>

        {/* Review */}
        <Layout.Section>
          <Card sectioned>
            <Text variant="headingMd">How would you rate your experience</Text>
            <p style={{ margin: '10px 0' }}>
              We hope you're enjoying our app! If you have a moment, please leave us a review.
            </p>
            <button style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'linear-gradient(to bottom, #3d3c3c, #111111)',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              padding: '6px 12px',
              fontWeight: '600',
              cursor: 'pointer',
            }}>
              Leave a review
            </button>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
