import { readFile, writeFile } from "node:fs/promises";

const content = await readFile("supabase/functions/organization-setup/index.ts", "utf8");
await writeFile(
  "/tmp/solumpm-organization-setup-deploy.json",
  JSON.stringify({
    project_id: "cvqualjefkorrwiqsxkv",
    name: "organization-setup",
    verify_jwt: true,
    entrypoint_path: "index.ts",
    files: [{ name: "index.ts", content }],
  }),
);
