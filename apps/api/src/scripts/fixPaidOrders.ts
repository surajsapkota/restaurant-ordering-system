import prisma from "../db/prisma";

async function main() {
  const result = await prisma.order.updateMany({
    where: {
      paymentStatus: "PAID",
      status: { in: ["NEW", "IN_KITCHEN", "READY"] },
    },
    data: {
      status: "CLOSED",
      closedAt: new Date(),
    },
  });

  console.log("Fixed PAID orders:", result.count);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
