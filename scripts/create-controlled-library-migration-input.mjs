import { readFile, writeFile } from "node:fs/promises";

const query = await readFile("supabase/migrations/202608260002_controlled_library.sql", "utf8");
await writeFile("/tmp/solumpm-controlled-library-migration.json", JSON.stringify({
  project_id: "cvqualjefkorrwiqsxkv",
  name: "controlled_library",
  query,
}));
