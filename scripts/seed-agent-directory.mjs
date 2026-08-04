import nextEnv from "@next/env";
import { neon } from "@neondatabase/serverless";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not configured. Add it to .env.local before seeding the agent directory.");
}

const sql = neon(databaseUrl);
const profiles = [
  {
    id: "sample-agent-queens",
    displayNameZh: "示例经纪 · Queens",
    displayNameEn: "Sample Agent · Queens",
    brokerage: "Demo Realty · Synthetic",
    licenseState: "NY",
    licenseNumber: "SAMPLE-NY-001",
    serviceAreas: ["皇后区", "Queens", "Forest Hills", "Flushing"],
    languages: ["中文", "English"],
    feeSummaryZh: "可按成交或固定费用协商",
    feeSummaryEn: "Success-based or flat fee by agreement",
  },
  {
    id: "sample-agent-long-island",
    displayNameZh: "示例经纪 · Long Island",
    displayNameEn: "Sample Agent · Long Island",
    brokerage: "Demo Realty · Synthetic",
    licenseState: "NY",
    licenseNumber: "SAMPLE-NY-002",
    serviceAreas: ["长岛", "Long Island", "Nassau", "Suffolk"],
    languages: ["中文", "English"],
    feeSummaryZh: "先沟通服务范围和费用",
    feeSummaryEn: "Confirm scope and fee before engagement",
  },
  {
    id: "sample-agent-brooklyn",
    displayNameZh: "示例经纪 · Brooklyn",
    displayNameEn: "Sample Agent · Brooklyn",
    brokerage: "Demo Realty · Synthetic",
    licenseState: "NY",
    licenseNumber: "SAMPLE-NY-003",
    serviceAreas: ["布鲁克林", "Brooklyn", "Sunset Park", "Downtown Brooklyn"],
    languages: ["中文", "English"],
    feeSummaryZh: "可提供看房协调和租客筛选",
    feeSummaryEn: "Tour coordination and renter screening available",
  },
];

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
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`);

for (const profile of profiles) {
  await sql.query(`
    INSERT INTO rental_agent_profiles (
      id, display_name_zh, display_name_en, brokerage, license_state, license_number,
      service_areas, languages, fee_summary_zh, fee_summary_en, is_verified, is_sample, is_active
    ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9, $10, FALSE, TRUE, TRUE)
    ON CONFLICT (id) DO UPDATE SET
      display_name_zh = EXCLUDED.display_name_zh,
      display_name_en = EXCLUDED.display_name_en,
      brokerage = EXCLUDED.brokerage,
      license_state = EXCLUDED.license_state,
      license_number = EXCLUDED.license_number,
      service_areas = EXCLUDED.service_areas,
      languages = EXCLUDED.languages,
      fee_summary_zh = EXCLUDED.fee_summary_zh,
      fee_summary_en = EXCLUDED.fee_summary_en,
      is_verified = FALSE,
      is_sample = TRUE,
      is_active = TRUE,
      updated_at = NOW()
  `, [
    profile.id,
    profile.displayNameZh,
    profile.displayNameEn,
    profile.brokerage,
    profile.licenseState,
    profile.licenseNumber,
    JSON.stringify(profile.serviceAreas),
    JSON.stringify(profile.languages),
    profile.feeSummaryZh,
    profile.feeSummaryEn,
  ]);
}

console.log(`Seeded ${profiles.length} synthetic agent profiles. They are marked as sample profiles, not verified professionals.`);
