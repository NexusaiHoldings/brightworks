/**
 * Brightworks SKU catalog + certification registry schema (F1-002).
 *
 * sku_catalog — the three launch SKUs (weatherproof timer, connector 10-pack,
 *   roofline install kit) per CEO briefing MVP scope.
 * sku_certifications — NRTL certification documents (UL/ETL file numbers +
 *   lab result PDFs) required by OSHA 29 CFR 1910.303 and FTC Act Section 5.
 *
 * Picked up by packages/db/migrate.ts via the *_DDL constant convention.
 */
export const BRIGHTWORKS_DDL = `
CREATE TABLE IF NOT EXISTS sku_catalog (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug         text        UNIQUE NOT NULL,
  name         text        NOT NULL,
  description  text,
  price_cents  integer     NOT NULL,
  category     text        NOT NULL,
  image_url    text,
  is_active    boolean     NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sku_catalog_slug
  ON sku_catalog (slug) WHERE is_active = true;

CREATE TABLE IF NOT EXISTS sku_certifications (
  id                 uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  sku_id             uuid  NOT NULL REFERENCES sku_catalog(id) ON DELETE CASCADE,
  lab_name           text  NOT NULL,
  file_number        text  NOT NULL,
  certification_type text  NOT NULL,
  pdf_url            text,
  issued_at          date,
  expires_at         date,
  is_valid           boolean     NOT NULL DEFAULT true,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sku_certifications_sku_id
  ON sku_certifications (sku_id) WHERE is_valid = true;
`;
