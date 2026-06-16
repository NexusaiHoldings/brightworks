/**
 * SKU catalog + NRTL certification data access (F1-002).
 *
 * Server-only reads of bw_skus and bw_certifications. Uses the same
 * externalized pg singleton pool pattern as lib/blog.ts so preview builds
 * without a DB still compile (pool created at first call, not module load).
 */

export interface Certification {
  id: string;
  sku_id: string;
  lab: string;
  file_number: string;
  standard: string;
  pdf_url: string | null;
  issued_at: string | null;
  expires_at: string | null;
  valid: boolean;
}

export interface Sku {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  price_cents: number;
  tier: string;
  image_url: string | null;
  ip_rating: string | null;
  status: string;
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

function rowToCert(r: Record<string, unknown>): Certification {
  return {
    id: String(r.id),
    sku_id: String(r.sku_id),
    lab: String(r.lab),
    file_number: String(r.file_number),
    standard: String(r.standard),
    pdf_url: r.pdf_url ? String(r.pdf_url) : null,
    issued_at: r.issued_at ? String(r.issued_at) : null,
    expires_at: r.expires_at ? String(r.expires_at) : null,
    valid: Boolean(r.valid),
  };
}

function rowToSku(
  r: Record<string, unknown>,
  certs: Certification[],
): Sku {
  return {
    id: String(r.id),
    slug: String(r.slug),
    name: String(r.name),
    description: r.description ? String(r.description) : null,
    price_cents: Number(r.price_cents),
    tier: String(r.tier ?? "retail"),
    image_url: r.image_url ? String(r.image_url) : null,
    ip_rating: r.ip_rating ? String(r.ip_rating) : null,
    status: String(r.status),
    certifications: certs,
  };
}

/** Returns true only when the SKU has at least one valid NRTL certification record. */
export function hasValidCertification(sku: Sku): boolean {
  return sku.certifications.some((c) => c.valid);
}

/** Format a price in cents as a USD currency string. */
export function formatPrice(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

/** List all active SKUs with their valid certifications. Returns [] on DB error. */
export async function listActiveSkus(): Promise<Sku[]> {
  try {
    const pool = getPool();
    const { rows: skuRows } = await pool.query(
      `SELECT id, slug, name, description, price_cents, tier, image_url, ip_rating, status
         FROM bw_skus
        WHERE status = 'active'
        ORDER BY name ASC`,
    );
    if ((skuRows as unknown[]).length === 0) return [];

    const skuIds = (skuRows as Record<string, unknown>[]).map((r) =>
      String(r.id),
    );
    const placeholders = skuIds.map((_, idx) => `$${idx + 1}`).join(", ");
    const { rows: certRows } = await pool.query(
      `SELECT id, sku_id, lab, file_number, standard, pdf_url, issued_at, expires_at, valid
         FROM bw_certifications
        WHERE sku_id IN (${placeholders}) AND valid = true
        ORDER BY issued_at DESC NULLS LAST`,
      skuIds,
    );

    const certsBySkuId = new Map<string, Certification[]>();
    for (const cert of certRows as Record<string, unknown>[]) {
      const skuId = String(cert.sku_id);
      const existing = certsBySkuId.get(skuId) ?? [];
      existing.push(rowToCert(cert));
      certsBySkuId.set(skuId, existing);
    }

    return (skuRows as Record<string, unknown>[]).map((r) => {
      const skuId = String(r.id);
      return rowToSku(r, certsBySkuId.get(skuId) ?? []);
    });
  } catch {
    return [];
  }
}

/** Fetch a single active SKU by slug with all its certifications. Returns null on miss or DB error. */
export async function getSkuBySlug(slug: string): Promise<Sku | null> {
  try {
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT id, slug, name, description, price_cents, tier, image_url, ip_rating, status
         FROM bw_skus
        WHERE slug = $1 AND status = 'active'
        LIMIT 1`,
      [slug],
    );
    const r = (rows as Record<string, unknown>[])[0];
    if (!r) return null;

    const { rows: certRows } = await pool.query(
      `SELECT id, sku_id, lab, file_number, standard, pdf_url, issued_at, expires_at, valid
         FROM bw_certifications
        WHERE sku_id = $1
        ORDER BY valid DESC, issued_at DESC NULLS LAST`,
      [String(r.id)],
    );

    const certs = (certRows as Record<string, unknown>[]).map(rowToCert);
    return rowToSku(r, certs);
  } catch {
    return null;
  }
}
