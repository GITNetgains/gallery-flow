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

export async function loader({ params }) {
  const { customerId } = params;

  const galleries = await db.galleryUpload.findMany({
    where: {
      customerId: {
        endsWith: customerId,
      },
    },
    include: { images: true, event: true },
  });

  return json({ galleries, customerId });
}

export async function action({ request }) {
  const formData = await request.formData();
  const id = formData.get("id");
  const status = formData.get("status");
  const type = formData.get("type");
  const actionType = formData.get("actionType");

  if (actionType === "delete" && id) {
    await db.image.deleteMany({ where: { galleryId: id } });
    await db.galleryUpload.delete({ where: { id } });
    return json({ success: true });
  }

  if (!id || !status || !type) {
    return json({ success: false, error: "Missing data" }, { status: 400 });
  }

  if (type === "gallery") {
    await db.galleryUpload.update({ where: { id }, data: { status } });
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
      const searchLower = searchTerm.toLowerCase();
      return eventName.includes(searchLower);
    });
  }, [galleries, searchTerm]);

  // Calculate pagination
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
      <div style={{ 
      maxWidth: '200px', 
      wordWrap: 'break-word',
      whiteSpace: 'normal',
      
    }}>
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
                color:'transparent'
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
              marginLeft: '4px',
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
          <button type="submit" style={{ border: 'none', cursor: 'pointer', borderRadius: '50%', padding: '1px' }} title="Approve">
            <Icon source={CheckIcon} color="success" />
          </button>
        </fetcher.Form>

        <fetcher.Form method="POST">
          <input type="hidden" name="type" value="gallery" />
          <input type="hidden" name="id" value={gallery.id} />
          <input type="hidden" name="status" value="declined" />
          <button type="submit" style={{ border: 'none', cursor: 'pointer', borderRadius: '50%', padding: '1px' }} title="Decline">
            <Icon source={XIcon} color="critical" />
          </button>
        </fetcher.Form>

        <fetcher.Form method="POST">
          <input type="hidden" name="actionType" value="delete" />
          <input type="hidden" name="id" value={gallery.id} />
          <button type="submit" style={{ border: 'none', cursor: 'pointer' }} title="Delete">
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
    <Page title={`Gallery for Customer ID: ${customerId}`}>
      <div style={{ marginBottom: '20px', maxWidth: '400px' }}>
        <TextField
          label="Search galleries"
          labelHidden
          placeholder="Search by event name..."
          value={searchTerm}
          onChange={(value) => {
            setSearchTerm(value);
            setCurrentPage(1); // reset to first page when searching
          }}
          autoComplete="off"
          clearButton
          onClearButtonClick={() => {
            setSearchTerm('');
            setCurrentPage(1);
          }}
        />
      </div>

      {filteredGalleries.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '10px' }}>
            No galleries found
          </h2>
        </div>
      ) : (
        <>
          <DataTable
            columnContentTypes={['text', 'text', 'text', 'text', 'text']}
           headings={[
  <div style={{ textAlign: 'center' }}>#</div>,
  <div >Name</div>,
  <div style={{ textAlign: 'center' }}>Gallery Status</div>,
  <div style={{ textAlign: 'center' }}>Images</div>,
  <div style={{ textAlign: 'center' }}>Actions</div>
]}
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

          {/* Bottom section with status left, buttons right */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: '20px',
            }}
          >
            <Badge
              tone={
                currentImage.status === "approved" ? "success" :
                currentImage.status === "declined" ? "critical" :
                "warning"
              }
            >
              {currentImage.status.charAt(0).toUpperCase() + currentImage.status.slice(1)}
            </Badge>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                size="slim"
                onClick={() => handleApproveImage(currentImage.id)}
                style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      background: 'linear-gradient(to bottom, #dc5050ff, #7a2323ff)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '6px 12px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      boxShadow: '4px',
                      textDecorationSkip: 'none',
                    }}
              >
                Approve
              </button>
              <button
                size="slim"
                onClick={() => handleDeclineImage(currentImage.id)}
                 style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      background: 'linear-gradient(to bottom, #3d3c3cff, #111111)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '6px 12px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      boxShadow: '4px',
                      textDecorationSkip: 'none',
                    }}
              >
                Decline
              </button>
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
