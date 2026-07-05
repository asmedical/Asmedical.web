import { describe, it, expect } from "vitest";
import { masquerChaine, rediger } from "@/lib/log";

describe("masquage des données sensibles dans les logs", () => {
  it("masque un email", () => {
    expect(masquerChaine("contact karim.benali@gmail.com svp")).toContain("[email]");
    expect(masquerChaine("contact karim.benali@gmail.com svp")).not.toContain("gmail");
  });

  it("masque un numéro de téléphone", () => {
    const s = masquerChaine("appeler le 0550 12 34 56 vite");
    expect(s).toContain("[tel]");
    expect(s).not.toContain("0550");
  });

  it("masque un jeton JWT", () => {
    const jwt = "eyJhbGciOi.eyJzdWIiOiIx.SflKxwRJSMeKKF2QT4";
    expect(masquerChaine("token=" + jwt)).toContain("[token]");
  });

  it("masque les clés sensibles d'un objet", () => {
    const propre = rediger({
      service: "transport",
      telephone: "0550123456",
      nom: "Benali",
      email: "a@b.com",
      statut: "A_RAPPELER",
    });
    expect(propre.service).toBe("transport");
    expect(propre.statut).toBe("A_RAPPELER");
    expect(propre.telephone).toBe("[masqué]");
    expect(propre.nom).toBe("[masqué]");
    expect(propre.email).toBe("[masqué]");
  });

  it("masque en profondeur (objets imbriqués)", () => {
    const propre = rediger({ demande: { telephone: "0550123456", notes: "oxygène" } });
    expect(propre.demande.telephone).toBe("[masqué]");
    expect(propre.demande.notes).toBe("[masqué]");
  });
});
