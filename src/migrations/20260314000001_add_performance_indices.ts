import { Knex } from "knex";

// CONCURRENTLY cannot run inside a transaction — disable the wrapper
export const config = { transaction: false };

const INDICES: Array<{ name: string; table: string; columns: string }> = [
  { name: "idx_properties_owner_id",    table: "properties",     columns: "owner_id" },
  { name: "idx_properties_type",        table: "properties",     columns: "type" },
  { name: "idx_properties_price",       table: "properties",     columns: "price" },
  { name: "idx_properties_created_at",  table: "properties",     columns: "created_at DESC" },
  { name: "idx_properties_is_available",table: "properties",     columns: "is_available" },
  { name: "idx_messages_receiver_read", table: "messages",       columns: "receiver_id, is_read" },
  { name: "idx_messages_property_id",   table: "messages",       columns: "property_id" },
  { name: "idx_messages_sender_id",     table: "messages",       columns: "sender_id" },
  { name: "idx_reviews_property_id",    table: "reviews",        columns: "property_id" },
  { name: "idx_wishlists_user_id",      table: "wishlists",      columns: "user_id" },
  { name: "idx_wishlists_property_id",  table: "wishlists",      columns: "property_id" },
  { name: "idx_otp_codes_email_type",   table: "otp_codes",      columns: "email, type" },
  { name: "idx_refresh_tokens_token",   table: "refresh_tokens", columns: "token" },
  { name: "idx_refresh_tokens_user_id", table: "refresh_tokens", columns: "user_id" },
  { name: "idx_notifications_user_read",table: "notifications",  columns: "user_id, is_read" },
];

export async function up(knex: Knex): Promise<void> {
  for (const { name, table, columns } of INDICES) {
    // eslint-disable-next-line no-await-in-loop
    await knex.raw(`CREATE INDEX CONCURRENTLY IF NOT EXISTS ${name} ON ${table} (${columns})`);
  }
}

export async function down(knex: Knex): Promise<void> {
  for (const { name } of INDICES) {
    // eslint-disable-next-line no-await-in-loop
    await knex.raw(`DROP INDEX CONCURRENTLY IF EXISTS ${name}`);
  }
}
