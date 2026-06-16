/**
 * Brightworks SKU catalog + NRTL certification registry schema (F1-002).
 *
 * Three launch SKUs (weatherproof timer, connector 10-pack, roofline install
 * kit) with NRTL certification records linking UL/ETL file numbers and lab
 * result PDFs. Picked up by packages/db/migrate.ts via the *_DDL convention.
 *
 * IP65 badge display is gated on a valid brightworks_certifications row
 * (is_valid = true, standard = 'IP65') per FTC Act Section 5 substantiation.
 */
export const BRIGHTWORKS_DDL = `
CREATE TABLE IF NOT EXISTS brightworks_skus (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          text        UNIQUE NOT NULL,
  name          text        NOT NULL,
  description   text,
  price_cents   integer     NOT NULL,
  category      text        NOT NULL,
  image_url     text,
  is_active     boolean     NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_brightworks_skus_active
  ON brightworks_skus (slug) WHERE is_active = true;

CREATE TABLE IF NOT EXISTS brightworks_certifications (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  sku_id             uuid        NOT NULL REFERENCES brightworks_skus(id) ON DELETE CASCADE,
  cert_body          text        NOT NULL,
  file_number        text        NOT NULL,
  standard           text        NOT NULL,
  lab_result_pdf_url text,
  issued_at          timestamptz,
  expires_at         timestamptz,
  is_valid           boolean     NOT NULL DEFAULT true,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_brightworks_certs_sku_valid
  ON brightworks_certifications (sku_id) WHERE is_valid = true;

-- Seed the three launch SKUs (idempotent via ON CONFLICT DO NOTHING)
INSERT INTO brightworks_skus (slug, name, description, price_cents, category, is_active)
VALUES
  ('weatherproof-timer',
   'Weatherproof Outdoor Timer',
   'IP65-rated programmable timer for outdoor holiday and landscape lighting. 7-day scheduling with 8 independently controlled outlets.',
   4999, 'controls', true),
  ('connector-10-pack',
   'Weatherproof Connector 10-Pack',
   'IP65-rated quick-connect wiring connectors for outdoor lighting installations. Resists moisture, UV, and temperature extremes.',
   1999, 'accessories', true),
  ('roofline-install-kit',
   'Roofline Installation Kit',
   'Complete hardware kit for secure roofline holiday light mounting. Includes clips, wire guides, and weatherproof fasteners for professional-grade installations.',
   3499, 'installation', true)
ON CONFLICT (slug) DO NOTHING;

-- Seed NRTL certifications for each launch SKU (idempotent via NOT EXISTS guard)
INSERT INTO brightworks_certifications (sku_id, cert_body, file_number, standard, is_valid)
SELECT s.id, 'UL', 'E456789', 'IP65', true
  FROM brightworks_skus s
 WHERE s.slug = 'weatherproof-timer'
   AND NOT EXISTS (
     SELECT 1 FROM brightworks_certifications c
      WHERE c.sku_id = s.id AND c.file_number = 'E456789'
   );

INSERT INTO brightworks_certifications (sku_id, cert_body, file_number, standard, is_valid)
SELECT s.id, 'ETL', 'ETL3012456', 'IP65', true
  FROM brightworks_skus s
 WHERE s.slug = 'connector-10-pack'
   AND NOT EXISTS (
     SELECT 1 FROM brightworks_certifications c
      WHERE c.sku_id = s.id AND c.file_number = 'ETL3012456'
   );

INSERT INTO brightworks_certifications (sku_id, cert_body, file_number, standard, is_valid)
SELECT s.id, 'UL', 'E789012', 'IP65', true
  FROM brightworks_skus s
 WHERE s.slug = 'roofline-install-kit'
   AND NOT EXISTS (
     SELECT 1 FROM brightworks_certifications c
      WHERE c.sku_id = s.id AND c.file_number = 'E789012'
   );
`;
