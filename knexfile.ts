import type { Knex } from "knex";
import dotenv from "dotenv";
import path from "path";

dotenv.config();

// Supports both Neon-style PG* vars and legacy DB_* vars
const connection = process.env.PGHOST
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

const config: { [key: string]: Knex.Config } = {
  development: {
    client: "pg",
    connection,
    migrations: {
      directory: path.join(__dirname, "src/migrations"),
      extension: "ts",
    },
    seeds: {
      directory: path.join(__dirname, "src/seeds"),
    },
  },
  production: {
    client: "pg",
    connection,
    pool: { min: 2, max: 10 },
    migrations: {
      directory: path.join(__dirname, "src/migrations"),
      extension: "ts",
    },
  },
};

export default config;
