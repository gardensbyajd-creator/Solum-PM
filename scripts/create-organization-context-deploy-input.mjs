import { readFile, writeFile } from "node:fs/promises";

const content = await readFile("supabase/functions/organization-context/index.ts", "utf8");
await writeFile("/tmp/solumpm-organization-context-deploy.json", JSON.stringify({
  project_id: "cvqualjefkorrwiqsxkv",
  name: "organization-context",
  verify_jwt: true,
  entrypoint_path: "index.ts",
  files: [{ name: "index.ts", content }],
}));
