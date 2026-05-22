import { PrismaClient } from "@prisma/client";

import fs from "fs";
import path from "path";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

let databaseUrl = process.env.DATABASE_URL;

if (process.env.NODE_ENV === "production") {
  const dbFile = "dev.db";
  const sourcePath = path.join(process.cwd(), "prisma", dbFile);
  const targetPath = path.join("/tmp", dbFile);

  try {
    if (!fs.existsSync(targetPath)) {
      console.log(`Copying database from ${sourcePath} to ${targetPath}...`);
      fs.copyFileSync(sourcePath, targetPath);
      fs.chmodSync(targetPath, 0o666);
    }
    databaseUrl = `file:${targetPath}`;
  } catch (e) {
    console.error("Failed to copy database to /tmp, falling back to source path", e);
    databaseUrl = databaseUrl || `file:${sourcePath}`;
  }
} else {
  databaseUrl = databaseUrl || "file:./dev.db";
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
