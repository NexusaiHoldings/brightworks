/**
 * Brightworks SKU catalog + NRTL certification registry (F1-002).
 *
 * Three launch SKUs: weatherproof timer, connector 10-pack, roofline install kit.
 * Each SKU links to certification records (UL/ETL file numbers + lab PDFs)
 * required by OSHA 29 CFR 1910.303. IP65 badge shown only when a valid
 * certification exists (FTC Act Section 5 substantiation).
 */
export const BRIGHTWORKS_DDL = `
CREATE TABLE IF NOT EXISTS bw_skus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  price_cents integer NOT NULL,
  tier text NOT NULL DEFAULT 'retail',
  image_url text,
  ip_rating text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bw_certifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku_id uuid NOT NULL REFERENCES bw_skus(id) ON DELETE CASCADE,
  lab text NOT NULL,
  file_number text NOT NULL,
  standard text NOT NULL,
  pdf_url text,
  issued_at date,
  expires_at date,
  valid boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bw_certifications_sku_id
  ON bw_certifications(sku_id);

CREATE INDEX IF NOT EXISTS idx_bw_skus_status
  ON bw_skus(status, slug);

-- Seed the three launch SKUs (idempotent via ON CONFLICT DO NOTHING).
INSERT INTO bw_skus (slug, name, description, price_cents, tier, ip_rating, status)
VALUES
  (
    'weatherproof-timer',
    'Weatherproof Timer',
    'Programmable outdoor timer rated IP65 for all-weather roofline use. Compatible with standard 15A circuits and all major roofline LED brands.',
    4999, 'retail', 'IP65', 'active'
  ),
  (
    'connector-10-pack',
    'Connector 10-Pack',
    'Weatherproof twist-lock connectors for roofline LED runs. UV-stabilized housing rated for 10A continuous outdoor service.',
    1499, 'retail', NULL, 'active'
  ),
  (
    'roofline-install-kit',
    'Roofline Install Kit',
    'Complete roofline mounting hardware bundle: gutter clips, standoffs, cable ties, and a weatherproof junction box for a clean professional finish.',
    8999, 'retail', NULL, 'active'
  )
ON CONFLICT (slug) DO NOTHING;
`;
