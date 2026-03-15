import type { Knex } from "knex";
import dotenv from "dotenv";
import path from "path";

// Load .env from the project root, regardless of cwd or NODE_ENV
dotenv.config({ path: path.resolve(__dirname, ".env") });

// Supports DATABASE_URL (Neon connection string) OR individual PG* vars
const connection: Knex.PgConnectionConfig | string = process.env.DATABASE_URL
  ? process.env.DATABASE_URL
  : process.env.PGHOST
  ? {
      host: process.env.PGHOST,
      user: process.env.PGUSER,
      password: process.env.PGPASSWORD,
      database: process.env.PGDATABASE,
      port: 5432,
      ssl: { rejectUnauthorized: false },
    }
  : {
      host: process.env.DB_HOST || "localhost",
      user: process.env.DB_USER || "postgres",
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME || "houselink",
      port: Number(process.env.DB_PORT) || 5432,
    };

const migrationConfig = {
  directory: path.join(__dirname, "src/migrations"),
  extension: "ts",
};

const config: { [key: string]: Knex.Config } = {
  development: {
    client: "pg",
    connection,
    migrations: migrationConfig,
    seeds: { directory: path.join(__dirname, "src/seeds") },
  },
  production: {
    client: "pg",
    connection,
    pool: { min: 2, max: 10 },
    migrations: migrationConfig,
  },
};

export default config;
