/**
 * Shop detail page — individual SKU with certification registry (F1-002).
 *
 * Displays product info and all NRTL certification records (UL/ETL file
 * numbers, lab result PDF links). IP65 badge is shown only when at least one
 * certification with certification_type = 'IP65' is currently valid —
 * enforcing FTC Act Section 5 substantiation (no badge without a live cert).
 */
import type { JSX } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getSkuBySlug, formatPrice } from "@/lib/brightworks/skus";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface Props {
  params: { slug: string };
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

export default async function ShopSkuPage({ params }: Props): Promise<JSX.Element> {
  const sku = await getSkuBySlug(params.slug);
  if (!sku) notFound();

  const validCerts = sku.certifications.filter(
    (c) => c.is_valid && (!c.expires_at || new Date(c.expires_at) > new Date()),
  );

  return (
    <main>
      <nav aria-label="Breadcrumb">
        <Link href="/shop">&larr; Back to Shop</Link>
      </nav>

      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
        <h1 style={{ margin: 0, flex: 1 }}>{sku.name}</h1>
        {sku.has_ip65 ? (
          <span
            aria-label="IP65 weatherproof certified"
            title="IP65 weatherproof certified — NRTL lab verified"
            style={{
              display: "inline-block",
              background: "#1d4ed8",
              color: "#fff",
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: "0.05em",
              padding: "4px 12px",
              borderRadius: 4,
              whiteSpace: "nowrap",
              alignSelf: "center",
            }}
          >
            IP65
          </span>
        ) : null}
      </div>

      <p className="muted">{sku.category}</p>

      {sku.image_url ? (
        <img
          src={sku.image_url}
          alt={sku.name}
          style={{
            width: "100%",
            maxHeight: 320,
            objectFit: "cover",
            borderRadius: 8,
            marginBottom: 16,
          }}
        />
      ) : null}

      {sku.description ? <p>{sku.description}</p> : null}

      <p>
        <strong style={{ fontSize: 22 }}>{formatPrice(sku.price_cents)}</strong>
      </p>

      <Link href="/shop/order" className="btn">
        Request a Quote
      </Link>

      <section style={{ marginTop: 32 }}>
        <h2>Safety &amp; Certification</h2>
        <p>
          All Brightworks products are tested by Nationally Recognized Testing
          Laboratories (NRTL) to meet applicable OSHA 29 CFR 1910.303
          requirements. Certification records below are maintained for FTC Act
          Section 5 substantiation compliance.
        </p>

        {sku.certifications.length === 0 ? (
          <div className="empty">
            <p>Certification records are being uploaded. Contact us for current documentation.</p>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Lab</th>
                <th>File Number</th>
                <th>Type</th>
                <th>Issued</th>
                <th>Expires</th>
                <th>Status</th>
                <th>Document</th>
              </tr>
            </thead>
            <tbody>
              {sku.certifications.map((cert) => {
                const active =
                  cert.is_valid &&
                  (!cert.expires_at || new Date(cert.expires_at) > new Date());
                return (
                  <tr key={cert.id}>
                    <td>{cert.lab_name}</td>
                    <td>
                      <code>{cert.file_number}</code>
                    </td>
                    <td>{cert.certification_type}</td>
                    <td>{formatDate(cert.issued_at)}</td>
                    <td>{cert.expires_at ? formatDate(cert.expires_at) : "No expiry"}</td>
                    <td>
                      <span
                        style={{
                          color: active ? "#15803d" : "#b91c1c",
                          fontWeight: 600,
                          fontSize: 13,
                        }}
                      >
                        {active ? "Valid" : "Expired / Revoked"}
                      </span>
                    </td>
                    <td>
                      {cert.pdf_url ? (
                        <a
                          href={cert.pdf_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn secondary"
                        >
                          View PDF
                        </a>
                      ) : (
                        <span className="muted">Pending</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {validCerts.length > 0 ? (
          <p className="muted" style={{ marginTop: 12 }}>
            {validCerts.length} active certification{validCerts.length !== 1 ? "s" : ""} on file.
          </p>
        ) : (
          <p className="muted" style={{ marginTop: 12 }}>
            No currently-valid certifications on file for this product.
          </p>
        )}
      </section>
    </main>
  );
}
