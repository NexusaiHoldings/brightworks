import type { JSX } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSkuBySlug } from "@/lib/brightworks/skus";

interface PageProps {
  params: { slug: string };
}

export async function generateMetadata({ params }: PageProps) {
  const sku = await getSkuBySlug(params.slug);
  if (!sku) return { title: "Product Not Found — Brightworks" };
  return {
    title: `${sku.name} — Brightworks`,
    description:
      sku.description ??
      `${sku.name} — professional weatherproof lighting accessory.`,
  };
}

export default async function SkuDetailPage({
  params,
}: PageProps): Promise<JSX.Element> {
  const sku = await getSkuBySlug(params.slug);
  if (!sku) notFound();

  return (
    <main>
      <p>
        <Link href="/shop">← Back to Shop</Link>
      </p>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "1rem",
          flexWrap: "wrap",
        }}
      >
        <h1 style={{ margin: 0 }}>{sku.name}</h1>
        {sku.has_ip65 && (
          <span
            style={{
              background: "#16a34a",
              color: "#fff",
              padding: "0.3rem 0.8rem",
              borderRadius: "4px",
              fontWeight: 700,
              fontSize: "0.875rem",
              letterSpacing: "0.05em",
              alignSelf: "center",
              whiteSpace: "nowrap",
            }}
            title="IP65 rating verified by accredited NRTL laboratory"
          >
            IP65 Certified
          </span>
        )}
      </div>

      {sku.description && <p>{sku.description}</p>}

      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <p style={{ fontSize: "1.5rem", fontWeight: 700, margin: "0 0 0.25rem" }}>
          ${(sku.price_cents / 100).toFixed(2)}
        </p>
        <p className="muted" style={{ margin: 0 }}>
          Tier: {sku.tier}
        </p>
      </div>

      <h2>Certifications</h2>
      {sku.certifications.length === 0 ? (
        <div className="empty">
          <p>No certification documents on file for this product.</p>
        </div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Body</th>
              <th>Type</th>
              <th>File Number</th>
              <th>Issued</th>
              <th>Expires</th>
              <th>Lab Report</th>
            </tr>
          </thead>
          <tbody>
            {sku.certifications.map((cert) => (
              <tr key={cert.id}>
                <td>{cert.certification_body}</td>
                <td>
                  <strong>{cert.certification_type}</strong>
                </td>
                <td>
                  <code>{cert.file_number}</code>
                </td>
                <td>
                  {cert.issued_at
                    ? new Date(
                        cert.issued_at as unknown as string,
                      ).toLocaleDateString()
                    : "—"}
                </td>
                <td>
                  {cert.expires_at
                    ? new Date(
                        cert.expires_at as unknown as string,
                      ).toLocaleDateString()
                    : "No expiry"}
                </td>
                <td>
                  {cert.lab_result_pdf_url ? (
                    <a
                      href={cert.lab_result_pdf_url}
                      target="_blank"
                      rel="noopener noreferrer"
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

      <p className="muted" style={{ marginTop: "1.5rem", fontSize: "0.8rem" }}>
        The IP65 Certified badge is displayed only when a valid NRTL-issued
        certification record exists on file. Substantiation per FTC Act
        Section 5.
      </p>
    </main>
  );
}
