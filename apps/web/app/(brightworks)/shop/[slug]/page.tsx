import { notFound } from 'next/navigation';
import { getSkuBySlug, formatPrice, type SkuDetail, type Certification } from '@/lib/brightworks/skus';

interface Props {
  params: { slug: string };
}

export async function generateMetadata({ params }: Props) {
  const sku = await getSkuBySlug(params.slug);
  if (!sku) {
    return { title: 'Product Not Found — Brightworks' };
  }
  return {
    title: `${sku.name} — Brightworks Shop`,
    description: sku.description ?? undefined,
  };
}

function CertificationRow({ cert }: { cert: Certification }) {
  return (
    <tr>
      <td>{cert.certType}</td>
      <td>{cert.fileNumber}</td>
      <td>{cert.issuedAt ?? '—'}</td>
      <td>{cert.expiresAt ?? '—'}</td>
      <td>
        {cert.labPdfUrl ? (
          <a href={cert.labPdfUrl} target="_blank" rel="noopener noreferrer">
            View PDF
          </a>
        ) : (
          <span className="muted">Not available</span>
        )}
      </td>
    </tr>
  );
}

export default async function SkuDetailPage({ params }: Props) {
  let sku: SkuDetail | null = null;

  try {
    sku = await getSkuBySlug(params.slug);
  } catch {
    sku = null;
  }

  if (!sku) {
    notFound();
  }

  const hasValidCertification = sku.certifications.length > 0;

  return (
    <main>
      <p className="muted">
        <a href="/shop">← Back to Shop</a>
      </p>

      <h1>
        {sku.name}
        {hasValidCertification && (
          <span
            style={{
              marginLeft: '0.75rem',
              fontSize: '0.8rem',
              fontWeight: 600,
              background: '#0070f3',
              color: '#fff',
              borderRadius: '4px',
              padding: '3px 9px',
              verticalAlign: 'middle',
            }}
          >
            IP65
          </span>
        )}
      </h1>

      <p>{sku.description}</p>

      <div className="card">
        <p style={{ margin: 0 }}>
          <strong>Price:</strong> {formatPrice(sku.priceCents)}
        </p>
        <p style={{ margin: '0.5rem 0 0' }}>
          <strong>Category:</strong> {sku.category}
        </p>
        <p style={{ margin: '0.5rem 0 0' }}>
          <strong>Availability:</strong>{' '}
          {sku.inStock ? 'In Stock' : <span className="muted">Out of Stock</span>}
        </p>
      </div>

      <h2>Certifications &amp; Compliance</h2>

      {hasValidCertification ? (
        <>
          <p>
            This product has been tested and certified by a Nationally Recognized Testing Laboratory
            (NRTL) per OSHA 29 CFR 1910.303. The IP65 rating has been independently substantiated.
          </p>
          <table>
            <thead>
              <tr>
                <th>Type</th>
                <th>File / Listing No.</th>
                <th>Issued</th>
                <th>Expires</th>
                <th>Lab Report</th>
              </tr>
            </thead>
            <tbody>
              {sku.certifications.map((cert) => (
                <CertificationRow key={cert.id} cert={cert} />
              ))}
            </tbody>
          </table>
        </>
      ) : (
        <div className="empty">
          <p>No NRTL certification records on file for this product. The IP65 badge is not displayed until a valid certification is recorded.</p>
        </div>
      )}
    </main>
  );
}
