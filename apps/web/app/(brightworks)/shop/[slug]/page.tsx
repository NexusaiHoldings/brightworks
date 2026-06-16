/**
 * Shop detail page — individual SKU with certification registry (F1-002).
 *
 * IP65 badge and certification table are rendered only when valid NRTL records
 * exist (FTC Act Section 5 substantiation; OSHA 29 CFR 1910.303 finding).
 */
import type { JSX } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSkuBySlug, formatPrice } from "@/lib/brightworks/skus";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const sku = await getSkuBySlug(params.slug);
  if (!sku) return { title: "Product not found" };
  return {
    title: sku.name,
    description: sku.description ?? undefined,
  };
}

function formatDate(iso: string): string {
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

export default async function ShopDetailPage({
  params,
}: {
  params: { slug: string };
}): Promise<JSX.Element> {
  const sku = await getSkuBySlug(params.slug);
  if (!sku) notFound();

  const validCerts = sku.certifications.filter(
    (c) => c.valid_until === null || new Date(c.valid_until) > new Date(),
  );

  return (
    <main>
      <p>
        <Link href="/shop">← All products</Link>
      </p>

      {sku.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={sku.image_url}
          alt={sku.name}
          style={{
            width: "100%",
            borderRadius: 10,
            marginBottom: 20,
            aspectRatio: "4 / 3",
            objectFit: "cover",
            maxHeight: 420,
          }}
        />
      ) : null}

      <h1>{sku.name}</h1>

      <p>
        <strong style={{ fontSize: "1.25rem" }}>{formatPrice(sku.price_cents)}</strong>
        {sku.has_valid_certification ? (
          <>
            {" "}
            <span
              style={{
                display: "inline-block",
                padding: "3px 10px",
                borderRadius: 4,
                background: "#0369a1",
                color: "#fff",
                fontSize: 13,
                fontWeight: 600,
                letterSpacing: "0.04em",
                verticalAlign: "middle",
              }}
              title="NRTL-certified IP65 weatherproof rating"
            >
              IP65 Certified
            </span>
          </>
        ) : null}
      </p>

      {sku.description ? <p>{sku.description}</p> : null}

      <p>
        <span className="muted">Category: {sku.category}</span>
      </p>

      {validCerts.length > 0 ? (
        <section>
          <h2>NRTL Certifications</h2>
          <p className="muted">
            This product has been tested and certified by a Nationally
            Recognized Testing Laboratory (NRTL) in accordance with OSHA 29
            CFR 1910.303 requirements.
          </p>
          <table>
            <thead>
              <tr>
                <th>Certifying Body</th>
                <th>File Number</th>
                <th>Valid From</th>
                <th>Valid Until</th>
                <th>Lab Report</th>
              </tr>
            </thead>
            <tbody>
              {validCerts.map((cert) => (
                <tr key={cert.id}>
                  <td>{cert.cert_body}</td>
                  <td>{cert.file_number}</td>
                  <td>{formatDate(cert.valid_from)}</td>
                  <td>{cert.valid_until ? formatDate(cert.valid_until) : "No expiry"}</td>
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
        </section>
      ) : (
        <section>
          <h2>Certifications</h2>
          <div className="empty">
            <p>Certification documentation is being processed.</p>
          </div>
        </section>
      )}
    </main>
  );
}
