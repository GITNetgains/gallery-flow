

import { useLoaderData, useFetcher } from '@remix-run/react';
import { json } from '@remix-run/node';
import { Page, DataTable, Button, Modal, TextContainer, Select, Card, Icon } from '@shopify/polaris';
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

export async function loader() {
  const events = await db.event.findMany({
    orderBy: { createdAt: 'desc' },
  });

  const [products, blogs, collections, pages, setting] = await Promise.all([
    fetchProducts(),
    fetchBlogs(),
    fetchCollections(),
    fetchPages(),
    db.setting.findUnique({ where: { id: 'global-setting' } }),
  ]);

  return json({ events, products, blogs, collections, pages, setting });
}

export async function action({ request }) {
  const formData = await request.formData();
  const actionType = formData.get("actionType");

  // Fetch setting
  const setting = await db.setting.findUnique({ where: { id: "global-setting" } });

  if (!setting.addEventEnabled && (actionType === "createEvent" || actionType === "editEvent")) {
    return json({ success: false, error: "Adding events is currently disabled." }, { status: 403 });
  }

  if (actionType === "toggleAddEvent") {
    const enabled = formData.get("enabled") === "true";
    await db.setting.update({
      where: { id: "global-setting" },
      data: { addEventEnabled: enabled },
    });
    return json({ success: true });
  }

  if (actionType === "createEvent" || actionType === "editEvent") {
    let type = formData.get("type");
    const itemId = formData.get("itemId");
    const date = formData.get("date");
    const eventId = formData.get("eventId");

    if (!type || !itemId) {
      return json({ success: false, error: "Type and item are required" }, { status: 400 });
    }

    let itemData;
    switch (type) {
      case "product":
        itemData = await fetchSingleProduct(itemId);
        break;
       case "blog":
    const blogs = await fetchBlogs();
    const article = blogs.flatMap(b => b.articles).find(a => a.id === itemId);
    if (!article) return json({ success: false, error: "Article not found" }, { status: 400 });
    itemData = { id: article.id, title: article.title };
    type = "article";
    break;
      case "collection":
        itemData = await fetchSingleCollection(itemId);
        break;
      case "page":
        itemData = await fetchSinglePage(itemId);
        break;
      default:
        itemData = null;
    }

    if (!itemData) {
      return json({ success: false, error: "Failed to fetch item data" }, { status: 400 });
    }

    const data = {
      name: itemData.title,
      type,
      shopifyId: itemId,
      date: date ? new Date(date) : null,
    };

    if (actionType === "createEvent") {
      await db.event.create({ data });
    } else if (actionType === "editEvent") {
      if (!eventId) {
        return json({ success: false, error: "Missing eventId for editing" }, { status: 400 });
      }

      const existing = await db.event.findUnique({ where: { id: eventId } });
      if (!existing) {
        return json({ success: false, error: "Event not found" }, { status: 404 });
      }

      await db.event.update({ where: { id: eventId }, data });
    }

    return json({ success: true });
  }

  if (actionType === "deleteEvent") {
    const eventId = formData.get("eventId");

    await db.galleryUpload.deleteMany({
      where: { eventId },
    });

    await db.event.delete({
      where: { id: eventId },
    });

    return json({ success: true });
  }

  return json({ success: false, error: "Invalid action" }, { status: 400 });
}

export default function AdminAddEvent() {
  const { events, products, blogs, collections, pages, setting } = useLoaderData();
  const fetcher = useFetcher();
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [newEvent, setNewEvent] = useState({ id: "", type: "", itemId: "", date: "" });
  const [items, setItems] = useState([]);
  const [selectedBlogId, setSelectedBlogId] = useState("");
  const [blogArticles, setBlogArticles] = useState([]);
  const [filterType, setFilterType] = useState("all");

  useEffect(() => {
    if (fetcher.data && fetcher.data.success) {
      resetModalState();
    }
  }, [fetcher.data]);

  useEffect(() => {
    switch (newEvent.type) {
      case "product":
        setItems(products);
        break;
      case "collection":
        setItems(collections);
        break;
      case "page":
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
      date: event.date ? event.date.split('T')[0] : "",
    });

    if (event.type === "blog") {
      const blog = blogs.find(b => b.articles.some(a => a.id === event.shopifyId));
      if (blog) {
        setSelectedBlogId(blog.id);
        setBlogArticles(blog.articles);
      }
    } else {
      setSelectedBlogId("");
      setBlogArticles([]);
    }

    setIsEditing(true);
    setEventModalOpen(true);
  };

  const handleDelete = (eventId) => {
    if (confirm("Are you sure you want to delete this event?")) {
      fetcher.submit({ actionType: "deleteEvent", eventId }, { method: "POST" });
    }
  };

  const resetModalState = () => {
    setEventModalOpen(false);
    setIsEditing(false);
    setNewEvent({ id: "", type: "", itemId: "", date: "" });
    setSelectedBlogId("");
    setBlogArticles([]);
  };

  const handleSubmit = () => {
    const form = document.getElementById("create-event-form");
    if (form) {
      const formData = new FormData(form);
      fetcher.submit(formData, { method: "POST" });
    }
  };

  const filteredEvents = filterType === "all" 
  ? events 
  : events.filter(e => 
      filterType === "blog" 
        ? e.type === "blog" || e.type === "article" 
        : e.type === filterType
    );

  const toggleAddEvent = () => {
    fetcher.submit(
      { actionType: "toggleAddEvent", enabled: !setting.addEventEnabled },
      { method: "POST" }
    );
  };

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
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: #ccc;
          transition: .4s;
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
          transition: .4s;
          border-radius: 50%;
        }
        input:checked + .slider {
          background-color: #4b5563;
        }
        input:checked + .slider:before {
          transform: translateX(24px);
        }
      `}</style>

     <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
  <button
    onClick={() => {
      setEventModalOpen(true);
      setIsEditing(false);
      setNewEvent({ id: "", type: "", itemId: "", date: "" });
      setSelectedBlogId("");
      setBlogArticles([]);
    }}
    disabled={!setting.addEventEnabled}
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      background: !setting.addEventEnabled
        ? '#d1d5db'
        : 'linear-gradient(to bottom, #3d3c3cff, #111111)',
      color: !setting.addEventEnabled ? '#6b7280' : 'white',
      border: 'none',
      borderRadius: '6px',
      padding: '6px 12px',
      fontWeight: '600',
      cursor: !setting.addEventEnabled ? 'not-allowed' : 'pointer',
      boxShadow:'4px'
    }}
  >
    Add Items
    <Icon source={PlusIcon} color="baseWhite" />
  </button>

  <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
    <Select
      
      options={[
        { label: "All", value: "all" },
        { label: "Product", value: "product" },
        { label: "Blog", value: "blog" },
        { label: "Collection", value: "collection" },
        { label: "Page", value: "page" },
      ]}
      onChange={setFilterType}
      value={filterType}
        disabled={!setting.addEventEnabled} 
    />

    <label className="toggle-switch">
      <input
        type="checkbox"
        checked={setting.addEventEnabled}
        onChange={(e) => {
          const formData = new FormData();
          formData.append("actionType", "toggleAddEvent");
          formData.append("enabled", (!setting.addEventEnabled).toString());
          fetcher.submit(formData, { method: "POST" });
        }}
      />
      <span className="slider"></span>
    </label>
  </div>
</div>

      {filteredEvents.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 20px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>
            You don’t have any items yet
          </h2>
          <p style={{ color: '#6b7280', marginBottom: '20px' }}>
            Start by creating one to manage your gallery items
          </p>
          <button
            onClick={() => {
              setEventModalOpen(true);
              setIsEditing(false);
              setNewEvent({ id: "", type: "", itemId: "", date: "" });
              setSelectedBlogId("");
              setBlogArticles([]);
            }}
           disabled={!setting.addEventEnabled}
    style={{
    
      gap: '8px',
      background: !setting.addEventEnabled
        ? '#d1d5db'
        : 'linear-gradient(to bottom, #3d3c3cff, #111111)',
      color: !setting.addEventEnabled ? '#6b7280' : 'white',
      border: 'none',
      borderRadius: '6px',
      padding: '6px 12px',
      fontWeight: '600',
      cursor: !setting.addEventEnabled ? 'not-allowed' : 'pointer',
      boxShadow:'4px'
    }}
          >
            Create your first item
          </button>
        </div>
      ) : (
        <Card>
          <DataTable
            columnContentTypes={['text', 'text', 'text', 'text', 'text']}
            headings={['#', 'Name', 'Type', 'Date', 'Actions']}
           rows={filteredEvents.map((event, index) => [
  index + 1,
  event.name,
  event.type.charAt(0).toUpperCase() + event.type.slice(1),
  event.date ? new Date(event.date).toLocaleDateString() : "N/A",
  <div style={{ display: "flex", gap: "8px" }}>
    <Button icon={EditIcon} onClick={() => handleEdit(event)} plain />
    <Button icon={DeleteIcon} onClick={() => handleDelete(event.id)} plain destructive />
  </div>
])}

          />
        </Card>
      )}

      <Modal
        open={eventModalOpen}
        onClose={resetModalState}
        title={isEditing ? "Edit Event" : "Add New Item"}
        primaryAction={{
          content: isEditing ? "Update" : "Create",
          onAction: handleSubmit,
        }}
      >
        <Modal.Section>
          <fetcher.Form method="POST" id="create-event-form">
            <input type="hidden" name="actionType" value={isEditing ? "editEvent" : "createEvent"} />
            {isEditing && <input type="hidden" name="eventId" value={newEvent.id} />}

            <TextContainer>
              <Select
                label="Type"
                options={[
                  { label: "Select Type", value: "" },
                  { label: "Product", value: "product" },
                  { label: "Blog", value: "blog" },
                  { label: "Collection", value: "collection" },
                  { label: "Page", value: "page" },
                ]}
                onChange={(value) => {
                  setNewEvent(prev => ({ ...prev, type: value, itemId: "" }));
                  if (value !== "blog") {
                    setSelectedBlogId("");
                    setBlogArticles([]);
                  }
                }}
                value={newEvent.type}
                required
              />

              {newEvent.type === "blog" && (
                <>
                  <Select
                    label="Select Blog Category"
                    options={[
                      { label: "Select Blog", value: "" },
                      ...blogs.map(blog => ({ label: blog.title, value: blog.id })),
                    ]}
                    onChange={(value) => {
                      setSelectedBlogId(value);
                      const selectedBlog = blogs.find(b => b.id === value);
                      setBlogArticles(selectedBlog ? selectedBlog.articles : []);
                      setNewEvent(prev => ({ ...prev, itemId: "" }));
                    }}
                    value={selectedBlogId}
                    required
                  />

                  <Select
                    label="Select Blog Article"
                    options={[
                      { label: "Select Article", value: "" },
                      ...blogArticles.map(article => ({ label: article.title, value: article.id })),
                    ]}
                    onChange={(value) => setNewEvent(prev => ({ ...prev, itemId: value }))}
                    value={newEvent.itemId}
                    required
                  />
                </>
              )}

              {newEvent.type !== "blog" && (
                <Select
                  label="Select Item"
                  options={[
                    { label: "Select Item", value: "" },
                    ...items.map(i => ({ label: i.title || i.handle, value: i.id })),
                  ]}
                  onChange={(value) => setNewEvent(prev => ({ ...prev, itemId: value }))}
                  value={newEvent.itemId}
                  required
                />
              )}

              <input
                type="date"
                name="date"
                value={newEvent.date}
                onChange={(e) => setNewEvent(prev => ({ ...prev, date: e.target.value }))}
                style={{ width: "100%", padding: "8px", marginBottom: "10px", borderRadius: "4px", border: "1px solid #ccc" }}
              />

              <input type="hidden" name="type" value={newEvent.type} />
              <input type="hidden" name="itemId" value={newEvent.itemId} />
            </TextContainer>
          </fetcher.Form>
        </Modal.Section>
      </Modal>
    </Page>
  );
}
