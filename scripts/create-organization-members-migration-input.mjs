import { readFile, writeFile } from "node:fs/promises";

const query = await readFile("supabase/migrations/202608250003_organization_members.sql", "utf8");
await writeFile(
  "/tmp/solumpm-organization-members-migration.json",
  JSON.stringify({
    project_id: "cvqualjefkorrwiqsxkv",
    name: "organization_members",
    query,
  }),
);
