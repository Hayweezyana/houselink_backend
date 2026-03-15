import { Knex } from "knex";
import bcrypt from "bcryptjs";
import { DB_TABLES } from "../shared/enums/db-tables.enum";

/**
 * Seeds 5 users: 3 owners + 2 seekers.
 * All accounts use password: Password123!
 */
export async function seed(knex: Knex): Promise<void> {
  // Clear dependent tables first to avoid FK violations
  await knex("refresh_tokens").del().catch(() => {});
  await knex("notifications").del().catch(() => {});
  await knex("messages").del().catch(() => {});
  await knex("payments").del().catch(() => {});
  await knex("reviews").del().catch(() => {});
  await knex("wishlist").del().catch(() => {});
  await knex("properties").del().catch(() => {});
  await knex(DB_TABLES.USERS).del();

  const hash = await bcrypt.hash("Password123!", 12);

  await knex(DB_TABLES.USERS).insert([
    {
      id: "11111111-1111-1111-1111-111111111111",
      name: "Emeka Okafor",
      email: "emeka@houselink.ng",
      password: hash,
      role: "owner",
      created_at: new Date(),
      updated_at: new Date(),
    },
    {
      id: "22222222-2222-2222-2222-222222222222",
      name: "Amara Nwosu",
      email: "amara@houselink.ng",
      password: hash,
      role: "owner",
      created_at: new Date(),
      updated_at: new Date(),
    },
    {
      id: "33333333-3333-3333-3333-333333333333",
      name: "Tunde Adeyemi",
      email: "tunde@houselink.ng",
      password: hash,
      role: "owner",
      created_at: new Date(),
      updated_at: new Date(),
    },
    {
      id: "44444444-4444-4444-4444-444444444444",
      name: "Chisom Eze",
      email: "chisom@houselink.ng",
      password: hash,
      role: "user",
      created_at: new Date(),
      updated_at: new Date(),
    },
    {
      id: "55555555-5555-5555-5555-555555555555",
      name: "Fatima Aliyu",
      email: "fatima@houselink.ng",
      password: hash,
      role: "user",
      created_at: new Date(),
      updated_at: new Date(),
    },
  ]);

  console.log("✓ Seeded 5 users  (password: Password123!)");
}
