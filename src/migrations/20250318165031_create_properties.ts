import { Knex } from "knex";
import { DB_TABLES } from "../shared/enums/db-tables.enum";

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable(DB_TABLES.PROPERTIES, (table: Knex.TableBuilder) => {
    table.uuid("id").primary().defaultTo(knex.fn.uuid());
    table.uuid("owner_id").references("id").inTable("users").onDelete("CASCADE").index();
    table.string("title").notNullable();
    table.text("description").notNullable();
    table.decimal("price", 10, 2).notNullable();
    table.string("location").notNullable();
    table.specificType("images", "TEXT[]");
    table.specificType("videos", "TEXT[]");
    table.timestamps(true, true);
  });
}

export async function down(knex: Knex): Promise<void> {
    const tableExists = await knex.schema.hasTable("properties");
  if (tableExists) {
  return knex.schema.dropTable(DB_TABLES.PROPERTIES);
}
}
