import { readFile, writeFile } from "node:fs/promises";

const query = await readFile("supabase/migrations/202608250001_stripe_entitlements.sql", "utf8");
await writeFile(
  "/tmp/solumpm-stripe-entitlements-migration.json",
  JSON.stringify({
    project_id: "cvqualjefkorrwiqsxkv",
    name: "stripe_entitlements",
    query,
  }),
);
