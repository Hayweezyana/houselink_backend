import { Knex } from "knex";
import { DB_TABLES } from "../shared/enums/db-tables.enum";

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable(DB_TABLES.MESSAGES, (table: Knex.TableBuilder) => {
    table.uuid("id").primary().defaultTo(knex.fn.uuid());
    table.uuid("sender_id").notNullable().references("id").inTable("users").onDelete("CASCADE");
    table.uuid("receiver_id").notNullable().references("id").inTable("users").onDelete("CASCADE");
    table.uuid("property_id").notNullable().references("id").inTable("properties").onDelete("CASCADE");
    table.text("message").notNullable();
    table.boolean("is_read").defaultTo(false);
    table.timestamp("created_at").defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
    const tableExists = await knex.schema.hasTable("messages");
  if (tableExists) {
  return knex.schema.dropTable(DB_TABLES.MESSAGES);
}
}