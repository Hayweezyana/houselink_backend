/**
 * Plain JS migration runner — no npm environment injection issues.
 * Usage: node migrate.js [up|down]
 *
 * Self-healing: if knex detects "corrupt" (entries in knex_migrations whose
 * files no longer exist on disk), we remove the stale entries and retry once.
 */
const path = require("path");
const fs   = require("fs");

// Step 1: load .env from project root
require("dotenv").config({ path: path.resolve(__dirname, ".env") });

const PGHOST = process.env.PGHOST || process.env.DB_HOST;
if (!PGHOST) {
  console.error("❌  PGHOST is not set. Check your .env file.");
  process.exit(1);
}
console.log("✔  PGHOST loaded:", PGHOST.slice(0, 30) + "...");

// Step 2: register ts-node so require() can load .ts migration files
require("ts-node").register({ transpileOnly: true, esm: false });

// Step 3: build knex instance
const { knex } = require("knex");
const connection = process.env.DATABASE_URL
  ? process.env.DATABASE_URL
  : {
      host: PGHOST,
      user: process.env.PGUSER || process.env.DB_USER,
      password: process.env.PGPASSWORD || process.env.DB_PASSWORD,
      database: process.env.PGDATABASE || process.env.DB_NAME,
      port: 5432,
      ssl: { rejectUnauthorized: false },
    };

const MIGRATIONS_DIR = path.join(__dirname, "src/migrations");

function buildDb() {
  return knex({
    client: "pg",
    connection,
    migrations: {
      directory: MIGRATIONS_DIR,
      loadExtensions: [".ts"],
    },
  });
}

/**
 * Remove knex_migrations rows whose files no longer exist in MIGRATIONS_DIR.
 * Returns the number of rows deleted.
 */
async function repairCorruption(db) {
  const rows = await db("knex_migrations").select("id", "name");
  const toDelete = rows.filter((r) => {
    const filePath = path.join(MIGRATIONS_DIR, r.name);
    return !fs.existsSync(filePath);
  });

  if (toDelete.length === 0) return 0;

  const ids = toDelete.map((r) => r.id);
  await db("knex_migrations").whereIn("id", ids).delete();
  console.log(`⚠️  Removed ${toDelete.length} stale migration record(s):`);
  toDelete.forEach((r) => console.log("   •", r.name));
  return toDelete.length;
}

async function runMigrations() {
  const action = process.argv[2] === "down" ? "rollback" : "latest";
  const db = buildDb();

  try {
    const [batch, list] = await db.migrate[action]();
    if (!list.length) {
      console.log("✔  Already up to date.");
    } else {
      console.log(`✔  Batch ${batch}: ${list.length} migration(s) ${action === "rollback" ? "rolled back" : "applied"}`);
      list.forEach((f) => console.log("   •", path.basename(f)));
    }
    await db.destroy();
    process.exit(0);
  } catch (err) {
    if (err.message && err.message.includes("migration directory is corrupt")) {
      console.warn("⚠️  Corrupt migration state detected — attempting self-repair…");
      const removed = await repairCorruption(db);
      await db.destroy();

      if (removed === 0) {
        // Nothing to repair — a genuinely unknown corruption
        console.error("❌  Could not identify stale records. Migration failed:", err.message);
        process.exit(1);
      }

      // Retry once after repair
      console.log("🔄  Retrying migrations after repair…");
      const db2 = buildDb();
      try {
        const [batch, list] = await db2.migrate[action]();
        if (!list.length) {
          console.log("✔  Already up to date.");
        } else {
          console.log(`✔  Batch ${batch}: ${list.length} migration(s) applied after repair`);
          list.forEach((f) => console.log("   •", path.basename(f)));
        }
        await db2.destroy();
        process.exit(0);
      } catch (retryErr) {
        console.error("❌  Migration failed after repair:", retryErr.message);
        await db2.destroy();
        process.exit(1);
      }
    } else {
      console.error("❌  Migration failed:", err.message);
      await db.destroy();
      process.exit(1);
    }
  }
}

runMigrations();
