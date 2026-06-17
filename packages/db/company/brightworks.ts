/**
 * Brightworks SKU catalog + certification registry schema (F1-002).
 *
 * Three launch SKUs: weatherproof timer, connector 10-pack, roofline install kit.
 * Certifications link NRTL docs (UL/ETL file numbers + lab PDFs) per
 * regulatory_risk OSHA 29 CFR 1910.303 finding. IP65 badge is shown on
 * product pages ONLY when a valid certification record exists (FTC Act §5).
 */
export const BRIGHTWORKS_DDL = `
CREATE TABLE IF NOT EXISTS skus (
  id          uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        text    UNIQUE NOT NULL,
  name        text    NOT NULL,
  description text,
  price_cents integer NOT NULL,
  category    text    NOT NULL DEFAULT 'general',
  image_url   text,
  in_stock    boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sku_certifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku_id      uuid NOT NULL REFERENCES skus(id) ON DELETE CASCADE,
  cert_type   text NOT NULL,
  file_number text NOT NULL,
  lab_pdf_url text,
  issued_at   date,
  expires_at  date,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_skus_slug
  ON skus (slug);

CREATE INDEX IF NOT EXISTS idx_sku_certifications_sku_id
  ON sku_certifications (sku_id);

INSERT INTO skus (slug, name, description, price_cents, category)
  VALUES
    ('weatherproof-timer',
     'Weatherproof Roofline Timer',
     'IP65-rated programmable timer for roofline lighting — pre-wired with a waterproof enclosure rated for year-round outdoor use.',
     4999, 'control'),
    ('connector-10-pack',
     'Weatherproof Connector 10-Pack',
     'Lock-and-seal quick-connect splitters for 5-pin roofline light runs. Rated for 10 A continuous, IP65.',
     1499, 'accessory'),
    ('roofline-install-kit',
     'Roofline Install Kit',
     'Everything a professional installer needs for a single roofline run: mounting clips, drip-loop wire keepers, junction box, and strain-relief fittings.',
     3999, 'installation')
  ON CONFLICT (slug) DO NOTHING;
`;
