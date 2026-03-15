import { Knex } from "knex";

import { DB_TABLES } from "../shared/enums/db-tables.enum";

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable(DB_TABLES.USERS, (table: Knex.TableBuilder) => {
    table.uuid("id").primary().defaultTo(knex.fn.uuid());
    table.string("name").notNullable();
    table.string("email").unique().notNullable();
    table.string("password").notNullable();
    table.string("role").defaultTo("seeker"); // "seeker" or "owner"
    table.timestamps(true, true);
  });
}

export async function down(knex: Knex): Promise<void> {
    const tableExists = await knex.schema.hasTable("users");
  if (tableExists) {
  return knex.schema.dropTable(DB_TABLES.USERS);
}
}
