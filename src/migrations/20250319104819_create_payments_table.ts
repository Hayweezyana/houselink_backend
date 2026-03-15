import { Knex } from "knex";
import { DB_TABLES } from "../shared/enums/db-tables.enum";

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable(DB_TABLES.PAYMENTS, (table: Knex.TableBuilder) => {
    table.uuid("id").primary().defaultTo(knex.fn.uuid());
    table.uuid("user_id").notNullable().references("id").inTable("users").onDelete("CASCADE");
    table.uuid("property_id").notNullable().references("id").inTable("properties").onDelete("CASCADE");
    table.string("status").notNullable().defaultTo("pending");
    table.string("reference").notNullable().unique();
    table.integer("amount").notNullable();
    table.string("payment_method").notNullable();
    table.timestamp("created_at").defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
    const tableExists = await knex.schema.hasTable("payments");
  if (tableExists) {
  return knex.schema.dropTable(DB_TABLES.PAYMENTS);
}
}
