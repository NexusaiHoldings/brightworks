/**
 * SKU catalog + certification registry — server-side query functions.
 *
 * IP65 badge is shown only when a valid bw_sku_certifications row exists
 * with certification_type = 'IP65' and (expires_at IS NULL OR expires_at >
 * CURRENT_DATE) — FTC Act Section 5 substantiation per data_findings.
 *
 * Uses the same singleton pg Pool pattern as apps/web/lib/db.ts.
 * Gracefully returns empty results when tables do not yet exist (pre-migration).
 */

export interface Sku {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  price_cents: number;
  tier: string;
  image_url: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface SkuCertification {
  id: string;
  sku_id: string;
  certification_body: string;
  file_number: string;
  certification_type: string;
  lab_result_pdf_url: string | null;
  issued_at: Date | null;
  expires_at: Date | null;
  created_at: Date;
}

export interface SkuWithCertStatus extends Sku {
  has_ip65: boolean;
}

export interface SkuDetail extends Sku {
  has_ip65: boolean;
  certifications: SkuCertification[];
}

// Singleton pg Pool — lazy init so build succeeds without DATABASE_URL.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _pool: any = null;

function getPool(): {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }>;
} {
  if (_pool) return _pool;
  // pg is listed in next.config.js serverComponentsExternalPackages so it is
  // not bundled by webpack and resolves at runtime from node_modules.
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

/**
 * Returns all SKUs with a boolean flag for valid IP65 certification.
 * Returns [] if the tables do not exist yet (pre-migration).
 */
export async function listSkusWithCertStatus(): Promise<SkuWithCertStatus[]> {
  const pool = getPool();
  try {
    const res = await pool.query(`
      SELECT
        s.id,
        s.slug,
        s.name,
        s.description,
        s.price_cents,
        s.tier,
        s.image_url,
        s.created_at,
        s.updated_at,
        EXISTS (
          SELECT 1 FROM bw_sku_certifications c
          WHERE c.sku_id = s.id
            AND c.certification_type = 'IP65'
            AND (c.expires_at IS NULL OR c.expires_at > CURRENT_DATE)
        ) AS has_ip65
      FROM bw_skus s
      ORDER BY s.created_at ASC
    `);
    return res.rows as SkuWithCertStatus[];
  } catch (_err) {
    return [];
  }
}

/**
 * Returns a single SKU by slug with all its certification records.
 * Returns null when not found or tables do not exist.
 */
export async function getSkuBySlug(slug: string): Promise<SkuDetail | null> {
  const pool = getPool();
  try {
    const skuRes = await pool.query(
      `SELECT id, slug, name, description, price_cents, tier, image_url,
              created_at, updated_at
       FROM bw_skus
       WHERE slug = $1`,
      [slug],
    );
    if (skuRes.rows.length === 0) return null;

    const sku = skuRes.rows[0] as Sku;

    const certRes = await pool.query(
      `SELECT id, sku_id, certification_body, file_number, certification_type,
              lab_result_pdf_url, issued_at, expires_at, created_at
       FROM bw_sku_certifications
       WHERE sku_id = $1
       ORDER BY created_at ASC`,
      [sku.id],
    );
    const certifications = certRes.rows as SkuCertification[];

    const has_ip65 = certifications.some(
      (cert) =>
        cert.certification_type === "IP65" &&
        (cert.expires_at === null ||
          new Date(cert.expires_at as unknown as string) > new Date()),
    );

    return { ...sku, has_ip65, certifications };
  } catch (_err) {
    return null;
  }
}
