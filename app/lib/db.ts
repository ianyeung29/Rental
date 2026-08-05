import { neon } from "@neondatabase/serverless";

const databaseUrl = process.env.DATABASE_URL;

export const sql = databaseUrl ? neon(databaseUrl) : null;

let schemaPromise: Promise<void> | null = null;

export async function ensureDatabaseSchema() {
  if (!sql) throw new Error("DATABASE_URL is not configured.");
  if (schemaPromise) return schemaPromise;

  schemaPromise = (async () => {
    await sql.query(`
      CREATE TABLE IF NOT EXISTS rental_users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        display_name TEXT NOT NULL,
        phone TEXT NOT NULL DEFAULT '',
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user',
        account_type TEXT NOT NULL DEFAULT 'user',
        agent_verification_status TEXT NOT NULL DEFAULT 'unsubmitted',
        email_verified_at TIMESTAMPTZ,
        google_subject TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await sql.query("ALTER TABLE rental_users ADD COLUMN IF NOT EXISTS phone TEXT NOT NULL DEFAULT ''");
    await sql.query("ALTER TABLE rental_users ADD COLUMN IF NOT EXISTS account_type TEXT NOT NULL DEFAULT 'user'");
    await sql.query("ALTER TABLE rental_users ADD COLUMN IF NOT EXISTS agent_verification_status TEXT NOT NULL DEFAULT 'unsubmitted'");
    await sql.query("ALTER TABLE rental_users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ");
    await sql.query("ALTER TABLE rental_users ADD COLUMN IF NOT EXISTS google_subject TEXT");
    await sql.query(`
      CREATE TABLE IF NOT EXISTS rental_sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES rental_users(id) ON DELETE CASCADE,
        token_hash TEXT NOT NULL UNIQUE,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await sql.query(`
      CREATE TABLE IF NOT EXISTS rental_email_verifications (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES rental_users(id) ON DELETE CASCADE,
        token_hash TEXT NOT NULL UNIQUE,
        expires_at TIMESTAMPTZ NOT NULL,
        used_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await sql.query(`
      CREATE TABLE IF NOT EXISTS rental_saved_searches (
        user_id TEXT PRIMARY KEY REFERENCES rental_users(id) ON DELETE CASCADE,
        location TEXT NOT NULL DEFAULT '',
        min_price NUMERIC(12, 2),
        max_price NUMERIC(12, 2),
        bedrooms TEXT NOT NULL DEFAULT '',
        bathrooms TEXT NOT NULL DEFAULT '',
        rental_type TEXT NOT NULL DEFAULT 'all',
        move_in TEXT NOT NULL DEFAULT '',
        features JSONB NOT NULL DEFAULT '[]'::jsonb,
        sort_mode TEXT NOT NULL DEFAULT 'fit',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await sql.query("ALTER TABLE rental_saved_searches ADD COLUMN IF NOT EXISTS min_price NUMERIC(12, 2)");
    await sql.query("ALTER TABLE rental_saved_searches ADD COLUMN IF NOT EXISTS bedrooms TEXT NOT NULL DEFAULT ''");
    await sql.query("ALTER TABLE rental_saved_searches ADD COLUMN IF NOT EXISTS bathrooms TEXT NOT NULL DEFAULT ''");
    await sql.query(`
      CREATE TABLE IF NOT EXISTS rental_listing_drafts (
        user_id TEXT PRIMARY KEY REFERENCES rental_users(id) ON DELETE CASCADE,
        payload JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await sql.query(`
      CREATE TABLE IF NOT EXISTS rental_listings (
        id TEXT PRIMARY KEY,
        owner_id TEXT REFERENCES rental_users(id) ON DELETE SET NULL,
        title_zh TEXT NOT NULL,
        title_en TEXT NOT NULL,
        area_zh TEXT NOT NULL,
        area_en TEXT NOT NULL,
        rental_type TEXT NOT NULL,
        price NUMERIC(12, 2) NOT NULL,
        currency TEXT NOT NULL DEFAULT 'USD',
        bedrooms TEXT NOT NULL,
        bathrooms TEXT NOT NULL,
        move_in TEXT NOT NULL,
        lease TEXT NOT NULL,
        features JSONB NOT NULL DEFAULT '[]'::jsonb,
        tags_zh JSONB NOT NULL DEFAULT '[]'::jsonb,
        tags_en JSONB NOT NULL DEFAULT '[]'::jsonb,
        description_zh TEXT NOT NULL DEFAULT '',
        description_en TEXT NOT NULL DEFAULT '',
        poster_role TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'published',
        expires_on DATE,
        published_at TIMESTAMPTZ,
        paused_at TIMESTAMPTZ,
        is_sample BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await sql.query("ALTER TABLE rental_listings ADD COLUMN IF NOT EXISTS owner_id TEXT REFERENCES rental_users(id) ON DELETE SET NULL");
    await sql.query("ALTER TABLE rental_listings ADD COLUMN IF NOT EXISTS expires_on DATE");
    await sql.query("ALTER TABLE rental_listings ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ");
    await sql.query("ALTER TABLE rental_listings ADD COLUMN IF NOT EXISTS paused_at TIMESTAMPTZ");
    await sql.query("ALTER TABLE rental_listings ADD COLUMN IF NOT EXISTS is_sample BOOLEAN NOT NULL DEFAULT FALSE");
    await sql.query(`
      CREATE TABLE IF NOT EXISTS rental_saved_listings (
        user_id TEXT NOT NULL REFERENCES rental_users(id) ON DELETE CASCADE,
        listing_id TEXT NOT NULL REFERENCES rental_listings(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (user_id, listing_id)
      )
    `);
    await sql.query(`
      CREATE TABLE IF NOT EXISTS rental_agent_profiles (
        id TEXT PRIMARY KEY,
        user_id TEXT UNIQUE REFERENCES rental_users(id) ON DELETE SET NULL,
        display_name_zh TEXT NOT NULL,
        display_name_en TEXT NOT NULL,
        brokerage TEXT NOT NULL,
        license_state TEXT NOT NULL,
        license_number TEXT NOT NULL,
        service_areas JSONB NOT NULL DEFAULT '[]'::jsonb,
        languages JSONB NOT NULL DEFAULT '[]'::jsonb,
        fee_summary_zh TEXT NOT NULL DEFAULT '',
        fee_summary_en TEXT NOT NULL DEFAULT '',
        is_verified BOOLEAN NOT NULL DEFAULT FALSE,
        is_sample BOOLEAN NOT NULL DEFAULT FALSE,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        verification_submitted_at TIMESTAMPTZ,
        verification_reviewed_at TIMESTAMPTZ,
        verification_note TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await sql.query("ALTER TABLE rental_agent_profiles ADD COLUMN IF NOT EXISTS verification_submitted_at TIMESTAMPTZ");
    await sql.query("ALTER TABLE rental_agent_profiles ADD COLUMN IF NOT EXISTS verification_reviewed_at TIMESTAMPTZ");
    await sql.query("ALTER TABLE rental_agent_profiles ADD COLUMN IF NOT EXISTS verification_note TEXT NOT NULL DEFAULT ''");
    await sql.query(`
      CREATE TABLE IF NOT EXISTS rental_listing_private_details (
        listing_id TEXT PRIMARY KEY REFERENCES rental_listings(id) ON DELETE CASCADE,
        private_address TEXT NOT NULL,
        contact_name TEXT NOT NULL,
        contact_email TEXT NOT NULL,
        tour_preference TEXT NOT NULL,
        agent_service TEXT NOT NULL DEFAULT 'selfManaged',
        agent_fee_plan TEXT NOT NULL DEFAULT 'agentQuote',
        agent_fee_amount NUMERIC(12, 2),
        agent_profile_id TEXT REFERENCES rental_agent_profiles(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await sql.query("ALTER TABLE rental_listing_private_details ADD COLUMN IF NOT EXISTS agent_service TEXT NOT NULL DEFAULT 'selfManaged'");
    await sql.query("ALTER TABLE rental_listing_private_details ADD COLUMN IF NOT EXISTS agent_fee_plan TEXT NOT NULL DEFAULT 'agentQuote'");
    await sql.query("ALTER TABLE rental_listing_private_details ADD COLUMN IF NOT EXISTS agent_fee_amount NUMERIC(12, 2)");
    await sql.query("ALTER TABLE rental_listing_private_details ADD COLUMN IF NOT EXISTS agent_profile_id TEXT REFERENCES rental_agent_profiles(id) ON DELETE SET NULL");
    await sql.query(`
      CREATE TABLE IF NOT EXISTS rental_agent_requests (
        id TEXT PRIMARY KEY,
        listing_id TEXT NOT NULL UNIQUE REFERENCES rental_listings(id) ON DELETE CASCADE,
        owner_id TEXT NOT NULL REFERENCES rental_users(id) ON DELETE CASCADE,
        agent_profile_id TEXT REFERENCES rental_agent_profiles(id) ON DELETE SET NULL,
        fee_plan TEXT NOT NULL,
        fee_amount NUMERIC(12, 2),
        status TEXT NOT NULL DEFAULT 'pending',
        owner_note TEXT NOT NULL DEFAULT '',
        agent_note TEXT NOT NULL DEFAULT '',
        responded_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await sql.query(`
      CREATE TABLE IF NOT EXISTS rental_listing_media (
        id TEXT PRIMARY KEY,
        listing_id TEXT NOT NULL REFERENCES rental_listings(id) ON DELETE CASCADE,
        object_key TEXT NOT NULL,
        public_url TEXT NOT NULL,
        content_type TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await sql.query(`
      CREATE TABLE IF NOT EXISTS rental_inquiries (
        id TEXT PRIMARY KEY,
        listing_id TEXT NOT NULL REFERENCES rental_listings(id) ON DELETE CASCADE,
        requester_id TEXT NOT NULL REFERENCES rental_users(id) ON DELETE CASCADE,
        move_in TEXT NOT NULL,
        lease_length TEXT NOT NULL,
        occupants TEXT NOT NULL,
        pets TEXT NOT NULL,
        tour_preference TEXT NOT NULL,
        message TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'sent',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await sql.query(`
      CREATE TABLE IF NOT EXISTS rental_listing_reports (
        id TEXT PRIMARY KEY,
        listing_id TEXT NOT NULL REFERENCES rental_listings(id) ON DELETE CASCADE,
        reporter_id TEXT NOT NULL REFERENCES rental_users(id) ON DELETE CASCADE,
        reason TEXT NOT NULL,
        details TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'open',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (listing_id, reporter_id)
      )
    `);
    await sql.query("CREATE INDEX IF NOT EXISTS rental_sessions_user_idx ON rental_sessions(user_id, expires_at)");
    await sql.query("CREATE UNIQUE INDEX IF NOT EXISTS rental_users_google_subject_idx ON rental_users(google_subject) WHERE google_subject IS NOT NULL");
    await sql.query("CREATE INDEX IF NOT EXISTS rental_users_account_type_idx ON rental_users(account_type, agent_verification_status)");
    await sql.query("CREATE INDEX IF NOT EXISTS rental_email_verifications_user_idx ON rental_email_verifications(user_id, expires_at)");
    await sql.query("CREATE INDEX IF NOT EXISTS rental_saved_listings_user_idx ON rental_saved_listings(user_id, created_at DESC)");
    await sql.query("CREATE INDEX IF NOT EXISTS rental_saved_listings_listing_idx ON rental_saved_listings(listing_id, created_at DESC)");
    await sql.query("CREATE INDEX IF NOT EXISTS rental_listing_drafts_updated_idx ON rental_listing_drafts(updated_at DESC)");
    await sql.query("CREATE INDEX IF NOT EXISTS rental_listings_owner_idx ON rental_listings(owner_id, created_at DESC)");
    await sql.query("CREATE INDEX IF NOT EXISTS rental_listings_public_lifecycle_idx ON rental_listings(status, expires_on, created_at DESC)");
    await sql.query("CREATE INDEX IF NOT EXISTS rental_inquiries_requester_idx ON rental_inquiries(requester_id, created_at DESC)");
    await sql.query("CREATE INDEX IF NOT EXISTS rental_inquiries_listing_idx ON rental_inquiries(listing_id, created_at DESC)");
    await sql.query("CREATE INDEX IF NOT EXISTS rental_listing_reports_status_idx ON rental_listing_reports(status, created_at DESC)");
    await sql.query("CREATE INDEX IF NOT EXISTS rental_listings_status_created_idx ON rental_listings(status, created_at DESC)");
    await sql.query("CREATE INDEX IF NOT EXISTS rental_listing_media_listing_idx ON rental_listing_media(listing_id, sort_order)");
    await sql.query("CREATE INDEX IF NOT EXISTS rental_agent_profiles_active_idx ON rental_agent_profiles(is_active, is_verified, display_name_zh)");
    await sql.query("CREATE INDEX IF NOT EXISTS rental_listing_private_agent_idx ON rental_listing_private_details(agent_profile_id)");
    await sql.query("CREATE INDEX IF NOT EXISTS rental_agent_requests_owner_idx ON rental_agent_requests(owner_id, updated_at DESC)");
    await sql.query("CREATE INDEX IF NOT EXISTS rental_agent_requests_agent_idx ON rental_agent_requests(agent_profile_id, status, updated_at DESC)");
  })().catch((error) => {
    schemaPromise = null;
    throw error;
  });

  return schemaPromise;
}
