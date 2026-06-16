/**
 * Brightworks SKU catalog + certification registry data access (F1-002).
 *
 * Server-only. Uses the same externalized `pg` pool pattern as lib/blog.ts.
 * IP65 badge is surfaced only when a valid certification row exists for the
 * SKU, satisfying the FTC Act Section 5 substantiation requirement.
 */

export interface Certification {
  id: string;
  sku_id: string;
  cert_body: string;
  file_number: string;
  lab_result_pdf_url: string | null;
  valid_from: string;
  valid_until: string | null;
}

export interface SkuSummary {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  price_cents: number;
  category: string;
  image_url: string | null;
  status: string;
  has_valid_certification: boolean;
}

export interface SkuDetail extends SkuSummary {
  certifications: Certification[];
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

function rowToSummary(
  r: Record<string, unknown>,
  certCount: number,
): SkuSummary {
  return {
    id: String(r.id),
    slug: String(r.slug),
    name: String(r.name),
    description: r.description ? String(r.description) : null,
    price_cents: Number(r.price_cents ?? 0),
    category: String(r.category ?? "general"),
    image_url: r.image_url ? String(r.image_url) : null,
    status: String(r.status ?? "active"),
    has_valid_certification: certCount > 0,
  };
}

function rowToCertification(r: Record<string, unknown>): Certification {
  return {
    id: String(r.id),
    sku_id: String(r.sku_id),
    cert_body: String(r.cert_body),
    file_number: String(r.file_number),
    lab_result_pdf_url: r.lab_result_pdf_url
      ? String(r.lab_result_pdf_url)
      : null,
    valid_from: String(r.valid_from),
    valid_until: r.valid_until ? String(r.valid_until) : null,
  };
}

export async function listSkus(): Promise<SkuSummary[]> {
  try {
    const pool = getPool();
    const { rows: skuRows } = await pool.query(
      `SELECT s.id, s.slug, s.name, s.description, s.price_cents,
              s.category, s.image_url, s.status,
              COUNT(c.id) FILTER (
                WHERE c.valid_until IS NULL OR c.valid_until > now()
              ) AS valid_cert_count
         FROM skus s
         LEFT JOIN sku_certifications c ON c.sku_id = s.id
        WHERE s.status = 'active'
        GROUP BY s.id
        ORDER BY s.created_at ASC`,
    );
    return (skuRows as Record<string, unknown>[]).map((r) =>
      rowToSummary(r, Number(r.valid_cert_count ?? 0)),
    );
  } catch {
    return [];
  }
}

export async function getSkuBySlug(slug: string): Promise<SkuDetail | null> {
  try {
    const pool = getPool();
    const { rows: skuRows } = await pool.query(
      `SELECT id, slug, name, description, price_cents, category, image_url, status
         FROM skus
        WHERE slug = $1 AND status = 'active'
        LIMIT 1`,
      [slug],
    );
    const skuRow = skuRows[0] as Record<string, unknown> | undefined;
    if (!skuRow) return null;

    const { rows: certRows } = await pool.query(
      `SELECT id, sku_id, cert_body, file_number, lab_result_pdf_url,
              valid_from, valid_until
         FROM sku_certifications
        WHERE sku_id = $1
        ORDER BY valid_from DESC`,
      [skuRow.id],
    );

    const certifications = (certRows as Record<string, unknown>[]).map(
      rowToCertification,
    );

    const hasValid = certifications.some(
      (c) => c.valid_until === null || new Date(c.valid_until) > new Date(),
    );

    return {
      ...rowToSummary(skuRow, hasValid ? 1 : 0),
      certifications,
    };
  } catch {
    return null;
  }
}

export function formatPrice(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}
