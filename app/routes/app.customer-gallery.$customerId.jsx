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
  Pagination,
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
import { authenticate } from "../shopify.server";

export async function loader({ request, params }) {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const { customerId } = params;

  const setting = await db.setting.findUnique({ where: { shop } });
  const fetchVariantEnabled = setting?.fetchVariantEnabled || false;

  const galleries = await db.galleryUpload.findMany({
    where: {
      shop,
      customerId: {
        endsWith: customerId,
      },
    },
    include: { images: true, event: true },
  });

  return json({ galleries, customerId, shop, fetchVariantEnabled });
}

export async function action({ request }) {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const formData = await request.formData();

  const id = formData.get("id");
  const status = formData.get("status");
  const type = formData.get("type");
  const actionType = formData.get("actionType");

  if (actionType === "delete" && id) {
    await db.image.deleteMany({ where: { galleryId: id } });
    await db.galleryUpload.deleteMany({ where: { id, shop } });
    return json({ success: true });
  }

  if (!id || !status || !type) {
    return json({ success: false, error: "Missing data" }, { status: 400 });
  }

  if (type === "gallery") {
    await db.galleryUpload.updateMany({ where: { id, shop }, data: { status } });
  } else if (type === "image") {
    await db.image.update({ where: { id }, data: { status } });
  }

  return json({ success: true });
}

export default function CustomerGallery() {
  const { galleries, customerId, fetchVariantEnabled } = useLoaderData();
  const [activeGallery, setActiveGallery] = useState(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [deleteModal, setDeleteModal] = useState({ open: false, galleryId: null });
  const fetcher = useFetcher();
  const itemsPerPage = 10;

  const filteredGalleries = useMemo(() => {
    if (!searchTerm?.trim()) return galleries;
    const lowerSearch = searchTerm.toLowerCase();
    return galleries.filter(gallery => {
      const eventName = gallery.event?.name?.toLowerCase() || '';
      const itemName = gallery.itemName?.toLowerCase() || '';
      return eventName.includes(lowerSearch) || itemName.includes(lowerSearch);
    });
  }, [galleries, searchTerm]);

  const totalPages = Math.ceil(filteredGalleries.length / itemsPerPage);
  const paginatedGalleries = filteredGalleries.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const openModal = (gallery, index) => {
    setActiveGallery(gallery);
    setActiveImageIndex(index);
  };

  const capitalizeFirst = (str) => str.charAt(0).toUpperCase() + str.slice(1);

  const rows = paginatedGalleries.map((gallery, index) => {
    const firstTwoImages = gallery.images.slice(0, 2);
    const remainingCount = gallery.images.length - 2;

    // ✅ Display variant name if variant mode is enabled
    const galleryLabel = fetchVariantEnabled
      ? gallery.itemName || "Variant"
      : gallery.event
      ? gallery.event.name
      : gallery.itemName || "N/A";

    return [
      (currentPage - 1) * itemsPerPage + index + 1,
      <div style={{ maxWidth: '200px', wordWrap: 'break-word', whiteSpace: 'normal' }}>
        {galleryLabel}
      </div>,
      <div style={{ textAlign: 'center' }}>
        <Badge
          tone={
            gallery.status === "approved" ? "success" :
            gallery.status === "declined" ? "critical" :
            "warning"
          }
        >
          {capitalizeFirst(gallery.status)}
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
          <span onClick={() => openModal(gallery, 2)} style={{ color: '#6b7280', cursor: 'pointer' }}>
            +{remainingCount} more...
          </span>
        )}
      </div>,
      <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
        {/* Approve/Decline */}
        {(() => {
          const hasApprovedImage = gallery.images.some(img => img.status === 'approved');

          return (
            <>
              <fetcher.Form method="POST" replace>
                <input type="hidden" name="type" value="gallery" />
                <input type="hidden" name="id" value={gallery.id} />
                <input type="hidden" name="status" value="approved" />
                <button
                  type="submit"
                  title="Approve"
                  disabled={!hasApprovedImage}
                  style={{ opacity: hasApprovedImage ? 1 : 0.4, cursor: hasApprovedImage ? 'pointer' : 'not-allowed' }}
                >
                  <Icon source={CheckIcon} color="success" />
                </button>
              </fetcher.Form>

              <fetcher.Form method="POST" replace>
                <input type="hidden" name="type" value="gallery" />
                <input type="hidden" name="id" value={gallery.id} />
                <input type="hidden" name="status" value="declined" />
                <button
                  type="submit"
                  title="Decline"
                  disabled={!hasApprovedImage}
                  style={{ opacity: hasApprovedImage ? 1 : 0.4, cursor: hasApprovedImage ? 'pointer' : 'not-allowed' }}
                >
                  <Icon source={XIcon} color="critical" />
                </button>
              </fetcher.Form>
            </>
          );
        })()}

        {/* Delete Button (with confirmation) */}
        <button
          title="Delete"
          onClick={() => setDeleteModal({ open: true, galleryId: gallery.id })}
          style={{
            background: '#ff4d4d',
            border: 'none',
            borderRadius: '6px',
            padding: '5px 8px',
            cursor: 'pointer',
            color: 'white',
          }}
        >
          <Icon source={DeleteIcon} color="base" />
        </button>
      </div>,
    ];
  });

  const nextImage = () => activeGallery && setActiveImageIndex(Math.min(activeImageIndex + 1, activeGallery.images.length - 1));
  const prevImage = () => activeGallery && setActiveImageIndex(Math.max(activeImageIndex - 1, 0));
  const currentImage = activeGallery?.images[activeImageIndex];

  return (
    <Page title={`Gallery for Customer ID: ${customerId}`}>
      {/* search */}
      <div style={{ marginBottom: '20px', maxWidth: '400px' }}>
        <TextField
          label="Search galleries"
          labelHidden
          placeholder="Search by event or variant name..."
          value={searchTerm}
          onChange={(value) => { setSearchTerm(value); setCurrentPage(1); }}
          autoComplete="off"
          clearButton
          onClearButtonClick={() => { setSearchTerm(''); setCurrentPage(1); }}
        />
      </div>

      {/* table */}
      {filteredGalleries.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <h2>No galleries found</h2>
        </div>
      ) : (
        <>
          <DataTable
            columnContentTypes={['text','text','text','text','text']}
            headings={['#','Name','Gallery Status','Images','Actions']}
            rows={rows}
          />
          <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'center' }}>
            <Pagination
              hasPrevious={currentPage > 1}
              onPrevious={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              hasNext={currentPage < totalPages}
              onNext={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            />
          </div>
        </>
      )}

      {/* Delete confirmation modal */}
      {deleteModal.open && (
        <Modal
          open
          title="Delete Gallery"
          onClose={() => setDeleteModal({ open: false, galleryId: null })}
          primaryAction={{
            content: 'Delete',
            destructive: true,
            onAction: () => {
              fetcher.submit(
                { actionType: 'delete', id: deleteModal.galleryId },
                { method: 'POST' }
              );
              setDeleteModal({ open: false, galleryId: null });
            },
          }}
          secondaryActions={[
            {
              content: 'Cancel',
              onAction: () => setDeleteModal({ open: false, galleryId: null }),
            },
          ]}
        >
          <Modal.Section>
            <TextContainer>
              <p>Are you sure you want to delete this gallery? This action cannot be undone.</p>
            </TextContainer>
          </Modal.Section>
        </Modal>
      )}

      {/* image modal */}
      {currentImage && (
        <Modal open onClose={() => setActiveGallery(null)} title="Image" large>
          <Modal.Section>
            <div style={{ position: 'relative', textAlign: 'center', padding: '20px 0' }}>
              <img
                src={currentImage.url}
                alt="Full"
                style={{
                  maxWidth: '100%',
                  maxHeight: '600px',
                  borderRadius: '8px',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
                }}
              />

              {/* Left/Right Arrows */}
              {activeGallery.images.length > 1 && (
                <>
                  <button
                    onClick={prevImage}
                    disabled={activeImageIndex === 0}
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: '10px',
                      transform: 'translateY(-50%)',
                      zIndex: 20,
                      backgroundColor: 'rgba(120, 118, 118, 0.5)',
                      border: 'none',
                      borderRadius: '50%',
                      width: '30px',
                      height: '30px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: activeImageIndex === 0 ? 'not-allowed' : 'pointer',
                    }}
                  >
                    <Icon source={ArrowLeftIcon} color="base" />
                  </button>

                  <button
                    onClick={nextImage}
                    disabled={activeImageIndex === activeGallery.images.length - 1}
                    style={{
                      position: 'absolute',
                      top: '50%',
                      right: '10px',
                      transform: 'translateY(-50%)',
                      zIndex: 20,
                      backgroundColor: 'rgba(71, 71, 71, 0.5)',
                      border: 'none',
                      borderRadius: '50%',
                      width: '30px',
                      height: '30px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor:
                        activeImageIndex === activeGallery.images.length - 1
                          ? 'not-allowed'
                          : 'pointer',
                    }}
                  >
                    <Icon source={ArrowRightIcon} color="base" />
                  </button>
                </>
              )}

              {/* Bottom Actions */}
              <div
                style={{
                  marginTop: '16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0 20px',
                }}
              >
                <div style={{ display: 'flex', gap: '10px' }}>
                  <Button
                    primary
                    size="slim"
                    disabled={currentImage.status === 'approved'}
                    onClick={() => {
                      const newGallery = { ...activeGallery };
                      newGallery.images[activeImageIndex].status = 'approved';
                      setActiveGallery(newGallery);
                      fetcher.submit({ type: 'image', id: currentImage.id, status: 'approved' }, { method: 'POST' });
                    }}
                  >
                    Approve
                  </Button>
                  <Button
                    destructive
                    size="slim"
                    disabled={currentImage.status === 'declined'}
                    onClick={() => {
                      const newGallery = { ...activeGallery };
                      newGallery.images[activeImageIndex].status = 'declined';
                      setActiveGallery(newGallery);
                      fetcher.submit({ type: 'image', id: currentImage.id, status: 'declined' }, { method: 'POST' });
                    }}
                  >
                    Decline
                  </Button>
                </div>

                <Badge
                  tone={
                    currentImage.status === 'approved'
                      ? 'success'
                      : currentImage.status === 'declined'
                      ? 'critical'
                      : 'warning'
                  }
                >
                  {capitalizeFirst(currentImage.status)}
                </Badge>
              </div>
            </div>
          </Modal.Section>
        </Modal>
      )}
    </Page>
  );
}
