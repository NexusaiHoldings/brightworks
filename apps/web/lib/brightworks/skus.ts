/**
 * Brightworks SKU catalog + certification registry (F1-002).
 *
 * Server-only data access for the sku_catalog and sku_certifications tables.
 * Uses the same externalized `pg` pool pattern as lib/blog.ts and lib/db.ts —
 * pool created at first call so Next.js preview builds without a DB still
 * compile; tables may not exist yet on fresh deploy (returns empty gracefully).
 *
 * IP65 badge logic: a SKU is considered IP65-certified only when it has at
 * least one sku_certifications row with certification_type = 'IP65' AND
 * is_valid = true AND (expires_at IS NULL OR expires_at > now()).
 * This enforces the FTC Act Section 5 substantiation requirement identified
 * in data_findings.
 */

export interface Sku {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  price_cents: number;
  category: string;
  image_url: string | null;
  is_active: boolean;
  created_at: string;
}

export interface SkuCertification {
  id: string;
  sku_id: string;
  lab_name: string;
  file_number: string;
  certification_type: string;
  pdf_url: string | null;
  issued_at: string | null;
  expires_at: string | null;
  is_valid: boolean;
}

export interface SkuWithCertStatus extends Sku {
  has_ip65: boolean;
}

export interface SkuDetail extends Sku {
  certifications: SkuCertification[];
  has_ip65: boolean;
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

function formatPrice(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export { formatPrice };

function rowToSku(r: Record<string, unknown>): Sku {
  return {
    id: String(r.id),
    slug: String(r.slug),
    name: String(r.name),
    description: r.description ? String(r.description) : null,
    price_cents: Number(r.price_cents),
    category: String(r.category),
    image_url: r.image_url ? String(r.image_url) : null,
    is_active: Boolean(r.is_active),
    created_at: String(r.created_at),
  };
}

function rowToCert(r: Record<string, unknown>): SkuCertification {
  return {
    id: String(r.id),
    sku_id: String(r.sku_id),
    lab_name: String(r.lab_name),
    file_number: String(r.file_number),
    certification_type: String(r.certification_type),
    pdf_url: r.pdf_url ? String(r.pdf_url) : null,
    issued_at: r.issued_at ? String(r.issued_at) : null,
    expires_at: r.expires_at ? String(r.expires_at) : null,
    is_valid: Boolean(r.is_valid),
  };
}

/**
 * Returns all active SKUs with a boolean flag indicating whether each has a
 * currently-valid IP65 certification. IP65 badge is shown only when the flag
 * is true (FTC Act Section 5 substantiation).
 */
export async function listActiveSkus(): Promise<SkuWithCertStatus[]> {
  try {
    const { rows } = await getPool().query(
      `SELECT
         s.id, s.slug, s.name, s.description, s.price_cents,
         s.category, s.image_url, s.is_active, s.created_at,
         EXISTS (
           SELECT 1 FROM sku_certifications c
           WHERE c.sku_id = s.id
             AND c.certification_type = 'IP65'
             AND c.is_valid = true
             AND (c.expires_at IS NULL OR c.expires_at > CURRENT_DATE)
         ) AS has_ip65
       FROM sku_catalog s
       WHERE s.is_active = true
       ORDER BY s.created_at ASC`,
      [],
    );
    return (rows as Record<string, unknown>[]).map((r) => ({
      ...rowToSku(r),
      has_ip65: Boolean(r.has_ip65),
    }));
  } catch {
    return [];
  }
}

/**
 * Returns a single SKU by slug with all its certification records.
 * Returns null when not found or on DB error (404 handling in the page).
 */
export async function getSkuBySlug(slug: string): Promise<SkuDetail | null> {
  try {
    const pool = getPool();
    const skuResult = await pool.query(
      `SELECT id, slug, name, description, price_cents, category, image_url, is_active, created_at
         FROM sku_catalog
        WHERE slug = $1 AND is_active = true
        LIMIT 1`,
      [slug],
    );
    const skuRow = (skuResult.rows as Record<string, unknown>[])[0];
    if (!skuRow) return null;

    const certResult = await pool.query(
      `SELECT id, sku_id, lab_name, file_number, certification_type,
              pdf_url, issued_at, expires_at, is_valid
         FROM sku_certifications
        WHERE sku_id = $1
        ORDER BY issued_at DESC NULLS LAST`,
      [String(skuRow.id)],
    );

    const certifications = (certResult.rows as Record<string, unknown>[]).map(rowToCert);
    const has_ip65 = certifications.some(
      (c) =>
        c.certification_type === "IP65" &&
        c.is_valid &&
        (!c.expires_at || new Date(c.expires_at) > new Date()),
    );

    return {
      ...rowToSku(skuRow),
      certifications,
      has_ip65,
    };
  } catch {
    return null;
  }
}
