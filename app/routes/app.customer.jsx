import React, { useMemo, useState } from 'react';
import { useLoaderData, useFetcher, Link } from '@remix-run/react';
import { json } from '@remix-run/node';
import { Page, DataTable, Button, Badge, TextField, Pagination } from '@shopify/polaris';
import { DeleteIcon } from '@shopify/polaris-icons';
import db from '../db.server';

export async function loader() {
  const galleries = await db.galleryUpload.findMany({
    include: { images: true, event: true },
  });
  return json({ galleries });
}

export async function action({ request }) {
  const formData = await request.formData();
  const email = formData.get("email");

  if (email) {
    const galleries = await db.galleryUpload.findMany({ where: { email } });
    for (const gallery of galleries) {
      await db.image.deleteMany({ where: { galleryId: gallery.id } });
    }
    await db.galleryUpload.deleteMany({ where: { email } });
    return json({ success: true });
  }

  return json({ success: false, error: "Missing email" }, { status: 400 });
}

const capitalizeFirst = (str) => str.charAt(0).toUpperCase() + str.slice(1);

export default function CustomersPage() {
  const { galleries } = useLoaderData();
  const fetcher = useFetcher();

  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const customers = useMemo(() => {
    const grouped = {};
    galleries.forEach(gallery => {
      const email = gallery.email || 'Unknown';
      if (!grouped[email]) {
        grouped[email] = {
          customerId: gallery.customerId,
          email,
          types: new Set(),
          status: new Set(),
        };
      }

      // Add general gallery item type
      if (gallery.itemType) grouped[email].types.add(gallery.itemType);

      // Add event type if exists
      if (gallery.event && gallery.event.type) {
        // Map 'article' back to 'blog' for display if needed
        grouped[email].types.add(gallery.event.type === 'article' ? 'blog' : gallery.event.type);
      }

      // Add status
      if (gallery.status) grouped[email].status.add(gallery.status);
    });

    return Object.values(grouped).map(c => ({
      ...c,
      types: Array.from(c.types),
      status: Array.from(c.status),
    }));
  }, [galleries]);

  // Filter customers by search
  const filteredCustomers = customers.filter(c =>
    c.email.toLowerCase().includes(search.toLowerCase())
  );

  // Calculate paginated data
  const totalPages = Math.ceil(filteredCustomers.length / itemsPerPage);
  const paginatedCustomers = filteredCustomers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const rows = paginatedCustomers.map((customer, index) => [
    (currentPage - 1) * itemsPerPage + index + 1,
    customer.email,
    <Link to={`/app/customer-gallery/${encodeURIComponent(customer.customerId.split('/').pop())}`}>
      {customer.customerId.split('/').pop()}
    </Link>,
    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
      {customer.types.length === 0 ? (
        <span style={{ color: '#999' }}>N/A</span>
      ) : (
        customer.types.map((type, idx) => (
          <span
            key={idx}
            style={{
              border: '1px solid #ccc',
              borderRadius: '12px',
              padding: '2px 8px',
              fontSize: '12px',
            }}
          >
            {type.charAt(0).toUpperCase() + type.slice(1)}
          </span>
        ))
      )}
    </div>,
    customer.status.map(s => (
      <Badge key={s} tone={
        s === "approved" ? "success" :
        s === "declined" ? "critical" :
        "warning"
      }>
         {capitalizeFirst(s)}
      </Badge>
    )),
    <fetcher.Form method="post">
      <input type="hidden" name="email" value={customer.email} />
      <Button destructive icon={DeleteIcon} submit>
        Delete
      </Button>
    </fetcher.Form>
  ]);

  return (
    customers.length === 0 ? (
      <div style={{
        textAlign: 'center',
        padding: '80px 20px',
        border: '1px dashed #ccc',
        borderRadius: '8px'
      }}>
        <img
          src="https://cdn-icons-png.flaticon.com/512/4076/4076508.png"
          alt="No customers illustration"
          style={{ width: '120px', marginBottom: '20px', opacity: 0.6 }}
        />
        <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>
          No customers yet
        </h2>
        <p style={{ color: '#6b7280' }}>
          There are no customers uploaded at the moment. Add the gallery upload section to your theme to let customers submit their galleries.
        </p>
      </div>
    ) : (
      <Page title="Customer Galleries" subtitle="Manage customer gallery submissions">
        <TextField
          label="Search customers"
          value={search}
          onChange={setSearch}
          placeholder="Search by email"
          autoComplete="off"
        />
        <div style={{ marginTop: '20px' }}>
          <DataTable
            columnContentTypes={['text','text','text','text','text','text']}
            headings={['#','Email','Customer ID','Types Uploaded','Status','Actions']}
            rows={rows}
          />
        </div>
        <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'center' }}>
          <Pagination
            hasPrevious={currentPage > 1}
            onPrevious={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            hasNext={currentPage < totalPages}
            onNext={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
          />
        </div>
      </Page>
    )
  );
}