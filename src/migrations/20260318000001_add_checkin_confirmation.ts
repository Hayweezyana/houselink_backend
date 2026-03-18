import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("payments", (table) => {
    table.date("checkin_date").nullable();
    table.date("checkout_date").nullable();
    table.timestamp("seeker_confirmed_at").nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("payments", (table) => {
    table.dropColumn("checkin_date");
    table.dropColumn("checkout_date");
    table.dropColumn("seeker_confirmed_at");
  });
}
