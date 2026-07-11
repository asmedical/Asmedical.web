import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { autorise } from "@/lib/ratelimit";
import { whatsappConfigure } from "@/lib/sms/whatsapp";

export const dynamic = "force-dynamic";

// GET → WhatsApp est-il proposé comme canal de réception du code ?
export async function GET() {
  return NextResponse.json({ whatsapp: whatsappConfigure() });
}

// POST { phone, canal } — mémorise le canal choisi (sms | whatsapp) juste
// avant la demande de code. Aucune donnée sensible : téléphone + canal.
export async function POST(req) {
  try {
    const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "inconnu";
    if (!autorise(`otpcanal:${ip}`, 10, 60000)) {
      return NextResponse.json({ erreur: "Trop de tentatives." }, { status: 429 });
    }
    const { phone, canal } = await req.json();
    const p = String(phone || "").trim();
    if (!/^\+\d{9,15}$/.test(p)) return NextResponse.json({ erreur: "téléphone invalide" }, { status: 400 });
    const c = canal === "whatsapp" && whatsappConfigure() ? "whatsapp" : "sms";
    await prisma.otpCanal.upsert({
      where: { telephone: p },
      update: { canal: c },
      create: { telephone: p, canal: c },
    });
    return NextResponse.json({ ok: true, canal: c });
  } catch {
    return NextResponse.json({ erreur: "Erreur serveur" }, { status: 500 });
  }
}
