import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("otp_codes", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.string("email").notNullable().index();
    table.string("code", 6).notNullable();
    table.string("type").notNullable(); // 'signup' | 'login' | 'password_reset'
    table.timestamp("expires_at").notNullable();
    table.boolean("used").defaultTo(false);
    table.timestamp("created_at").defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("otp_codes");
}
