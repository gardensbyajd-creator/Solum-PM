import { readFile, writeFile } from "node:fs/promises";

const content = await readFile("supabase/functions/operational-work-items/index.ts", "utf8");
await writeFile("/tmp/solumpm-operational-work-items-deploy.json", JSON.stringify({
  project_id: "cvqualjefkorrwiqsxkv",
  name: "operational-work-items",
  verify_jwt: true,
  entrypoint_path: "index.ts",
  files: [{ name: "index.ts", content }],
}));
