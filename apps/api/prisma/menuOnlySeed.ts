import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { seedMenu } from "./menuSeed";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is missing. Check apps/api/.env");
}

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

function dollarsToCents(dollars: number) {
  return Math.round(dollars * 100);
}

async function main() {
  console.log("🌱 Seeding menu only...");
  await seedMenu(prisma, dollarsToCents);
  console.log("✅ Menu seed completed.");
}

main()
  .catch((error) => {
    console.error("❌ Menu seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });