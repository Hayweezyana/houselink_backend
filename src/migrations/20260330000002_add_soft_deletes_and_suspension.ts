import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("users", (table) => {
    table.timestamp("suspended_at").nullable();
  });

  await knex.schema.alterTable("properties", (table) => {
    table.timestamp("deleted_at").nullable();
  });

  await knex.schema.alterTable("payments", (table) => {
    table.timestamp("deleted_at").nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("users", (table) => {
    table.dropColumn("suspended_at");
  });

  await knex.schema.alterTable("properties", (table) => {
    table.dropColumn("deleted_at");
  });

  await knex.schema.alterTable("payments", (table) => {
    table.dropColumn("deleted_at");
  });
}
