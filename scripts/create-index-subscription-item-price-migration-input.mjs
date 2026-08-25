import { readFile, writeFile } from "node:fs/promises";

const query = await readFile("supabase/migrations/202608250005_index_subscription_item_price.sql", "utf8");
await writeFile("/tmp/solumpm-index-subscription-item-price-migration.json", JSON.stringify({
  project_id: "cvqualjefkorrwiqsxkv",
  name: "index_subscription_item_price",
  query,
}));
