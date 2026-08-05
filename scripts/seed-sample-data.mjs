import nextEnv from "@next/env";
import { neon } from "@neondatabase/serverless";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not configured. Add it to .env.local before seeding sample data.");
}

const sql = neon(databaseUrl);

const samples = [
  {
    id: "sample-elmwood-light",
    titleZh: "树影公园旁的两居",
    titleEn: "Two bedrooms beside Elmwood Park",
    areaZh: "Queens · Forest Hills 一带",
    areaEn: "Queens · around Forest Hills",
    privateAddress: "123 Example Avenue, Queens, NY 11375",
    contactName: "示例联系人 · Elmwood",
    contactEmail: "sample-elmwood@example.invalid",
    posterRole: "owner",
    rentalType: "entire",
    price: 3200,
    bedrooms: "2",
    bathrooms: "1",
    squareFeet: 1100,
    moveIn: "2026-09-01",
    lease: "12 months",
    features: ["furnished", "utilities", "laundry"],
    tagsZh: ["家具齐全", "部分费用包含", "楼内洗衣房"],
    tagsEn: ["Furnished", "Utilities included", "Laundry in building"],
    descriptionZh: "这是用于体验发布、搜索和联系流程的合成示例房源，不代表真实库存或商业报价。",
    descriptionEn: "Synthetic demo inventory for testing the posting, search, and inquiry flows. Not a real rental or commercial quote.",
    tourPreference: "flexible",
    objectKey: "samples/elmwood-light.png",
    publicUrl: "/listings/elmwood-light.png",
  },
  {
    id: "sample-harbor-window",
    titleZh: "带早餐角的明亮一居",
    titleEn: "Bright one-bedroom with a breakfast nook",
    areaZh: "Jersey City · Heights 一带",
    areaEn: "Jersey City · around the Heights",
    privateAddress: "88 Demo Harbor Drive, Jersey City, NJ 07302",
    contactName: "示例联系人 · Harbor",
    contactEmail: "sample-harbor@example.invalid",
    posterRole: "agent",
    rentalType: "entire",
    price: 2680,
    bedrooms: "1",
    bathrooms: "1",
    squareFeet: 720,
    moveIn: "2026-08-15",
    lease: "12 months",
    features: ["utilities", "parking", "pets"],
    tagsZh: ["采光好", "可养宠物", "停车位可询"],
    tagsEn: ["Daylight", "Pets considered", "Parking available"],
    descriptionZh: "这是用于体验发布、搜索和联系流程的合成示例房源，不代表真实库存或商业报价。",
    descriptionEn: "Synthetic demo inventory for testing the posting, search, and inquiry flows. Not a real rental or commercial quote.",
    tourPreference: "weekends",
    objectKey: "samples/harbor-window.png",
    publicUrl: "/listings/harbor-window.png",
  },
  {
    id: "sample-cedar-room",
    titleZh: "近通勤线的独立房间",
    titleEn: "Private room near a commuter line",
    areaZh: "North York · Willowdale 一带",
    areaEn: "North York · around Willowdale",
    privateAddress: "20 Cedar Test Road, North York, ON M2N 5P8",
    contactName: "示例联系人 · Cedar",
    contactEmail: "sample-cedar@example.invalid",
    posterRole: "owner",
    rentalType: "privateRoom",
    price: 1450,
    bedrooms: "1",
    bathrooms: "1",
    squareFeet: 520,
    moveIn: "2026-09-01",
    lease: "6 months",
    features: ["furnished", "utilities", "laundry", "pets"],
    tagsZh: ["家具齐全", "水电网全包", "短租可询"],
    tagsEn: ["Furnished", "Utilities included", "Short lease possible"],
    descriptionZh: "这是用于体验发布、搜索和联系流程的合成示例房源，不代表真实库存或商业报价。",
    descriptionEn: "Synthetic demo inventory for testing the posting, search, and inquiry flows. Not a real rental or commercial quote.",
    tourPreference: "flexible",
    objectKey: "samples/cedar-room.png",
    publicUrl: "/listings/cedar-room.png",
  },
  {
    id: "sample-sunset-sublet",
    titleZh: "带露台的短租转租",
    titleEn: "A terrace sublet for the fall",
    areaZh: "Brooklyn · Sunset Park 一带",
    areaEn: "Brooklyn · around Sunset Park",
    privateAddress: "77 Sunset Sample Street, Brooklyn, NY 11220",
    contactName: "示例联系人 · Sunset",
    contactEmail: "sample-sunset@example.invalid",
    posterRole: "owner",
    rentalType: "sublet",
    price: 2350,
    bedrooms: "1",
    bathrooms: "1",
    squareFeet: 850,
    moveIn: "2026-09-15",
    lease: "4 months",
    features: ["furnished", "utilities", "parking"],
    tagsZh: ["带家具", "露台", "租期灵活"],
    tagsEn: ["Furnished", "Terrace", "Flexible term"],
    descriptionZh: "这是用于体验发布、搜索和联系流程的合成示例房源，不代表真实库存或商业报价。",
    descriptionEn: "Synthetic demo inventory for testing the posting, search, and inquiry flows. Not a real rental or commercial quote.",
    tourPreference: "weekends",
    objectKey: "samples/sunset-sublet.png",
    publicUrl: "/listings/sunset-sublet.png",
  },
];

await sql.query("ALTER TABLE rental_listings ADD COLUMN IF NOT EXISTS is_sample BOOLEAN NOT NULL DEFAULT FALSE");
await sql.query("ALTER TABLE rental_listings ADD COLUMN IF NOT EXISTS square_feet INTEGER");
await sql.query(`
  CREATE TABLE IF NOT EXISTS rental_saved_searches (
    user_id TEXT PRIMARY KEY REFERENCES rental_users(id) ON DELETE CASCADE,
    location TEXT NOT NULL DEFAULT '',
    max_price NUMERIC(12, 2),
    rental_type TEXT NOT NULL DEFAULT 'all',
    move_in TEXT NOT NULL DEFAULT '',
    features JSONB NOT NULL DEFAULT '[]'::jsonb,
    sort_mode TEXT NOT NULL DEFAULT 'fit',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`);

for (const sample of samples) {
  await sql.query(`
    INSERT INTO rental_listings (
      id, owner_id, title_zh, title_en, area_zh, area_en, rental_type, price, currency,
      bedrooms, bathrooms, square_feet, move_in, lease, features, tags_zh, tags_en,
      description_zh, description_en, poster_role, status, is_sample
    ) VALUES ($1, NULL, $2, $3, $4, $5, $6, $7, 'USD', $8, $9, $10, $11, $12, $13::jsonb, $14::jsonb, $15::jsonb, $16, $17, $18, 'published', TRUE)
    ON CONFLICT (id) DO UPDATE SET
      owner_id = NULL,
      title_zh = EXCLUDED.title_zh,
      title_en = EXCLUDED.title_en,
      area_zh = EXCLUDED.area_zh,
      area_en = EXCLUDED.area_en,
      rental_type = EXCLUDED.rental_type,
      price = EXCLUDED.price,
      currency = 'USD',
      bedrooms = EXCLUDED.bedrooms,
      bathrooms = EXCLUDED.bathrooms,
      square_feet = EXCLUDED.square_feet,
      move_in = EXCLUDED.move_in,
      lease = EXCLUDED.lease,
      features = EXCLUDED.features,
      tags_zh = EXCLUDED.tags_zh,
      tags_en = EXCLUDED.tags_en,
      description_zh = EXCLUDED.description_zh,
      description_en = EXCLUDED.description_en,
      poster_role = EXCLUDED.poster_role,
      status = 'published',
      is_sample = TRUE,
      updated_at = NOW()
  `, [
    sample.id,
    sample.titleZh,
    sample.titleEn,
    sample.areaZh,
    sample.areaEn,
    sample.rentalType,
    sample.price,
    sample.bedrooms,
    sample.bathrooms,
    sample.squareFeet,
    sample.moveIn,
    sample.lease,
    JSON.stringify(sample.features),
    JSON.stringify(sample.tagsZh),
    JSON.stringify(sample.tagsEn),
    sample.descriptionZh,
    sample.descriptionEn,
    sample.posterRole,
  ]);

  await sql.query(`
    INSERT INTO rental_listing_private_details (listing_id, private_address, contact_name, contact_email, tour_preference)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (listing_id) DO UPDATE SET
      private_address = EXCLUDED.private_address,
      contact_name = EXCLUDED.contact_name,
      contact_email = EXCLUDED.contact_email,
      tour_preference = EXCLUDED.tour_preference,
      updated_at = NOW()
  `, [sample.id, sample.privateAddress, sample.contactName, sample.contactEmail, sample.tourPreference]);

  await sql.query("DELETE FROM rental_listing_media WHERE listing_id = $1", [sample.id]);
  await sql.query(`
    INSERT INTO rental_listing_media (id, listing_id, object_key, public_url, content_type, sort_order)
    VALUES ($1, $2, $3, $4, 'image/png', 0)
  `, [`${sample.id}-media`, sample.id, sample.objectKey, sample.publicUrl]);
}

const rows = await sql.query(`
  SELECT id, is_sample
  FROM rental_listings
  WHERE is_sample = TRUE AND id = ANY($1::text[])
  ORDER BY id
`, [samples.map((sample) => sample.id)]);

console.log(`Seeded ${rows.length} synthetic listings: ${rows.map((row) => row.id).join(", ")}`);
