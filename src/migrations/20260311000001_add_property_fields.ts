import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("properties", (table) => {
    table.string("type").nullable();          // Apartment, House, Studio, etc.
    table.integer("rooms").nullable();        // number of bedrooms/rooms
    table.text("amenities").nullable();       // JSON array of amenity strings
    table.boolean("verified").defaultTo(false).notNullable();
    table.string("slug").nullable();          // URL-friendly slug
    table.integer("views").defaultTo(0).notNullable();
    table.boolean("is_available").defaultTo(true).notNullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("properties", (table) => {
    table.dropColumn("type");
    table.dropColumn("rooms");
    table.dropColumn("amenities");
    table.dropColumn("verified");
    table.dropColumn("slug");
    table.dropColumn("views");
    table.dropColumn("is_available");
  });
}
