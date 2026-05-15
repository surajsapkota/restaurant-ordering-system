import "dotenv/config";
import { PrismaClient, UserRole } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashSecret } from "../src/utils/auth";
import { seedMenu } from "./menuSeed";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is missing. Make sure apps/api/.env has DATABASE_URL="
  );
}

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

const dollarsToCents = (d: number) => Math.round(d * 100);

async function main() {
  console.log("🌱 Seeding...");

  const adminPasswordHash = await hashSecret("Admin@12345");
  const adminPinHash = await hashSecret("1234");
  const managerPinHash = await hashSecret("1234");
  const employeePinHash = await hashSecret("1234");

  // Reset only transactional tables
  await prisma.orderItemModifier.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.voidLog.deleteMany();
  await prisma.order.deleteMany();

  // Admin
  await prisma.user.upsert({
    where: { email: "admin@bombaytomumbai.ca" },
    update: {
      name: "Admin",
      employeeCode: "9001",
      role: UserRole.ADMIN,
      passwordHash: adminPasswordHash,
      pinHash: adminPinHash,
      isActive: true,
    },
    create: {
      name: "Admin",
      email: "admin@bombaytomumbai.ca",
      employeeCode: "9001",
      role: UserRole.ADMIN,
      passwordHash: adminPasswordHash,
      pinHash: adminPinHash,
      isActive: true,
    },
  });

  // Manager
  await prisma.user.upsert({
    where: { email: "manager@bombaytomumbai.ca" },
    update: {
      name: "Test Manager",
      employeeCode: "1001",
      role: UserRole.MANAGER,
      pinHash: managerPinHash,
      isActive: true,
    },
    create: {
      name: "Test Manager",
      email: "manager@bombaytomumbai.ca",
      employeeCode: "1001",
      role: UserRole.MANAGER,
      pinHash: managerPinHash,
      isActive: true,
    },
  });

  // Employee
  const employee = await prisma.user.upsert({
    where: { email: "employee@demo.com" },
    update: {
      name: "Demo Employee",
      employeeCode: "2001",
      role: UserRole.EMPLOYEE,
      pinHash: employeePinHash,
      isActive: true,
    },
    create: {
      name: "Demo Employee",
      email: "employee@demo.com",
      employeeCode: "2001",
      role: UserRole.EMPLOYEE,
      pinHash: employeePinHash,
      isActive: true,
    },
  });

  console.log("✅ Seed users ready");
  console.log("Admin:    code 9001 | PIN 1234");
  console.log("Manager:  code 1001 | PIN 1234");
  console.log("Employee: code 2001 | PIN 1234");

  await seedMenu(prisma, dollarsToCents);

  console.log("Employee:", employee.email);
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
