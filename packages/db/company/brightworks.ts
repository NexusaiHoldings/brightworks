/**
 * Brightworks SKU catalog + NRTL certification registry schema (F1-002).
 *
 * skus — the three launch products (weatherproof timer, connector 10-pack,
 *   roofline install kit). Slug is the URL-safe identifier used by /shop/[slug].
 *
 * sku_certifications — NRTL certification records (UL / ETL) with file numbers
 *   and lab result PDF URLs. The IP65 badge is displayed only when at least one
 *   certification row for the SKU has valid_until IS NULL or valid_until > now(),
 *   satisfying the FTC Act Section 5 substantiation requirement.
 */
export const BRIGHTWORKS_DDL = `
CREATE TABLE IF NOT EXISTS skus (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          text        UNIQUE NOT NULL,
  name          text        NOT NULL,
  description   text,
  price_cents   integer     NOT NULL DEFAULT 0,
  category      text        NOT NULL DEFAULT 'general',
  image_url     text,
  status        text        NOT NULL DEFAULT 'active',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_skus_slug   ON skus (slug);
CREATE INDEX IF NOT EXISTS idx_skus_status ON skus (status);

CREATE TABLE IF NOT EXISTS sku_certifications (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  sku_id            uuid        NOT NULL REFERENCES skus(id) ON DELETE CASCADE,
  cert_body         text        NOT NULL,
  file_number       text        NOT NULL,
  lab_result_pdf_url text,
  valid_from        timestamptz NOT NULL DEFAULT now(),
  valid_until       timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sku_certifications_sku_id
  ON sku_certifications (sku_id);
`;
