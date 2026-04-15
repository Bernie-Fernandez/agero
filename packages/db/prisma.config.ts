import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  // DIRECT_URL (port 5432, no pgbouncer) required for schema operations.
  // DATABASE_URL (port 6543, pgbouncer=true) used at runtime.
  datasource: {
    url: process.env["DIRECT_URL"] ?? process.env["DATABASE_URL"],
  },
});
