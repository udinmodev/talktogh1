const fs = require("fs");
const path = require("path");
const envContent = fs.readFileSync(path.join(__dirname, ".env.local"), "utf-8");
for (const line of envContent.split("\n")) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const i = t.indexOf("=");
  if (i > 0) {
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    process.env[t.slice(0, i).trim()] = v;
  }
}
const { Pool } = require("pg");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

(async () => {
  const all = await pool.query(
    `SELECT user_id, platform, left(token, 30) AS token_prefix, last_seen_at AS seen
     FROM public.push_tokens ORDER BY user_id, platform, last_seen_at DESC`
  );
  console.table(all.rows);

  const disp = await pool.query(
    `SELECT * FROM public.push_dispatch_log ORDER BY 1 DESC LIMIT 5`
  ).catch((e) => ({ rows: [], err: e.message }));
  console.log("== dispatch log ==", disp.err || "");
  console.table(disp.rows);
  await pool.end();
})().catch((e) => { console.error(e); process.exit(1); });
