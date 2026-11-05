import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

// 1. Read .env.local
const envPath = path.join(process.cwd(), ".env.local");
if (!fs.existsSync(envPath)) {
  console.error("❌ .env.local not found!");
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, "utf-8");
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith("#")) {
    const idx = trimmed.indexOf("=");
    if (idx > 0) {
      process.env[trimmed.substring(0, idx).trim()] = trimmed.substring(idx + 1).trim();
    }
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error("❌ Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(url, key);

async function pushTableData() {
  console.log("=== PUSHING LOCAL ZERO-KNOWLEDGE ENVELOPES TO SUPABASE TABLES ===");
  console.log("Connecting to:", url);

  // 1. Push Public Keys
  const defaultKeys = [
    {
      user_id: "alice",
      fingerprint: "A9F438B2C19E77A0",
      key_rotation_version: 1,
      updated_at: new Date().toISOString(),
    },
    {
      user_id: "bob",
      fingerprint: "E730D8192BF04C61",
      key_rotation_version: 1,
      updated_at: new Date().toISOString(),
    },
    {
      user_id: "elena",
      fingerprint: "92C4E10A7BD835F2",
      key_rotation_version: 1,
      updated_at: new Date().toISOString(),
    },
  ];

  console.log("\n1. Pushing public key directory into 'public.public_keys'...");
  const { data: keyRes, error: keyErr } = await supabase
    .from("public_keys")
    .upsert(defaultKeys, { onConflict: "user_id" })
    .select();

  if (keyErr) {
    console.error("❌ Error pushing public_keys:", keyErr.message);
  } else {
    console.log(`✅ Upserted ${defaultKeys.length} public key profiles to Supabase.`);
  }

  // 2. Read local data/wire-messages.json
  const wireFile = path.join(process.cwd(), "data", "wire-messages.json");
  if (!fs.existsSync(wireFile)) {
    console.log("No wire messages file found.");
    return;
  }

  const rawMessages = JSON.parse(fs.readFileSync(wireFile, "utf-8"));
  console.log(`\n2. Found ${rawMessages.length} wire envelopes in local store.`);

  const rows = rawMessages.map((m) => ({
    id: m.id,
    sender_id: m.senderId,
    recipient_id: m.recipientId,
    encrypted_payload: m.encryptedPayload,
    timestamp: m.timestamp,
    status: m.status || "delivered",
    disappearing_duration: m.disappearingDuration ?? null,
    expires_at: m.expiresAt ?? null,
    view_once: Boolean(m.viewOnce),
    is_burned: Boolean(m.isBurned),
    is_pinned: Boolean(m.isPinned),
    security_type: m.securityType || "standard",
    media_type: m.mediaType ?? null,
    media_url: m.mediaUrl ?? null,
    reactions: m.reactions ?? {},
  }));

  console.log(`Pushing ${rows.length} encrypted wire messages into 'public.wire_messages'...`);
  const { data: msgRes, error: msgErr } = await supabase
    .from("wire_messages")
    .upsert(rows, { onConflict: "id" })
    .select();

  if (msgErr) {
    console.error("❌ Error pushing wire_messages:", msgErr.message);
  } else {
    console.log(`✅ Successfully pushed ${rows.length} wire messages to Supabase!`);
  }

  // 3. Verify counts
  const { count: finalMsgCount } = await supabase
    .from("wire_messages")
    .select("*", { count: "exact", head: true });

  const { count: finalKeyCount } = await supabase
    .from("public_keys")
    .select("*", { count: "exact", head: true });

  console.log("\n=== VERIFICATION RESULTS ===");
  console.log(`📊 public.wire_messages count: ${finalMsgCount}`);
  console.log(`📊 public.public_keys count: ${finalKeyCount}`);
  console.log("🎉 Real Supabase tables populated and operational!");
}

pushTableData();
