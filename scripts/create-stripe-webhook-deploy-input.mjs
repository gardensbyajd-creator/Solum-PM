import { readFile, writeFile } from "node:fs/promises";

const content = await readFile("supabase/functions/stripe-webhook/index.ts", "utf8");
await writeFile(
  "/tmp/solumpm-stripe-webhook-deploy.json",
  JSON.stringify({
    project_id: "cvqualjefkorrwiqsxkv",
    name: "stripe-webhook",
    verify_jwt: false,
    entrypoint_path: "index.ts",
    files: [{ name: "index.ts", content }],
  }),
);
