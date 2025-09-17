// shopifyApiUtils.js

// -----------------------------
// Pagination Helper
// -----------------------------
async function paginateQuery(shop, accessToken, query, extractFn) {
  let hasNextPage = true;
  let endCursor = null;
  let allItems = [];

  while (hasNextPage) {
    try {
      const res = await fetch(`https://${shop}/admin/api/2025-07/graphql.json`, {
        method: "POST",
        headers: {
          "X-Shopify-Access-Token": accessToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query,
          variables: { after: endCursor },
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error(`Shopify API Error (Response not OK): ${errorText}`);
        throw new Error(`Failed to fetch data from Shopify. Status: ${res.status}`);
      }

      const json = await res.json();
      
      if (json.errors) {
        console.error("Shopify API error:", json.errors);
        throw new Error(`Shopify API error: ${JSON.stringify(json.errors)}`);
      }

      const { items, pageInfo } = extractFn(json);
      allItems = allItems.concat(items);

      hasNextPage = pageInfo.hasNextPage;
      endCursor = pageInfo.endCursor;
      
    } catch (error) {
      console.error(`Error occurred while paginating data from Shopify: ${error.message}`);
      throw error; // rethrow to be handled by the calling function
    }
  }

  return allItems;
}

// -----------------------------
// Multi-store Fetchers
// -----------------------------
export async function fetchProducts(shop, accessToken) {
  try {
    return await paginateQuery(
      shop,
      accessToken,
      `
        query($after: String) {
          products(first: 100, after: $after) {
            edges {
              node { id title }
            }
            pageInfo { hasNextPage endCursor }
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
  } catch (error) {
    console.error(`Failed to fetch products for shop ${shop}: ${error.message}`);
    throw error;  // rethrow the error to be handled elsewhere if necessary
  }
}

export async function fetchCollections(shop, accessToken) {
  try {
    return await paginateQuery(
      shop,
      accessToken,
      `
        query($after: String) {
          collections(first: 100, after: $after) {
            edges {
              node { id title }
            }
            pageInfo { hasNextPage endCursor }
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
  } catch (error) {
    console.error(`Failed to fetch collections for shop ${shop}: ${error.message}`);
    throw error;  // rethrow the error to be handled elsewhere if necessary
  }
}

export async function fetchBlogs(shop, accessToken) {
  try {
    return await paginateQuery(
      shop,
      accessToken,
      `
        query($after: String) {
          blogs(first: 50, after: $after) {
            edges {
              node {
                id
                title
                articles(first: 100) {
                  edges { node { id title } }
                }
              }
            }
            pageInfo { hasNextPage endCursor }
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
  } catch (error) {
    console.error(`Failed to fetch blogs for shop ${shop}: ${error.message}`);
    throw error;
  }
}

export async function fetchPages(shop, accessToken) {
  try {
    return await paginateQuery(
      shop,
      accessToken,
      `
        query($after: String) {
          pages(first: 100, after: $after) {
            edges {
              node { id title }
            }
            pageInfo { hasNextPage endCursor }
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
  } catch (error) {
    console.error(`Failed to fetch pages for shop ${shop}: ${error.message}`);
    throw error;
  }
}

// -----------------------------
// Single Item Fetchers
// -----------------------------
export async function fetchSingleProduct(shop, accessToken, productId) {
  try {
    const res = await fetch(`https://${shop}/admin/api/2025-07/graphql.json`, {
      method: "POST",
      headers: {
        "X-Shopify-Access-Token": accessToken,
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

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`Error fetching product ${productId}: ${errorText}`);
      throw new Error(`Failed to fetch product: ${res.status}`);
    }

    const data = await res.json();

    if (data.errors) {
      console.error(`Shopify API error for product ${productId}: ${JSON.stringify(data.errors)}`);
      throw new Error(`Error fetching product ${productId}`);
    }

    return {
      id: data.data.product.id,
      title: data.data.product.title,
    };
  } catch (error) {
    console.error(`Failed to fetch single product for shop ${shop}: ${error.message}`);
    throw error;
  }
}

export async function fetchSingleCollection(shop, accessToken, collectionId) {
  try {
    const res = await fetch(`https://${shop}/admin/api/2025-07/graphql.json`, {
      method: "POST",
      headers: {
        "X-Shopify-Access-Token": accessToken,
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

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`Error fetching collection ${collectionId}: ${errorText}`);
      throw new Error(`Failed to fetch collection: ${res.status}`);
    }

    const data = await res.json();

    if (data.errors) {
      console.error(`Shopify API error for collection ${collectionId}: ${JSON.stringify(data.errors)}`);
      throw new Error(`Error fetching collection ${collectionId}`);
    }

    return {
      id: data.data.collection.id,
      title: data.data.collection.title,
    };
  } catch (error) {
    console.error(`Failed to fetch single collection for shop ${shop}: ${error.message}`);
    throw error;
  }
}

export async function fetchSinglePage(shop, accessToken, pageId) {
  try {
    const res = await fetch(`https://${shop}/admin/api/2025-07/graphql.json`, {
      method: "POST",
      headers: {
        "X-Shopify-Access-Token": accessToken,
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

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`Error fetching page ${pageId}: ${errorText}`);
      throw new Error(`Failed to fetch page: ${res.status}`);
    }

    const data = await res.json();

    if (data.errors) {
      console.error(`Shopify API error for page ${pageId}: ${JSON.stringify(data.errors)}`);
      throw new Error(`Error fetching page ${pageId}`);
    }

    return {
      id: data.data.page.id,
      title: data.data.page.title,
    };
  } catch (error) {
    console.error(`Failed to fetch single page for shop ${shop}: ${error.message}`);
    throw error;
  }
}
