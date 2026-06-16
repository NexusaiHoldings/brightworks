/**
 * /shop/[slug] — Brightworks product detail page (F1-002).
 *
 * Server component. IP65 badge and certification details rendered only when
 * a valid NRTL certification record exists (FTC Act Section 5 substantiation).
 * notFound() returned for inactive or unknown slugs.
 */

import { notFound } from "next/navigation";
import type { JSX } from "react";
import type { Metadata } from "next";
import { getSkuBySlug, hasIp65Certification, formatPrice } from "@/lib/brightworks/skus";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface PageProps {
  params: { slug: string };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const sku = await getSkuBySlug(params.slug);
  if (!sku) return { title: "Product not found — Brightworks" };
  return {
    title: `${sku.name} — Brightworks`,
    description: sku.description ?? `${sku.name} by Brightworks.`,
  };
}

export default async function ShopDetailPage({ params }: PageProps): Promise<JSX.Element> {
  const sku = await getSkuBySlug(params.slug);
  if (!sku) notFound();

  const ip65 = hasIp65Certification(sku);

  return (
    <main>
      <p className="muted">
        <a href="/shop">← Shop</a>
      </p>

      <h1>{sku.name}</h1>

      <p style={{ fontSize: "1.5rem", fontWeight: 700, margin: "0.5rem 0" }}>
        {formatPrice(sku.price_cents)}
      </p>

      {sku.description && <p>{sku.description}</p>}

      <p className="muted" style={{ textTransform: "capitalize" }}>
        Category: {sku.category}
      </p>

      {ip65 && (
        <div
          className="card"
          style={{ marginTop: "1.5rem", borderLeft: "4px solid #1d4ed8" }}
        >
          <h2 style={{ margin: "0 0 0.5rem", color: "#1d4ed8" }}>
            IP65 Weather Resistance Certified
          </h2>
          <p className="muted" style={{ margin: 0 }}>
            This product has been independently tested and certified to the IP65
            standard, providing complete protection against dust ingress and
            resistance to water jets from any direction.
          </p>

          {sku.certifications.length > 0 && (
            <table style={{ marginTop: "1rem", width: "100%" }}>
              <thead>
                <tr>
                  <th scope="col">Certifying Body</th>
                  <th scope="col">File Number</th>
                  <th scope="col">Standard</th>
                  <th scope="col">Lab Results</th>
                </tr>
              </thead>
              <tbody>
                {sku.certifications.map((cert) => (
                  <tr key={cert.id}>
                    <td>{cert.cert_body}</td>
                    <td>{cert.file_number}</td>
                    <td>{cert.standard}</td>
                    <td>
                      {cert.lab_result_pdf_url ? (
                        <a
                          href={cert.lab_result_pdf_url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          View PDF
                        </a>
                      ) : (
                        <span className="muted">On file</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {!ip65 && (
        <div className="card" style={{ marginTop: "1.5rem" }}>
          <p className="muted" style={{ margin: 0 }}>
            Certification details for this product are being processed. Contact
            us for current compliance documentation.
          </p>
        </div>
      )}

      <div style={{ marginTop: "1.5rem" }}>
        <a href="/shop" className="btn secondary">
          ← Back to Shop
        </a>
      </div>
    </main>
  );
}
