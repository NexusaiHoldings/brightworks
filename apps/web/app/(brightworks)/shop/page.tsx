import { getSkus, formatPrice, type SkuSummary } from '@/lib/brightworks/skus';

export const metadata = {
  title: 'Shop — Brightworks',
  description: 'Browse our weatherproof roofline lighting products and accessories.',
};

export default async function ShopPage() {
  let skus: SkuSummary[] = [];
  let fetchError: string | null = null;

  try {
    skus = await getSkus();
  } catch (err) {
    fetchError = err instanceof Error ? err.message : 'Failed to load products.';
  }

  return (
    <main>
      <h1>Shop</h1>
      <p>Weatherproof roofline lighting — built for professional installers and homeowners alike.</p>

      {fetchError && (
        <div className="card">
          <p className="muted">Unable to load products right now. Please try again shortly.</p>
        </div>
      )}

      {!fetchError && skus.length === 0 && (
        <div className="empty">
          <p>No products available yet. Check back soon.</p>
        </div>
      )}

      {!fetchError && skus.length > 0 && (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {skus.map((sku) => (
            <li key={sku.id} className="card" style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h2 style={{ marginBottom: '0.25rem' }}>
                    <a href={`/shop/${sku.slug}`}>{sku.name}</a>
                    {sku.hasCertification && (
                      <span
                        style={{
                          marginLeft: '0.5rem',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          background: '#0070f3',
                          color: '#fff',
                          borderRadius: '4px',
                          padding: '2px 7px',
                          verticalAlign: 'middle',
                        }}
                      >
                        IP65
                      </span>
                    )}
                  </h2>
                  <p className="muted" style={{ marginTop: 0 }}>{sku.description}</p>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0, paddingLeft: '1rem' }}>
                  <p style={{ fontWeight: 700, fontSize: '1.1rem', margin: 0 }}>
                    {formatPrice(sku.priceCents)}
                  </p>
                  {!sku.inStock && <p className="muted" style={{ margin: 0 }}>Out of stock</p>}
                </div>
              </div>
              <div style={{ marginTop: '0.75rem' }}>
                <a href={`/shop/${sku.slug}`} className="btn secondary">View Details</a>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
