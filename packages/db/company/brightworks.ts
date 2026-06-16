/**
 * Brightworks SKU catalog + certification registry schema.
 *
 * Three launch SKUs with NRTL certification documents (UL/ETL file numbers
 * and lab result PDFs) per regulatory_risk / OSHA 29 CFR 1910.303 finding.
 * IP65 badge logic requires a valid bw_sku_certifications row — FTC Act §5.
 * Picked up by packages/db/migrate.ts via the *_DDL constant convention.
 */
export const BRIGHTWORKS_DDL = `
CREATE TABLE IF NOT EXISTS bw_skus (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        text        UNIQUE NOT NULL,
  name        text        NOT NULL,
  description text,
  price_cents integer     NOT NULL DEFAULT 0,
  tier        text        NOT NULL DEFAULT 'retail',
  image_url   text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bw_sku_certifications (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  sku_id             uuid        NOT NULL REFERENCES bw_skus(id) ON DELETE CASCADE,
  certification_body text        NOT NULL,
  file_number        text        NOT NULL,
  certification_type text        NOT NULL,
  lab_result_pdf_url text,
  issued_at          date,
  expires_at         date,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bw_sku_certifications_sku_id
  ON bw_sku_certifications (sku_id);

-- Seed the three launch SKUs (idempotent)
INSERT INTO bw_skus (slug, name, description, price_cents, tier) VALUES
  (
    'weatherproof-timer',
    'Weatherproof Timer',
    'Heavy-duty outdoor programmable timer rated for roofline lighting installations. IP65-rated housing with dual-outlet configuration and dawn-to-dusk photocell override.',
    4999,
    'retail'
  ),
  (
    'connector-10-pack',
    'Connector 10-Pack',
    'Weatherproof quick-connect cord couplers — 10 units. Compatible with all Brightworks seasonal lighting systems. Locking sleeve prevents accidental disconnection.',
    1999,
    'retail'
  ),
  (
    'roofline-install-kit',
    'Roofline Install Kit',
    'Complete professional installer kit: mounting clips, weatherproof cable ties, roofline guide templates, and installation manual. Rated for permanent or seasonal mounting.',
    7999,
    'retail'
  )
ON CONFLICT (slug) DO NOTHING;
`;
