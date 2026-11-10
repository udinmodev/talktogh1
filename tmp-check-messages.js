const fs = require("fs");
const env = fs.readFileSync(".env.local", "utf8");
const match = env.match(/^DATABASE_URL=(.*)$/m);
if (!match) {
  console.log("no DATABASE_URL");
  process.exit(0);
}
const url = match[1].trim().replace(/^["']|["']$/g, "");
const { Client } = require("pg");
const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
client
  .connect()
  .then(() =>
    client.query(
      `SELECT recipient_id, sender_id, count(*)::int AS count, max(timestamp) AS latest
       FROM public.wire_messages
       WHERE timestamp > extract(epoch from now() - interval '6 hours') * 1000
       GROUP BY recipient_id, sender_id
       ORDER BY latest DESC
       LIMIT 20`
    )
  )
  .then((r) => {
    console.table(r.rows);
    return client.end();
  })
  .catch((e) => {
    console.error("ERR", e.message);
    process.exit(1);
  });
