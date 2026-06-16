import type { JSX } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getSkuBySlug, formatPrice } from "@/lib/brightworks/skus";

interface Props {
  params: { slug: string };
}

export async function generateMetadata({ params }: Props) {
  const sku = await getSkuBySlug(params.slug);
  if (!sku) return { title: "Product Not Found — Brightworks" };
  return {
    title: `${sku.name} — Brightworks`,
    description: sku.description,
  };
}

export default async function SkuDetailPage({ params }: Props): Promise<JSX.Element> {
  const sku = await getSkuBySlug(params.slug);

  if (!sku) {
    notFound();
  }

  const validCerts = sku.certifications.filter((c) => c.is_valid);
  const showIp65Badge = Boolean(sku.ip_rating) && sku.has_valid_cert;

  return (
    <main>
      <p>
        <Link href="/shop" className="muted">
          ← Back to Shop
        </Link>
      </p>

      <h1>{sku.name}</h1>
      <p>{sku.description}</p>

      <div className="card" style={{ marginTop: "1.5rem" }}>
        <table>
          <tbody>
            <tr>
              <th scope="row">Price</th>
              <td>{formatPrice(sku.price_cents)}</td>
            </tr>
            <tr>
              <th scope="row">Category</th>
              <td style={{ textTransform: "capitalize" }}>{sku.category}</td>
            </tr>
            {sku.ip_rating && (
              <tr>
                <th scope="row">IP Rating</th>
                <td>
                  {sku.ip_rating}
                  {showIp65Badge && (
                    <span
                      style={{
                        display: "inline-block",
                        marginLeft: "0.5rem",
                        padding: "2px 8px",
                        background: "#166534",
                        color: "#fff",
                        borderRadius: 4,
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        letterSpacing: "0.04em",
                      }}
                    >
                      {sku.ip_rating} Certified
                    </span>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <section style={{ marginTop: "2rem" }}>
        <h2>NRTL Certifications</h2>
        <p>
          Third-party laboratory certifications on file for this product.
        </p>

        {sku.certifications.length === 0 ? (
          <div className="empty">
            <p>No certification records on file for this product.</p>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Lab</th>
                <th>File Number</th>
                <th>Issued</th>
                <th>Expires</th>
                <th>Status</th>
                <th>Document</th>
              </tr>
            </thead>
            <tbody>
              {sku.certifications.map((cert) => (
                <tr key={cert.id}>
                  <td>
                    <strong>{cert.lab}</strong>
                  </td>
                  <td>
                    <code>{cert.file_number}</code>
                  </td>
                  <td>
                    {cert.issued_at
                      ? new Date(cert.issued_at).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })
                      : <span className="muted">—</span>}
                  </td>
                  <td>
                    {cert.expires_at
                      ? new Date(cert.expires_at).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })
                      : <span className="muted">—</span>}
                  </td>
                  <td>
                    {cert.is_valid ? (
                      <span style={{ color: "#166534", fontWeight: 600 }}>Valid</span>
                    ) : (
                      <span style={{ color: "#9a3412", fontWeight: 600 }}>Expired</span>
                    )}
                  </td>
                  <td>
                    {cert.pdf_url ? (
                      <a
                        href={cert.pdf_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn secondary"
                      >
                        Download PDF
                      </a>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {validCerts.length > 0 && (
        <div className="card" style={{ marginTop: "2rem" }}>
          <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
            This product carries{" "}
            {validCerts.map((c) => `${c.lab} file #${c.file_number}`).join(" and ")}{" "}
            certification, substantiating its {sku.ip_rating} weatherproof rating
            per FTC Act §5 and OSHA 29 CFR 1910.303 requirements.
          </p>
        </div>
      )}
    </main>
  );
}
