import { Knex } from "knex";
import { DB_TABLES } from "../shared/enums/db-tables.enum";

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable(DB_TABLES.REVIEWS, (table: Knex.TableBuilder) => {
    table.uuid("id").primary();
    table.uuid("user_id").unsigned().references("users.id").onDelete("CASCADE");
    table.uuid("property_id").unsigned().references("properties.id").onDelete("CASCADE");
    table.integer("rating").notNullable().checkBetween([1, 5]); // Ensure rating is between 1-5
    table.text("comment").notNullable();
    table.timestamps(true, true);
    table.unique(["user_id", "property_id"]); // Prevent duplicate reviews per user
  });
}

export async function down(knex: Knex): Promise<void> {
    const tableExists = await knex.schema.hasTable("reviews");
  if (tableExists) {
  return knex.schema.dropTable(DB_TABLES.REVIEWS);
}
}