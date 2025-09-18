import { useLoaderData, useFetcher } from '@remix-run/react';
import { json } from '@remix-run/node';
import {
  Page,
  DataTable,
  Thumbnail,
  Button,
  Badge,
  Modal,
  TextContainer,
  Icon,
  TextField,
} from '@shopify/polaris';
import { useState, useMemo } from 'react';
import {
  CheckIcon,
  XIcon,
  DeleteIcon,
  ViewIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
} from '@shopify/polaris-icons';
import db from '../db.server';
import { authenticate } from '../shopify.server'; // 🔥 make sure you have authenticate util

// -----------------------------
// Loader
// -----------------------------
export async function loader({ request }) {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const galleries = await db.galleryUpload.findMany({
    where: { shop },
    include: { images: true, event: true },
    orderBy: { createdAt: 'desc' },
  });

  return json({ galleries });
}

// -----------------------------
// Action
// -----------------------------
export async function action({ request }) {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const formData = await request.formData();
  const id = formData.get("id");
  const status = formData.get("status");
  const type = formData.get("type");
  const actionType = formData.get("actionType");

  if (actionType === "delete" && id) {
    // check shop ownership before deleting
    const gallery = await db.galleryUpload.findFirst({ where: { id, shop } });
    if (!gallery) {
      return json({ success: false, error: "Not found or unauthorized" }, { status: 404 });
    }
    await db.image.deleteMany({ where: { galleryId: id } });
    await db.galleryUpload.delete({ where: { id } });
    return json({ success: true });
  }

  if (!id || !status || !type) {
    return json({ success: false, error: "Missing data" }, { status: 400 });
  }

  if (type === "gallery") {
    const gallery = await db.galleryUpload.findFirst({ where: { id, shop } });
    if (!gallery) {
      return json({ success: false, error: "Not found or unauthorized" }, { status: 404 });
    }
    await db.galleryUpload.update({ where: { id }, data: { status } });
  } else if (type === "image") {
    // also check via gallery relation
    const image = await db.image.findFirst({
      where: { id, gallery: { shop } },
    });
    if (!image) {
      return json({ success: false, error: "Not found or unauthorized" }, { status: 404 });
    }
    await db.image.update({ where: { id }, data: { status } });
  }

  return json({ success: true });
}

// -----------------------------
// Component
// -----------------------------
export default function AdminImages() {
  const { galleries } = useLoaderData();
  const [activeGallery, setActiveGallery] = useState(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const fetcher = useFetcher();

  const filteredGalleries = useMemo(() => {
    if (!searchTerm) return galleries;
    return galleries.filter(gallery => {
      const customerId = gallery.customerId.split('/').pop().toLowerCase();
      const eventName = gallery.event?.name?.toLowerCase() || '';
      const searchLower = searchTerm.toLowerCase();
      return customerId.includes(searchLower) || eventName.includes(searchLower);
    });
  }, [galleries, searchTerm]);

  const openModal = (gallery, index) => {
    setActiveGallery(gallery);
    setActiveImageIndex(index);
  };

  const rows = filteredGalleries.map((gallery, index) => {
    const firstTwoImages = gallery.images.slice(0, 2);
    const remainingCount = gallery.images.length - 2;

    return [
      index + 1, // Serial number
      gallery.customerId.split('/').pop(),
      gallery.event ? gallery.event.name : gallery.itemName || "N/A",

      <div style={{ textAlign: 'center' }}>
        <Badge
          tone={
            gallery.status === "approved" ? "success" :
            gallery.status === "declined" ? "critical" :
            "warning"
          }
        >
          {gallery.status}
        </Badge>
      </div>,

      <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', flexWrap: 'wrap' }}>
        {firstTwoImages.map((img, idx) => (
          <div key={img.id} style={{ position: 'relative' }}>
            <Thumbnail source={img.url} alt="uploaded" size="small" />
            <button
              style={{
                position: 'absolute',
                top: '4px',
                right: '4px',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'transparent'
              }}
              onClick={() => openModal(gallery, idx)}
              title="View"
            >
              <Icon source={ViewIcon} color="base" />
            </button>
          </div>
        ))}
        {remainingCount > 0 && (
          <span 
            onClick={() => openModal(gallery, 2)}
            style={{
              color: 'var(--p-color-text-subdued)',
              cursor: 'pointer',
              marginLeft: '4px'
            }}
          >
            +{remainingCount} more...
          </span>
        )}
      </div>,

      <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', alignItems: 'center' }}>
        <fetcher.Form method="POST">
          <input type="hidden" name="type" value="gallery" />
          <input type="hidden" name="id" value={gallery.id} />
          <input type="hidden" name="status" value="approved" />
          <button type="submit" style={{ background: 'none', border: 'none', cursor: 'pointer' }} title="Approve">
            <Icon source={CheckIcon} color="success" />
          </button>
        </fetcher.Form>

        <fetcher.Form method="POST">
          <input type="hidden" name="type" value="gallery" />
          <input type="hidden" name="id" value={gallery.id} />
          <input type="hidden" name="status" value="declined" />
          <button type="submit" style={{ background: 'none', border: 'none', cursor: 'pointer' }} title="Decline">
            <Icon source={XIcon} color="critical" />
          </button>
        </fetcher.Form>

        <fetcher.Form method="POST">
          <input type="hidden" name="actionType" value="delete" />
          <input type="hidden" name="id" value={gallery.id} />
          <button type="submit" style={{ background: 'none', border: 'none', cursor: 'pointer' }} title="Delete">
            <Icon source={DeleteIcon} color="critical" />
          </button>
        </fetcher.Form>
      </div>,
    ];
  });

  const handleApproveImage = (imageId) => {
    fetcher.submit({ type: 'image', id: imageId, status: 'approved' }, { method: 'POST' });
  };

  const handleDeclineImage = (imageId) => {
    fetcher.submit({ type: 'image', id: imageId, status: 'declined' }, { method: 'POST' });
  };

  const nextImage = () => {
    if (activeGallery && activeImageIndex < activeGallery.images.length - 1) {
      setActiveImageIndex(activeImageIndex + 1);
    }
  };

  const prevImage = () => {
    if (activeGallery && activeImageIndex > 0) {
      setActiveImageIndex(activeImageIndex - 1);
    }
  };

  const currentImage = activeGallery?.images[activeImageIndex];

  return (
    <Page title="Admin Gallery Approvals">
      <style>{`
        .Polaris-DataTable__Table thead tr th {
          font-weight: bold !important;
          font-size: 14px !important;
        }
        .Polaris-DataTable__Table th:nth-child(4),
        .Polaris-DataTable__Table th:nth-child(5),
        .Polaris-DataTable__Table td:nth-child(4),
        .Polaris-DataTable__Table td:nth-child(5) {
          text-align: center !important;
        }
        .search-container {
          margin-bottom: 20px;
          max-width: 400px;
        }
      `}</style>

      <div className="search-container">
        <TextField
          label="Search galleries"
          labelHidden
          placeholder="Search by customer ID or name..."
          value={searchTerm}
          onChange={(value) => setSearchTerm(value)}
          autoComplete="off"
          clearButton
          onClearButtonClick={() => setSearchTerm('')}
        />
      </div>

      {filteredGalleries.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <img
            src="/images/camera.png" 
            alt="No galleries"
            style={{ width: '150px', marginBottom: '20px' }}
          />
          <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '10px' }}>
            No galleries found
          </h2>
          <p style={{ color: '#6b7280' }}>
            There are currently no gallery uploads to review.
          </p>
        </div>
      ) : (
        <DataTable
          columnContentTypes={['text', 'text', 'text', 'text', 'text', 'text']}
          headings={['#', 'Customer ID', 'Name', 'Gallery Status', 'Images', 'Actions']}
          rows={rows}
        />
      )}

      {currentImage && (
        <Modal
          open
          onClose={() => setActiveGallery(null)}
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <span>Image Details</span>
              {activeGallery.images.length > 1 && (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <Button
                    plain
                    icon={ArrowLeftIcon}
                    onClick={prevImage}
                    disabled={activeImageIndex === 0}
                  />
                  <Button
                    plain
                    icon={ArrowRightIcon}
                    onClick={nextImage}
                    disabled={activeImageIndex === activeGallery.images.length - 1}
                  />
                </div>
              )}
            </div>
          }
          large
          primaryAction={{ 
            content: 'Approve', 
            onAction: () => handleApproveImage(currentImage.id) 
          }}
          secondaryActions={[
            { 
              content: 'Decline', 
              destructive: true, 
              onAction: () => handleDeclineImage(currentImage.id),
            },
            {
              content: (
                <Badge
                  tone={
                    currentImage.status === "approved" ? "success" :
                    currentImage.status === "declined" ? "critical" :
                    "warning"
                  }
                >
                  {currentImage.status}
                </Badge>
              ),
              disabled: true
            }
          ]}
        >
          <div style={{ backgroundColor: '#f9fafb', padding: '20px', borderRadius: '8px' }}>
            <Modal.Section>
              <TextContainer>
                <div style={{ textAlign: 'center', marginTop: '20px' }}>
                  <img
                    src={currentImage.url}
                    alt="Full size"
                    style={{
                      maxWidth: '100%',
                      maxHeight: '600px',
                      borderRadius: '8px',
                      boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
                    }}
                  />
                </div>
              </TextContainer>
            </Modal.Section>
          </div>
        </Modal>
      )}
    </Page>
  );
}
