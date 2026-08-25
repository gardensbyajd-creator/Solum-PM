import { readFile, writeFile } from "node:fs/promises";

const query = await readFile("supabase/migrations/202608250002_organization_onboarding.sql", "utf8");
await writeFile(
  "/tmp/solumpm-organization-onboarding-migration.json",
  JSON.stringify({
    project_id: "cvqualjefkorrwiqsxkv",
    name: "organization_onboarding",
    query,
  }),
);
