import { readFile, writeFile } from "node:fs/promises";

const query = await readFile("supabase/migrations/202608260001_operational_work_register.sql", "utf8");
await writeFile("/tmp/solumpm-operational-work-register-migration.json", JSON.stringify({
  project_id: "cvqualjefkorrwiqsxkv",
  name: "operational_work_register",
  query,
}));
