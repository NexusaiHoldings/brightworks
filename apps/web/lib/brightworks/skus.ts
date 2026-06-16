/**
 * Brightworks SKU catalog + certification data access (F1-002).
 *
 * Server-only reads of brightworks_skus and brightworks_certifications.
 * Same externalized pg pattern as lib/blog.ts — pool created at first call
 * so preview builds without a DB still compile. Returns [] / null on any
 * error so the shop renders gracefully on fresh deploys.
 *
 * IP65 badge: only rendered when a brightworks_certifications row exists
 * with is_valid = true and standard = 'IP65', per FTC Act Section 5.
 */

export interface SkuCertification {
  id: string;
  cert_body: string;
  file_number: string;
  standard: string;
  lab_result_pdf_url: string | null;
  issued_at: string | null;
  expires_at: string | null;
  is_valid: boolean;
}

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
  certifications: SkuCertification[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _pool: any = null;

function getPool(): {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }>;
} {
  if (_pool) return _pool;
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

function rowToCert(r: Record<string, unknown>): SkuCertification {
  return {
    id: String(r.id),
    cert_body: String(r.cert_body),
    file_number: String(r.file_number),
    standard: String(r.standard),
    lab_result_pdf_url: r.lab_result_pdf_url ? String(r.lab_result_pdf_url) : null,
    issued_at: r.issued_at ? String(r.issued_at) : null,
    expires_at: r.expires_at ? String(r.expires_at) : null,
    is_valid: Boolean(r.is_valid),
  };
}

function rowToSku(
  r: Record<string, unknown>,
  certRows: Record<string, unknown>[],
): Sku {
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
    certifications: certRows.map(rowToCert),
  };
}

export async function listActiveSkus(): Promise<Sku[]> {
  try {
    const pool = getPool();
    const { rows: skuRows } = await pool.query(
      `SELECT id, slug, name, description, price_cents, category, image_url, is_active, created_at
         FROM brightworks_skus
        WHERE is_active = true
        ORDER BY created_at ASC`,
    );
    if (skuRows.length === 0) return [];

    const skus = skuRows as Record<string, unknown>[];
    const skuIds = skus.map((s) => String(s.id));
    const placeholders = skuIds.map((_, i) => `$${i + 1}`).join(", ");
    const { rows: certRows } = await pool.query(
      `SELECT id, sku_id, cert_body, file_number, standard, lab_result_pdf_url,
              issued_at, expires_at, is_valid
         FROM brightworks_certifications
        WHERE sku_id IN (${placeholders}) AND is_valid = true`,
      skuIds,
    );

    const certsBySkuId = new Map<string, Record<string, unknown>[]>();
    for (const cert of certRows as Record<string, unknown>[]) {
      const sid = String(cert.sku_id);
      const existing = certsBySkuId.get(sid) ?? [];
      existing.push(cert);
      certsBySkuId.set(sid, existing);
    }

    return skus.map((s) =>
      rowToSku(s, certsBySkuId.get(String(s.id)) ?? []),
    );
  } catch {
    return [];
  }
}

export async function getSkuBySlug(slug: string): Promise<Sku | null> {
  try {
    const pool = getPool();
    const { rows: skuRows } = await pool.query(
      `SELECT id, slug, name, description, price_cents, category, image_url, is_active, created_at
         FROM brightworks_skus
        WHERE slug = $1 AND is_active = true
        LIMIT 1`,
      [slug],
    );
    const skuRow = (skuRows as Record<string, unknown>[])[0];
    if (!skuRow) return null;

    const { rows: certRows } = await pool.query(
      `SELECT id, sku_id, cert_body, file_number, standard, lab_result_pdf_url,
              issued_at, expires_at, is_valid
         FROM brightworks_certifications
        WHERE sku_id = $1 AND is_valid = true`,
      [String(skuRow.id)],
    );

    return rowToSku(skuRow, certRows as Record<string, unknown>[]);
  } catch {
    return null;
  }
}

export function hasIp65Certification(sku: Sku): boolean {
  return sku.certifications.some(
    (c) => c.is_valid && c.standard.toUpperCase() === "IP65",
  );
}

export function formatPrice(priceCents: number): string {
  return `$${(priceCents / 100).toFixed(2)}`;
}
