import { describe, expect, it } from "vitest";
import { getSupabasePublicConfig, hasSupabasePublicConfig } from "./supabase";

describe("Supabase public configuration", () => {
  it("accepts complete publishable browser configuration", () => {
    const environment = {
      VITE_SUPABASE_URL: "https://cvqualjefkorrwiqsxkv.supabase.co",
      VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_example",
    };

    expect(hasSupabasePublicConfig(environment)).toBe(true);
    expect(getSupabasePublicConfig(environment).VITE_SUPABASE_URL).toBe("https://cvqualjefkorrwiqsxkv.supabase.co");
  });

  it("does not initialise a browser connection with incomplete configuration", () => {
    expect(hasSupabasePublicConfig({ VITE_SUPABASE_URL: "https://cvqualjefkorrwiqsxkv.supabase.co" })).toBe(false);
  });
});
