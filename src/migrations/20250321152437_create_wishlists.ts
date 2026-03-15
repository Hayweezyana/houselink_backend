import { Knex } from "knex";
import { DB_TABLES } from "../shared/enums/db-tables.enum";

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable(DB_TABLES.WISHLISTS, (table: Knex.TableBuilder) => {
    table.uuid("id").primary();
    table.uuid("user_id").unsigned().references("users.id").onDelete("CASCADE");
    table.uuid("property_id").unsigned().references("properties.id").onDelete("CASCADE");
    table.unique(["user_id", "property_id"]); // Prevent duplicates
  });
}

export async function down(knex: Knex): Promise<void> {
    const tableExists = await knex.schema.hasTable("wishlists");
  if (tableExists) {
  return knex.schema.dropTable(DB_TABLES.WISHLISTS);
}
}