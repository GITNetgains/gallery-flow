import { useLoaderData, useFetcher } from '@remix-run/react';
import { json } from '@remix-run/node';
import {
  Page,
  DataTable,
  Button,
  Modal,
  TextContainer,
  Select,
  Card,
  Icon,
  Spinner,
} from '@shopify/polaris';
import { EditIcon, DeleteIcon, PlusIcon } from '@shopify/polaris-icons';
import { useState, useEffect } from 'react';
import db from '../db.server';
import {
  fetchProducts,
  fetchBlogs,
  fetchCollections,
  fetchPages,
  fetchSingleProduct,
  fetchSingleCollection,
  fetchSinglePage,
} from '../shopifyApiUtils';
import { authenticate } from '../shopify.server';

// -----------------------------
// Loader
// -----------------------------
export async function loader({ request }) {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const accessToken = session.accessToken;

  const events = await db.event.findMany({
    where: { shop },
    orderBy: { createdAt: 'desc' },
  });

  const [products, blogs, collections, pages, setting] = await Promise.all([
    fetchProducts(shop, accessToken),
    fetchBlogs(shop, accessToken),
    fetchCollections(shop, accessToken),
    fetchPages(shop, accessToken),
    db.setting.findUnique({ where: { shop } }),
  ]);

  return json({ events, products, blogs, collections, pages, setting, shop, accessToken });
}

// -----------------------------
// Action
// -----------------------------
export async function action({ request }) {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const accessToken = session.accessToken;

  const formData = await request.formData();
  const actionType = formData.get('actionType');

  let setting = await db.setting.findUnique({ where: { shop } });
  if (!setting) {
    setting = await db.setting.create({
      data: { shop, addEventEnabled: true },
    });
  }

  if (!setting.addEventEnabled && (actionType === 'createEvent' || actionType === 'editEvent')) {
    return json({ success: false, error: 'Adding events is currently disabled.' }, { status: 403 });
  }

  if (actionType === 'toggleAddEvent') {
    const enabled = formData.get('enabled') === 'true';
    await db.setting.upsert({
      where: { shop },
      update: { addEventEnabled: enabled },
      create: { shop, addEventEnabled: enabled },
    });
    return json({ success: true });
  }

  if (actionType === 'togglePurchaseEvent') {
    const enabled = formData.get('enabled') === 'true';
    await db.setting.upsert({
      where: { shop },
      update: { onlyPurchasedItem: enabled },
      create: { shop, onlyPurchasedItem: enabled },
    });
    return json({ success: true });
  }

  if (actionType === 'createEvent' || actionType === 'editEvent') {
    let type = formData.get('type');
    const itemId = formData.get('itemId');
    const date = formData.get('date');
    const eventId = formData.get('eventId');

    if (!type || !itemId) {
      return json({ success: false, error: 'Type and item are required' }, { status: 400 });
    }

    let itemData;
    switch (type) {
      case 'product':
        itemData = await fetchSingleProduct(shop, accessToken, itemId);
        break;
      case 'blog': {
        const blogs = await fetchBlogs(shop, accessToken);
        const article = blogs.flatMap(b => b.articles).find(a => a.id === itemId);
        if (!article) return json({ success: false, error: 'Article not found' }, { status: 400 });
        itemData = { id: article.id, title: article.title };
        type = 'article';
        break;
      }
      case 'collection':
        itemData = await fetchSingleCollection(shop, accessToken, itemId);
        break;
      case 'page':
        itemData = await fetchSinglePage(shop, accessToken, itemId);
        break;
      default:
        itemData = null;
    }

    if (!itemData) {
      return json({ success: false, error: 'Failed to fetch item data' }, { status: 400 });
    }

    let parsedDate = date ? new Date(date) : null;
    if (parsedDate && isNaN(parsedDate.getTime())) parsedDate = null;

    const data = {
      name: itemData.title,
      type,
      shopifyId: itemId,
      date: parsedDate,
      shop,
    };

    if (actionType === 'createEvent') {
      await db.event.create({ data });
    } else if (actionType === 'editEvent') {
      if (!eventId) return json({ success: false, error: 'Missing eventId' }, { status: 400 });
      await db.event.update({ where: { id: eventId }, data });
    }

    return json({ success: true });
  }

  if (actionType === 'deleteEvent') {
    const eventId = formData.get('eventId');
    await db.galleryUpload.deleteMany({ where: { eventId } });
    await db.event.delete({ where: { id: eventId } });
    return json({ success: true });
  }

  return json({ success: false, error: 'Invalid action' }, { status: 400 });
}

// -----------------------------
// Component
// -----------------------------
export default function AdminAddEvent() {
  const { events, products, blogs, collections, pages, setting } = useLoaderData();
  const fetcher = useFetcher();
  const isSubmitting = fetcher.state === 'submitting' || fetcher.state === 'loading';

  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [newEvent, setNewEvent] = useState({ id: '', type: '', itemId: '', date: '' });
  const [items, setItems] = useState([]);
  const [selectedBlogId, setSelectedBlogId] = useState('');
  const [blogArticles, setBlogArticles] = useState([]);
  const [filterType, setFilterType] = useState('all');

  const [addEventEnabled, setAddEventEnabled] = useState(setting?.addEventEnabled || false);
  const [onlyPurchasedItem, setOnlyPurchasedItem] = useState(setting?.onlyPurchasedItem || false);

  // Delete confirmation
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteEventId, setDeleteEventId] = useState(null);

  useEffect(() => {
    if (setting) {
      setAddEventEnabled(setting.addEventEnabled);
      setOnlyPurchasedItem(setting.onlyPurchasedItem);
    }
  }, [setting]);

  useEffect(() => {
    if (fetcher.data && fetcher.data.success) resetModalState();
  }, [fetcher.data]);

  useEffect(() => {
    switch (newEvent.type) {
      case 'product':
        setItems(products);
        break;
      case 'collection':
        setItems(collections);
        break;
      case 'page':
        setItems(pages);
        break;
      default:
        setItems([]);
    }
  }, [newEvent.type, products, collections, pages]);

  const handleEdit = (event) => {
    setNewEvent({
      id: event.id,
      type: event.type,
      itemId: event.shopifyId,
      date: event.date ? event.date.split('T')[0] : '',
    });

    if (event.type === 'blog' || event.type === 'article') {
      const blog = blogs.find((b) => b.articles.some((a) => a.id === event.shopifyId));
      if (blog) {
        setSelectedBlogId(blog.id);
        setBlogArticles(blog.articles);
      }
    } else {
      setSelectedBlogId('');
      setBlogArticles([]);
    }

    setIsEditing(true);
    setEventModalOpen(true);
  };

  const handleDeleteClick = (eventId) => {
    setDeleteEventId(eventId);
    setDeleteModalOpen(true);
  };

  const confirmDelete = () => {
    if (!deleteEventId) return;
    fetcher.submit({ actionType: 'deleteEvent', eventId: deleteEventId }, { method: 'POST' });
    setDeleteModalOpen(false);
    setDeleteEventId(null);
  };

  const resetModalState = () => {
    setEventModalOpen(false);
    setIsEditing(false);
    setNewEvent({ id: '', type: '', itemId: '', date: '' });
    setSelectedBlogId('');
    setBlogArticles([]);
  };

  const handleSubmit = () => {
    const form = document.getElementById('create-event-form');
    if (form) {
      const formData = new FormData(form);
      fetcher.submit(formData, { method: 'POST' });
    }
  };

  const filteredEvents =
    filterType === 'all'
      ? events
      : events.filter((e) => (filterType === 'blog' ? e.type === 'blog' || e.type === 'article' : e.type === filterType));

  return (
    <Page title="Manage gallery">
      <style>{`
        .toggle-switch {
          position: relative;
          width: 50px;
          height: 26px;
        }
        .toggle-switch input {
          opacity: 0;
          width: 0;
          height: 0;
        }
        .slider {
          position: absolute;
          cursor: pointer;
          top: 0; left: 0; right: 0; bottom: 0;
          background-color: #ccc;
          transition: .3s;
          border-radius: 34px;
        }
        .slider:before {
          position: absolute;
          content: "";
          height: 18px;
          width: 18px;
          left: 4px;
          bottom: 4px;
          background-color: white;
          transition: .3s;
          border-radius: 50%;
        }
        input:checked + .slider {
          background-color: #4b5563;
        }
        input:checked + .slider:before {
          transform: translateX(24px);
        }
      `}</style>

      {/* Purchase Toggle */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <span style={{ marginLeft: '10px', fontWeight: 600 }}>Only Buyers Can Upload</span>
        <label className="toggle-switch">
          <input
            type="checkbox"
            checked={onlyPurchasedItem}
            onChange={() => {
              const newVal = !onlyPurchasedItem;
              setOnlyPurchasedItem(newVal);
              const formData = new FormData();
              formData.append('actionType', 'togglePurchaseEvent');
              formData.append('enabled', newVal.toString());
              fetcher.submit(formData, { method: 'POST' });
            }}
          />
          <span className="slider"></span>
        </label>
      </div>

      {/* Add Event Button */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <button
          onClick={() => {
            resetModalState();
            setEventModalOpen(true);
            setIsEditing(false);
          }}
          disabled={!addEventEnabled}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: !addEventEnabled ? '#d1d5db' : 'linear-gradient(to bottom, #3d3c3cff, #111111)',
            color: !addEventEnabled ? '#6b7280' : 'white',
            border: 'none',
            borderRadius: '6px',
            padding: '6px 12px',
            fontWeight: '600',
            cursor: !addEventEnabled ? 'not-allowed' : 'pointer',
          }}
        >
          Add Items
          <Icon source={PlusIcon} color="baseWhite" />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <Select
            options={[
              { label: 'All', value: 'all' },
              { label: 'Product', value: 'product' },
              { label: 'Blog', value: 'blog' },
              { label: 'Collection', value: 'collection' },
              { label: 'Page', value: 'page' },
            ]}
            onChange={setFilterType}
            value={filterType}
            disabled={!addEventEnabled}
          />

          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={addEventEnabled}
              onChange={() => {
                const newVal = !addEventEnabled;
                setAddEventEnabled(newVal);
                const formData = new FormData();
                formData.append('actionType', 'toggleAddEvent');
                formData.append('enabled', newVal.toString());
                fetcher.submit(formData, { method: 'POST' });
              }}
            />
            <span className="slider"></span>
          </label>
        </div>
      </div>

      {/* Table */}
      {filteredEvents.length === 0 ? (
  <div style={{ textAlign: 'center', padding: '80px 20px' }}>
    <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>
      You don’t have any items yet
    </h2>
    <p style={{ color: '#6b7280', marginBottom: '20px' }}>
      Start by creating one to manage your gallery items
    </p>
    <button
      onClick={() => setEventModalOpen(true)}
      disabled={!addEventEnabled || isSubmitting}
      style={{
        background: !addEventEnabled ? '#d1d5db' : 'linear-gradient(to bottom, #3d3c3cff, #111111)',
        color: !addEventEnabled ? '#6b7280' : 'white',
        border: 'none',
        borderRadius: '6px',
        padding: '6px 12px',
        fontWeight: '600',
        cursor: !addEventEnabled || isSubmitting ? 'not-allowed' : 'pointer',
      }}
    >
      {isSubmitting ? <Spinner size="small" /> : 'Create your first item'}
    </button>
  </div>
) : (
  <Card>
    <div style={{ position: 'relative' }}>
      {isSubmitting && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(255,255,255,0.6)',
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Spinner size="large" color="inkLightest" />
        </div>
      )}

      <DataTable
        columnContentTypes={['text', 'text', 'text', 'text', 'text']}
        headings={['#', 'Name', 'Type', 'Date', 'Actions']}
        rows={filteredEvents.map((event, index) => [
          index + 1,
          event.name,
          event.type.charAt(0).toUpperCase() + event.type.slice(1),
          event.date ? new Date(event.date).toLocaleDateString() : 'N/A',
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button icon={EditIcon} onClick={() => handleEdit(event)} plain disabled={isSubmitting} />
            <Button icon={DeleteIcon} onClick={() => handleDeleteClick(event.id)} plain destructive disabled={isSubmitting} />
          </div>,
        ])}
      />
    </div>
  </Card>
)}


      {/* --- Event Create/Edit Modal --- */}
      <Modal
        open={eventModalOpen}
        onClose={resetModalState}
        title={isEditing ? 'Edit Event' : 'Add New Item'}
        primaryAction={{
          content: (
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {isSubmitting && <Spinner size="small" />}
              {isSubmitting ? 'Processing...' : isEditing ? 'Update' : 'Create'}
            </span>
          ),
          onAction: handleSubmit,
          disabled: isSubmitting,
        }}
      >
        <Modal.Section>
          <fetcher.Form method="POST" id="create-event-form">
            <input type="hidden" name="actionType" value={isEditing ? 'editEvent' : 'createEvent'} />
            {isEditing && <input type="hidden" name="eventId" value={newEvent.id} />}

            <TextContainer>
              <Select
                label="Type"
                options={[
                  { label: 'Select Type', value: '' },
                  { label: 'Product', value: 'product' },
                  { label: 'Blog', value: 'blog' },
                  { label: 'Collection', value: 'collection' },
                  { label: 'Page', value: 'page' },
                ]}
                onChange={(value) => {
                  setNewEvent((prev) => ({ ...prev, type: value, itemId: '' }));
                  if (value !== 'blog') {
                    setSelectedBlogId('');
                    setBlogArticles([]);
                  }
                }}
                value={newEvent.type}
                required
              />

              {newEvent.type === 'blog' && (
                <>
                  <Select
                    label="Select Blog Category"
                    options={[
                      { label: 'Select Blog', value: '' },
                      ...blogs.map((blog) => ({ label: blog.title, value: blog.id })),
                    ]}
                    onChange={(value) => {
                      setSelectedBlogId(value);
                      const selectedBlog = blogs.find((b) => b.id === value);
                      setBlogArticles(selectedBlog ? selectedBlog.articles : []);
                      setNewEvent((prev) => ({ ...prev, itemId: '' }));
                    }}
                    value={selectedBlogId}
                    required
                  />

                  <Select
                    label="Select Blog Article"
                    options={[
                      { label: 'Select Article', value: '' },
                      ...blogArticles.map((article) => ({ label: article.title, value: article.id })),
                    ]}
                    onChange={(value) => setNewEvent((prev) => ({ ...prev, itemId: value }))}
                    value={newEvent.itemId}
                    required
                  />
                </>
              )}

              {newEvent.type !== 'blog' && (
                <Select
                  label="Select Item"
                  options={[{ label: 'Select Item', value: '' }, ...items.map((i) => ({ label: i.title || i.handle, value: i.id }))]}
                  onChange={(value) => setNewEvent((prev) => ({ ...prev, itemId: value }))}
                  value={newEvent.itemId}
                  required
                />
              )}

              <input
                type="date"
                name="date"
                value={newEvent.date || ''}
                onChange={(e) => setNewEvent((prev) => ({ ...prev, date: e.target.value }))}
                style={{ width: '100%', padding: '8px', marginBottom: '10px', borderRadius: '4px', border: '1px solid #ccc' }}
              />

              <input type="hidden" name="type" value={newEvent.type} />
              <input type="hidden" name="itemId" value={newEvent.itemId} />
            </TextContainer>
          </fetcher.Form>
        </Modal.Section>
      </Modal>

      {/* --- Delete Confirmation Modal --- */}
      <Modal
        open={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Confirm Delete"
        primaryAction={{ content: 'Delete', destructive: true, onAction: confirmDelete }}
        secondaryActions={[{ content: 'Cancel', onAction: () => setDeleteModalOpen(false) }]}
      >
        <Modal.Section>
          <p>Are you sure you want to delete this event? This action cannot be undone.</p>
        </Modal.Section>
      </Modal>
    </Page>
  );
}
