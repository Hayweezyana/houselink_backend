import cron from "node-cron";
import db from "../config/db";
import logger from "../config/logger";

/**
 * Runs every day at midnight.
 * - Marks properties as unavailable when all availability slots have passed.
 * - Purges expired refresh tokens to keep the table lean.
 */
export function startCronJobs(): void {
  // ── Auto-expire listings ───────────────────────────────────────────────────
  // If a property has NO future availability block, mark it unavailable.
  cron.schedule("0 0 * * *", async () => {
    try {
      // Properties that have at least one availability row but no future one
      const expired = await db("properties")
        .whereExists(
          db("property_availability")
            .select("property_id")
            .whereRaw("property_availability.property_id = properties.id")
        )
        .whereNotExists(
          db("property_availability")
            .select("property_id")
            .whereRaw("property_availability.property_id = properties.id")
            .where("available_to", ">=", db.fn.now())
            .where("is_blocked", false)
        )
        .where("properties.is_available", true)
        .update({ is_available: false });

      if (expired > 0) {
        logger.info(`[cron] Auto-expired ${expired} listings`);
      }
    } catch (error) {
      logger.error("[cron] Auto-expire listings failed:", error);
    }
  });

  // ── Purge expired refresh tokens ──────────────────────────────────────────
  cron.schedule("0 2 * * *", async () => {
    try {
      const deleted = await db("refresh_tokens")
        .where("expires_at", "<", new Date())
        .delete();
      if (deleted > 0) {
        logger.info(`[cron] Purged ${deleted} expired refresh tokens`);
      }
    } catch (error) {
      logger.error("[cron] Refresh token purge failed:", error);
    }
  });

  logger.info("[cron] Scheduled jobs started");
}
