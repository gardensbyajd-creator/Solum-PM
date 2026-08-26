import { readFile, writeFile } from "node:fs/promises";

const content = await readFile("supabase/functions/organization-seat-invite/index.ts", "utf8");
await writeFile("/tmp/solumpm-organization-seat-invite-deploy.json", JSON.stringify({
  project_id: "cvqualjefkorrwiqsxkv",
  name: "organization-seat-invite",
  verify_jwt: true,
  entrypoint_path: "index.ts",
  files: [{ name: "index.ts", content }],
}));
