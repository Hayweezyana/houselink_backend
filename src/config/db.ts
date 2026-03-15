import { Knex, knex } from "knex";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

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

const knexConfig: Knex.Config = {
  client: "pg",
  connection,
  pool: { min: 2, max: 10 },
  migrations: { directory: "./src/migrations" },
  seeds: { directory: "./src/seeds" },
};

const db = knex(knexConfig);
export default db;
