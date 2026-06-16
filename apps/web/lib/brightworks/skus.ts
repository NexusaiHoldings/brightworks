/**
 * Brightworks SKU catalog + certification registry — server-only data access.
 *
 * IP65 badge is displayed only when a valid NRTL certification record exists
 * (UL/ETL), satisfying FTC Act §5 substantiation per data_findings and
 * the regulatory_risk OSHA 29 CFR 1910.303 finding.
 *
 * Same externalized `pg` pool pattern as lib/blog.ts and lib/db.ts.
 */

export interface Sku {
  id: string;
  slug: string;
  name: string;
  description: string;
  price_cents: number;
  category: string;
  ip_rating: string | null;
  image_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Certification {
  id: string;
  sku_id: string;
  lab: string;
  file_number: string;
  pdf_url: string | null;
  issued_at: string | null;
  expires_at: string | null;
  is_valid: boolean;
  created_at: string;
}

export interface SkuWithCerts extends Sku {
  certifications: Certification[];
  has_valid_cert: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _pool: any = null;

function getPool(): {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }>;
} {
  if (_pool) return _pool;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { Pool: PgPool } = require("pg") as {
    Pool: new (config: Record<string, unknown>) => {
      query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }>;
    };
  };
  _pool = new PgPool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    idleTimeoutMillis: 30_000,
  });
  return _pool;
}

function rowToSku(r: Record<string, unknown>): Sku {
  return {
    id: String(r.id),
    slug: String(r.slug),
    name: String(r.name),
    description: String(r.description),
    price_cents: Number(r.price_cents),
    category: String(r.category),
    ip_rating: r.ip_rating ? String(r.ip_rating) : null,
    image_url: r.image_url ? String(r.image_url) : null,
    is_active: Boolean(r.is_active),
    created_at: String(r.created_at),
    updated_at: String(r.updated_at),
  };
}

function rowToCert(r: Record<string, unknown>): Certification {
  return {
    id: String(r.id),
    sku_id: String(r.sku_id),
    lab: String(r.lab),
    file_number: String(r.file_number),
    pdf_url: r.pdf_url ? String(r.pdf_url) : null,
    issued_at: r.issued_at ? String(r.issued_at) : null,
    expires_at: r.expires_at ? String(r.expires_at) : null,
    is_valid: Boolean(r.is_valid),
    created_at: String(r.created_at),
  };
}

/**
 * Returns all active SKUs with a flag indicating whether each has at least
 * one valid NRTL certification on file.
 */
export async function listSkus(): Promise<SkuWithCerts[]> {
  try {
    const pool = getPool();

    const { rows: skuRows } = await pool.query(
      `SELECT id, slug, name, description, price_cents, category,
              ip_rating, image_url, is_active, created_at, updated_at
         FROM brightworks_skus
        WHERE is_active = true
        ORDER BY created_at ASC`,
    );

    if (skuRows.length === 0) return [];

    const skus = (skuRows as Record<string, unknown>[]).map(rowToSku);
    const skuIds = skus.map((s) => s.id);

    const placeholders = skuIds.map((_, idx) => `$${idx + 1}`).join(", ");
    const { rows: certRows } = await pool.query(
      `SELECT id, sku_id, lab, file_number, pdf_url,
              issued_at, expires_at, is_valid, created_at
         FROM brightworks_certifications
        WHERE sku_id IN (${placeholders})
        ORDER BY issued_at DESC NULLS LAST`,
      skuIds,
    );

    const certsBySkuId = new Map<string, Certification[]>();
    for (const row of certRows as Record<string, unknown>[]) {
      const cert = rowToCert(row);
      const existing = certsBySkuId.get(cert.sku_id) ?? [];
      existing.push(cert);
      certsBySkuId.set(cert.sku_id, existing);
    }

    return skus.map((sku) => {
      const certs = certsBySkuId.get(sku.id) ?? [];
      return {
        ...sku,
        certifications: certs,
        has_valid_cert: certs.some((c) => c.is_valid),
      };
    });
  } catch {
    return [];
  }
}

/**
 * Returns a single active SKU by slug, with all its certifications.
 * Returns null when the SKU does not exist or is inactive.
 */
export async function getSkuBySlug(slug: string): Promise<SkuWithCerts | null> {
  try {
    const pool = getPool();

    const { rows: skuRows } = await pool.query(
      `SELECT id, slug, name, description, price_cents, category,
              ip_rating, image_url, is_active, created_at, updated_at
         FROM brightworks_skus
        WHERE slug = $1 AND is_active = true
        LIMIT 1`,
      [slug],
    );

    const skuRow = (skuRows as Record<string, unknown>[])[0];
    if (!skuRow) return null;

    const sku = rowToSku(skuRow);

    const { rows: certRows } = await pool.query(
      `SELECT id, sku_id, lab, file_number, pdf_url,
              issued_at, expires_at, is_valid, created_at
         FROM brightworks_certifications
        WHERE sku_id = $1
        ORDER BY is_valid DESC, issued_at DESC NULLS LAST`,
      [sku.id],
    );

    const certifications = (certRows as Record<string, unknown>[]).map(rowToCert);

    return {
      ...sku,
      certifications,
      has_valid_cert: certifications.some((c) => c.is_valid),
    };
  } catch {
    return null;
  }
}

/** Formats price in cents as a USD dollar string, e.g. 4995 → "$49.95". */
export function formatPrice(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}
