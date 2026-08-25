import { readFile, writeFile } from "node:fs/promises";

const query = await readFile("supabase/migrations/202608250004_restrict_entitlement_functions.sql", "utf8");
await writeFile("/tmp/solumpm-restrict-entitlement-functions-migration.json", JSON.stringify({
  project_id: "cvqualjefkorrwiqsxkv",
  name: "restrict_entitlement_functions",
  query,
}));
