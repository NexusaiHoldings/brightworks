import { Pool, PoolClient } from 'pg';

export interface Certification {
  id: string;
  skuId: string;
  certType: string;
  fileNumber: string;
  labPdfUrl: string | null;
  issuedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export interface Sku {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  priceCents: number;
  category: string;
  imageUrl: string | null;
  inStock: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SkuSummary extends Sku {
  hasCertification: boolean;
}

export interface SkuDetail extends Sku {
  certifications: Certification[];
}

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
  }
  return pool;
}

function rowToSku(row: Record<string, unknown>): Sku {
  return {
    id: row.id as string,
    slug: row.slug as string,
    name: row.name as string,
    description: (row.description as string) ?? null,
    priceCents: row.price_cents as number,
    category: row.category as string,
    imageUrl: (row.image_url as string) ?? null,
    inStock: row.in_stock as boolean,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function rowToCertification(row: Record<string, unknown>): Certification {
  return {
    id: row.id as string,
    skuId: row.sku_id as string,
    certType: row.cert_type as string,
    fileNumber: row.file_number as string,
    labPdfUrl: (row.lab_pdf_url as string) ?? null,
    issuedAt: row.issued_at ? String(row.issued_at) : null,
    expiresAt: row.expires_at ? String(row.expires_at) : null,
    createdAt: String(row.created_at),
  };
}

export async function getSkus(): Promise<SkuSummary[]> {
  const client: PoolClient = await getPool().connect();
  try {
    const result = await client.query<Record<string, unknown>>(`
      SELECT
        s.*,
        EXISTS (
          SELECT 1 FROM sku_certifications c WHERE c.sku_id = s.id
        ) AS has_certification
      FROM skus s
      ORDER BY s.created_at ASC
    `);
    return result.rows.map((row) => ({
      ...rowToSku(row),
      hasCertification: row.has_certification as boolean,
    }));
  } finally {
    client.release();
  }
}

export async function getSkuBySlug(slug: string): Promise<SkuDetail | null> {
  const client: PoolClient = await getPool().connect();
  try {
    const skuResult = await client.query<Record<string, unknown>>(
      `SELECT * FROM skus WHERE slug = $1 LIMIT 1`,
      [slug],
    );
    if (skuResult.rows.length === 0) {
      return null;
    }
    const sku = rowToSku(skuResult.rows[0]);

    const certResult = await client.query<Record<string, unknown>>(
      `SELECT * FROM sku_certifications WHERE sku_id = $1 ORDER BY issued_at DESC`,
      [sku.id],
    );
    const certifications = certResult.rows.map(rowToCertification);

    return { ...sku, certifications };
  } finally {
    client.release();
  }
}

export function formatPrice(priceCents: number): string {
  return `$${(priceCents / 100).toFixed(2)}`;
}
