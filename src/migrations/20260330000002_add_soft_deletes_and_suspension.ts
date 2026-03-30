import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  const [usersSuspended, propsDeleted, paymentsDeleted] = await Promise.all([
    knex.schema.hasColumn("users", "suspended_at"),
    knex.schema.hasColumn("properties", "deleted_at"),
    knex.schema.hasColumn("payments", "deleted_at"),
  ]);

  if (!usersSuspended) {
    await knex.schema.alterTable("users", (table) => {
      table.timestamp("suspended_at").nullable();
    });
  }

  if (!propsDeleted) {
    await knex.schema.alterTable("properties", (table) => {
      table.timestamp("deleted_at").nullable();
    });
  }

  if (!paymentsDeleted) {
    await knex.schema.alterTable("payments", (table) => {
      table.timestamp("deleted_at").nullable();
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("users", (table) => {
    table.dropColumn("suspended_at");
  });

  await knex.schema.alterTable("properties", (table) => {
    table.dropColumn("deleted_at");
  });

  await knex.schema.alterTable("payments", (table) => {
    table.dropColumn("deleted_at");
  });
}
