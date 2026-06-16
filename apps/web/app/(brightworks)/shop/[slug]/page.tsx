/**
 * SKU detail page (F1-002).
 *
 * IP65 badge displayed only when a valid NRTL certification record exists —
 * enforces FTC Act Section 5 substantiation requirement. Certification table
 * shows UL/ETL file numbers and links to lab result PDFs for OSHA 29 CFR
 * 1910.303 compliance documentation.
 */
import type { JSX } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getSkuBySlug,
  formatPrice,
  hasValidCertification,
} from "@/lib/brightworks/skus";

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

export default async function SkuDetailPage({
  params,
}: {
  params: { slug: string };
}): Promise<JSX.Element> {
  const sku = await getSkuBySlug(params.slug);
  if (!sku) notFound();

  const certified = hasValidCertification(sku);
  const validCerts = sku.certifications.filter((c) => c.valid);
  const allCerts = sku.certifications;
  const supportEmail =
    process.env.SUPPORT_EMAIL ?? "support@usebrightworks.com";

  return (
    <main>
      <p>
        <Link href="/shop">← All products</Link>
      </p>
      <article>
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
            }}
          />
        ) : null}
        <h1>
          {sku.name}
          {sku.ip_rating && certified ? (
            <>
              {" "}
              <span
                title="NRTL certified weatherproof rating — UL/ETL file on record"
                style={{
                  background: "#1d4ed8",
                  color: "#fff",
                  borderRadius: 4,
                  padding: "2px 8px",
                  fontSize: 14,
                  fontWeight: 700,
                  verticalAlign: "middle",
                }}
              >
                {sku.ip_rating}
              </span>
            </>
          ) : null}
        </h1>
        <p>
          <strong style={{ fontSize: 22 }}>{formatPrice(sku.price_cents)}</strong>
          {sku.tier === "wholesale" ? (
            <span className="muted"> &nbsp;Wholesale tier</span>
          ) : null}
        </p>
        {sku.description ? <p>{sku.description}</p> : null}

        {validCerts.length > 0 ? (
          <section>
            <h2>NRTL Certifications</h2>
            <p className="muted">
              Third-party lab certifications on file — substantiation for all
              weatherproof and safety ratings per FTC Act Section 5.
            </p>
            <table>
              <thead>
                <tr>
                  <th>Lab</th>
                  <th>Standard</th>
                  <th>File Number</th>
                  <th>Issued</th>
                  <th>Expires</th>
                  <th>Document</th>
                </tr>
              </thead>
              <tbody>
                {validCerts.map((cert) => (
                  <tr key={cert.id}>
                    <td>{cert.lab}</td>
                    <td>{cert.standard}</td>
                    <td>{cert.file_number}</td>
                    <td>{cert.issued_at ?? "—"}</td>
                    <td>{cert.expires_at ?? "—"}</td>
                    <td>
                      {cert.pdf_url ? (
                        <a
                          href={cert.pdf_url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Lab report PDF
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : allCerts.length > 0 ? (
          <section>
            <h2>Certifications</h2>
            <p className="muted">
              Certification records are under review — IP rating badge will
              appear once a valid NRTL file is confirmed.
            </p>
          </section>
        ) : null}

        <p>
          <a
            href={`mailto:${supportEmail}?subject=${encodeURIComponent(`Order inquiry: ${sku.name}`)}`}
            className="btn"
          >
            Request Quote
          </a>{" "}
          <Link href="/shop" className="btn secondary">
            Back to Shop
          </Link>
        </p>
      </article>
    </main>
  );
}
