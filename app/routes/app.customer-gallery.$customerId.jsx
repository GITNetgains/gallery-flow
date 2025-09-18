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
import { authenticate } from "../shopify.server"; // ✅

export async function loader({ request, params }) {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const { customerId } = params;

  const galleries = await db.galleryUpload.findMany({
    where: {
      shop,
      customerId: {
        endsWith: customerId,
      },
    },
    include: { images: true, event: true },
  });

  return json({ galleries, customerId, shop });
}

export async function action({ request }) {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const formData = await request.formData();
  const id = formData.get("id");
  const status = formData.get("status");
  const type = formData.get("type");
  const actionType = formData.get("actionType");

  // Delete gallery
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
  const { galleries, customerId } = useLoaderData();
  const [activeGallery, setActiveGallery] = useState(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const fetcher = useFetcher();
  const itemsPerPage = 10;

  const filteredGalleries = useMemo(() => {
    if (!searchTerm) return galleries;
    return galleries.filter(gallery => {
      const eventName = gallery.event?.name?.toLowerCase() || '';
      return eventName.includes(searchTerm.toLowerCase());
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

    return [
      (currentPage - 1) * itemsPerPage + index + 1,
      <div style={{ maxWidth: '200px', wordWrap: 'break-word', whiteSpace: 'normal' }}>
        {gallery.event ? gallery.event.name : gallery.itemName || "N/A"}
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
        <fetcher.Form method="POST">
          <input type="hidden" name="type" value="gallery" />
          <input type="hidden" name="id" value={gallery.id} />
          <input type="hidden" name="status" value="approved" />
          <button type="submit" title="Approve">
            <Icon source={CheckIcon} color="success" />
          </button>
        </fetcher.Form>
        <fetcher.Form method="POST">
          <input type="hidden" name="type" value="gallery" />
          <input type="hidden" name="id" value={gallery.id} />
          <input type="hidden" name="status" value="declined" />
          <button type="submit" title="Decline">
            <Icon source={XIcon} color="critical" />
          </button>
        </fetcher.Form>
        <fetcher.Form method="POST">
          <input type="hidden" name="actionType" value="delete" />
          <input type="hidden" name="id" value={gallery.id} />
          <button type="submit" title="Delete">
            <Icon source={DeleteIcon} color="critical" />
          </button>
        </fetcher.Form>
      </div>,
    ];
  });

  const handleApproveImage = (id) =>
    fetcher.submit({ type: 'image', id, status: 'approved' }, { method: 'POST' });
  const handleDeclineImage = (id) =>
    fetcher.submit({ type: 'image', id, status: 'declined' }, { method: 'POST' });

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
          placeholder="Search by event name..."
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

      {/* image modal */}
      {currentImage && (
        <Modal open onClose={() => setActiveGallery(null)} title="Image Details" large>
          <div style={{ padding: '20px' }}>
            <Modal.Section>
              <TextContainer>
                <div style={{ textAlign: 'center' }}>
                  <img src={currentImage.url} alt="Full" style={{ maxWidth: '100%', maxHeight: '600px' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px' }}>
                  <Badge tone={currentImage.status === "approved" ? "success" :
                              currentImage.status === "declined" ? "critical" : "warning"}>
                    {capitalizeFirst(currentImage.status)}
                  </Badge>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button onClick={() => handleApproveImage(currentImage.id)}>Approve</button>
                    <button onClick={() => handleDeclineImage(currentImage.id)}>Decline</button>
                  </div>
                </div>
              </TextContainer>
            </Modal.Section>
          </div>
        </Modal>
      )}
    </Page>
  );
}
