async function paginateQuery(query, extractFn) {
  let hasNextPage = true;
  let endCursor = null;
  let allItems = [];

  while (hasNextPage) {
    const res = await fetch(`https://${process.env.SHOPIFY_STORE_DOMAIN}/admin/api/2024-04/graphql.json`, {
      method: "POST",
      headers: {
        "X-Shopify-Access-Token": process.env.SHOPIFY_ADMIN_ACCESS_TOKEN,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        variables: { after: endCursor },
      }),
    });

    const json = await res.json();

    if (!res.ok || json.errors) {
      console.error("Shopify API error:", json.errors || await res.text());
      throw new Error("Failed to fetch data from Shopify");
    }

    const { items, pageInfo } = extractFn(json);
    allItems = allItems.concat(items);

    hasNextPage = pageInfo.hasNextPage;
    endCursor = pageInfo.endCursor;
  }

  return allItems;
}

export async function fetchProducts() {
  return await paginateQuery(
    `
      query($after: String) {
        products(first: 100, after: $after) {
          edges {
            node {
              id
              title
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    `,
    (json) => ({
      items: json.data.products.edges.map(edge => ({
        id: edge.node.id,
        title: edge.node.title,
      })),
      pageInfo: json.data.products.pageInfo,
    })
  );
}

export async function fetchCollections() {
  return await paginateQuery(
    `
      query($after: String) {
        collections(first: 100, after: $after) {
          edges {
            node {
              id
              title
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    `,
    (json) => ({
      items: json.data.collections.edges.map(edge => ({
        id: edge.node.id,
        title: edge.node.title,
      })),
      pageInfo: json.data.collections.pageInfo,
    })
  );
}

export async function fetchBlogs() {
  return await paginateQuery(
    `
      query($after: String) {
        blogs(first: 50, after: $after) {
          edges {
            node {
              id
              title
              articles(first: 100) {
                edges {
                  node {
                    id
                    title
                  }
                }
              }
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    `,
    (json) => ({
      items: json.data.blogs.edges.map(edge => ({
        id: edge.node.id,
        title: edge.node.title,
        articles: edge.node.articles.edges.map(articleEdge => ({
          id: articleEdge.node.id,
          title: articleEdge.node.title,
        })),
      })),
      pageInfo: json.data.blogs.pageInfo,
    })
  );
}

export async function fetchPages() {
  return await paginateQuery(
    `
      query($after: String) {
        pages(first: 100, after: $after) {
          edges {
            node {
              id
              title
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    `,
    (json) => ({
      items: json.data.pages.edges.map(edge => ({
        id: edge.node.id,
        title: edge.node.title,
      })),
      pageInfo: json.data.pages.pageInfo,
    })
  );
}

// Single fetchers remain the same:

export async function fetchSingleProduct(productId) {
  const res = await fetch(`https://${process.env.SHOPIFY_STORE_DOMAIN}/admin/api/2024-04/graphql.json`, {
    method: "POST",
    headers: {
      "X-Shopify-Access-Token": process.env.SHOPIFY_ADMIN_ACCESS_TOKEN,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: `
        query ($id: ID!) {
          product(id: $id) {
            id
            title
          }
        }
      `,
      variables: { id: productId },
    }),
  });

  const data = await res.json();
  return {
    id: data.data.product.id,
    title: data.data.product.title,
  };
}

export async function fetchSingleCollection(collectionId) {
  const res = await fetch(`https://${process.env.SHOPIFY_STORE_DOMAIN}/admin/api/2024-04/graphql.json`, {
    method: "POST",
    headers: {
      "X-Shopify-Access-Token": process.env.SHOPIFY_ADMIN_ACCESS_TOKEN,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: `
        query($id: ID!) {
          collection(id: $id) {
            id
            title
          }
        }
      `,
      variables: { id: collectionId },
    }),
  });

  const data = await res.json();
  return {
    id: data.data.collection.id,
    title: data.data.collection.title,
  };
}

export async function fetchSinglePage(pageId) {
  const res = await fetch(`https://${process.env.SHOPIFY_STORE_DOMAIN}/admin/api/2024-04/graphql.json`, {
    method: "POST",
    headers: {
      "X-Shopify-Access-Token": process.env.SHOPIFY_ADMIN_ACCESS_TOKEN,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: `
        query($id: ID!) {
          page(id: $id) {
            id
            title
          }
        }
      `,
      variables: { id: pageId },
    }),
  });

  const data = await res.json();
  return {
    id: data.data.page.id,
    title: data.data.page.title,
  };
}
