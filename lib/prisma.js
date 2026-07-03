import { PrismaClient } from "@prisma/client";

// Singleton Prisma (évite d'ouvrir trop de connexions en développement)
const globalForPrisma = globalThis;
export const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
