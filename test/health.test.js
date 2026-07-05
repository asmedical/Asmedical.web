import { describe, it, expect } from "vitest";
import { agregerStatut } from "@/lib/health";

describe("agrégation du statut de santé", () => {
  it("OK quand tout va bien", () => {
    expect(agregerStatut({
      env: { ok: true, critique: true },
      base: { ok: true, critique: true },
      supabase: { ok: true, critique: false },
    })).toBe("OK");
  });

  it("ERROR si un contrôle critique échoue (ex. base de données)", () => {
    expect(agregerStatut({
      env: { ok: true, critique: true },
      base: { ok: false, critique: true },
      supabase: { ok: true, critique: false },
    })).toBe("ERROR");
  });

  it("WARNING si seul un contrôle non critique échoue (ex. Supabase)", () => {
    expect(agregerStatut({
      env: { ok: true, critique: true },
      base: { ok: true, critique: true },
      supabase: { ok: false, critique: false },
    })).toBe("WARNING");
  });

  it("ERROR prioritaire sur WARNING", () => {
    expect(agregerStatut({
      base: { ok: false, critique: true },
      supabase: { ok: false, critique: false },
    })).toBe("ERROR");
  });
});
