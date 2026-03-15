import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  // Bank accounts — owner payout destinations
  await knex.schema.createTable("bank_accounts", (table) => {
    table.uuid("id").primary().defaultTo(knex.fn.uuid());
    table.uuid("owner_id").notNullable().references("id").inTable("users").onDelete("CASCADE");
    table.string("account_number", 10).notNullable();
    table.string("account_name").notNullable();
    table.string("bank_name").notNullable();
    table.string("bank_code", 10).notNullable();
    table.string("recipient_code").notNullable(); // Paystack transfer recipient code
    table.boolean("is_default").notNullable().defaultTo(true);
    table.timestamp("created_at").defaultTo(knex.fn.now());
  });

  // Extend payments table with escrow fields
  await knex.schema.alterTable("payments", (table) => {
    table.uuid("owner_id").nullable().references("id").inTable("users").onDelete("SET NULL");
    // escrow_status: held → released (transfer success) | failed (transfer failed)
    table.string("escrow_status").notNullable().defaultTo("held");
    table.integer("platform_fee").nullable();   // in kobo (5% of amount*100)
    table.integer("owner_amount").nullable();   // in kobo (95% of amount*100)
    table.string("transfer_reference").nullable().unique();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("payments", (table) => {
    table.dropColumn("owner_id");
    table.dropColumn("escrow_status");
    table.dropColumn("platform_fee");
    table.dropColumn("owner_amount");
    table.dropColumn("transfer_reference");
  });
  await knex.schema.dropTableIfExists("bank_accounts");
}
