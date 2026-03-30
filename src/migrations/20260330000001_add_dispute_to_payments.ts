import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  const hasStatus = await knex.schema.hasColumn("payments", "dispute_status");
  const hasReason = await knex.schema.hasColumn("payments", "dispute_reason");
  const hasAt = await knex.schema.hasColumn("payments", "disputed_at");

  await knex.schema.alterTable("payments", (table) => {
    if (!hasStatus) table.string("dispute_status").nullable();
    if (!hasReason) table.text("dispute_reason").nullable();
    if (!hasAt) table.timestamp("disputed_at").nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("payments", (table) => {
    table.dropColumn("dispute_status");
    table.dropColumn("dispute_reason");
    table.dropColumn("disputed_at");
  });
}
