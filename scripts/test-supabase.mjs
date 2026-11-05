import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

// Load .env.local if present
const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const idx = trimmed.indexOf("=");
      if (idx > 0) {
        const k = trimmed.substring(0, idx).trim();
        const v = trimmed.substring(idx + 1).trim();
        process.env[k] = v;
      }
    }
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

console.log("=== SUPABASE CONNECTION DIAGNOSTIC ===");
console.log("Supabase URL:", url ? url : "(NOT SET)");
console.log("Anon Key:", key ? `${key.substring(0, 15)}...` : "(NOT SET)");

if (!url || !key || url.includes("your-project-id")) {
  console.log("\n⚠️ Supabase credentials are not set in .env.local yet.");
  console.log("Create .env.local with:");
  console.log("  NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co");
  console.log("  NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>");
  process.exit(0);
}

const client = createClient(url, key);

async function testConnection() {
  try {
    console.log("\nTesting connection to public.wire_messages table...");
    const { data, error } = await client.from("wire_messages").select("id").limit(1);

    if (error) {
      console.error("❌ Connection failed with error:", error.message);
      if (error.code === "42P01") {
        console.log("👉 Table 'wire_messages' does not exist yet. Please run the SQL in 'supabase/schema.sql' in your Supabase SQL Editor.");
      }
    } else {
      console.log("✅ Successfully connected to Supabase!");
      console.log(`Found ${data ? data.length : 0} rows in 'wire_messages'.`);
    }
  } catch (err) {
    console.error("❌ Unexpected error:", err);
  }
}

testConnection();
