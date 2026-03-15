/**
 * Plain JS migration runner — no npm environment injection issues.
 * Usage: node migrate.js [up|down]
 */
const path = require("path");

// Step 1: load .env from project root (absolute path, before anything else)
require("dotenv").config({ path: path.resolve(__dirname, ".env") });

const PGHOST = process.env.PGHOST || process.env.DB_HOST;
if (!PGHOST) {
  console.error("❌  PGHOST is not set. Check your .env file.");
  process.exit(1);
}
console.log("✔  PGHOST loaded:", PGHOST.slice(0, 30) + "...");

// Step 2: register ts-node so require() can load .ts migration files
require("ts-node").register({ transpileOnly: true, esm: false });

// Step 3: build knex instance directly (skip CLI entirely)
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

const db = knex({
  client: "pg",
  connection,
  migrations: {
    directory: path.join(__dirname, "src/migrations"),
    loadExtensions: [".ts"],
  },
});

const action = process.argv[2] === "down" ? "rollback" : "latest";

db.migrate[action]()
  .then(([batch, list]) => {
    if (!list.length) {
      console.log("✔  Already up to date.");
    } else {
      console.log(`✔  Batch ${batch}: ${list.length} migration(s) ${action === "rollback" ? "rolled back" : "applied"}`);
      list.forEach((f) => console.log("   •", path.basename(f)));
    }
    db.destroy();
    process.exit(0);
  })
  .catch((err) => {
    console.error("❌  Migration failed:", err.message);
    db.destroy();
    process.exit(1);
  });
