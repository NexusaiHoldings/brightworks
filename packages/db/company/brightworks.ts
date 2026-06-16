/**
 * Brightworks domain — database schema types + DDL.
 *
 * Defines the SKU catalog and NRTL certification registry tables.
 * UL/ETL certifications substantiate IP65 claims per FTC Act §5.
 * DDL is executed by the provisioning schema-setup step.
 */

export interface BrightworksSku {
  id: string;
  slug: string;
  name: string;
  description: string;
  price_cents: number;
  category: string;
  ip_rating: string | null;
  image_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface BrightworksCertification {
  id: string;
  sku_id: string;
  lab: string;
  file_number: string;
  pdf_url: string | null;
  issued_at: string | null;
  expires_at: string | null;
  is_valid: boolean;
  created_at: string;
}

export const BRIGHTWORKS_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS brightworks_skus (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT        UNIQUE NOT NULL,
  name        TEXT        NOT NULL,
  description TEXT        NOT NULL,
  price_cents INTEGER     NOT NULL,
  category    TEXT        NOT NULL,
  ip_rating   TEXT,
  image_url   TEXT,
  is_active   BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS brightworks_certifications (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  sku_id      UUID        NOT NULL REFERENCES brightworks_skus(id) ON DELETE CASCADE,
  lab         TEXT        NOT NULL,
  file_number TEXT        NOT NULL,
  pdf_url     TEXT,
  issued_at   DATE,
  expires_at  DATE,
  is_valid    BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;

/**
 * Seed rows for the three launch SKUs per CEO briefing MVP scope.
 * Insert these via the provisioning seed script.
 */
export const BRIGHTWORKS_SEED_SQL = `
INSERT INTO brightworks_skus (id, slug, name, description, price_cents, category, ip_rating, is_active)
VALUES
  ('00000000-0000-0000-0000-000000000001',
   'weatherproof-timer',
   'Weatherproof Timer',
   'Heavy-duty outdoor timer with IP65 weatherproof housing. Controls holiday lighting on programmable daily schedules.',
   4995, 'controls', 'IP65', true),
  ('00000000-0000-0000-0000-000000000002',
   'connector-10-pack',
   'Connector 10-Pack',
   'Waterproof inline connectors for roofline and landscape lighting runs. IP65-rated for all-season outdoor use.',
   1495, 'accessories', 'IP65', true),
  ('00000000-0000-0000-0000-000000000003',
   'roofline-install-kit',
   'Roofline Install Kit',
   'Complete professional installation kit for permanent roofline lighting. Includes clips, channel, and mounting hardware.',
   8995, 'installation', null, true)
ON CONFLICT (slug) DO NOTHING;
`;
