import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("payments", (table) => {
    table.string("dispute_status").nullable(); // 'open' | 'resolved' | 'dismissed'
    table.text("dispute_reason").nullable();
    table.timestamp("disputed_at").nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("payments", (table) => {
    table.dropColumn("dispute_status");
    table.dropColumn("dispute_reason");
    table.dropColumn("disputed_at");
  });
}
