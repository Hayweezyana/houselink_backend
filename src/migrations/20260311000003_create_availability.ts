import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("property_availability", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.uuid("property_id").references("id").inTable("properties").onDelete("CASCADE").notNullable();
    table.date("available_from").notNullable();
    table.date("available_to").notNullable();
    table.boolean("is_blocked").defaultTo(false).notNullable(); // blocked = booked
    table.timestamp("created_at").defaultTo(knex.fn.now()).notNullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("property_availability");
}
