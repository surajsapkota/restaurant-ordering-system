import request from "supertest";
import app from "../app";
import prisma from "../db/prisma";

describe("POS Full Flow (Auth -> Shift -> Order -> Payment -> Close Shift)", () => {
  let token = "";
  let shiftId = "";
  let orderId = "";
  let menuItemId = "";

  beforeAll(async () => {
    // 1) Grab any active menu item from DB to use in tests
    const item = await prisma.menuItem.findFirst({ where: { isActive: true } });
    if (!item) throw new Error("No active menu items found. Seed the database first.");
    menuItemId = item.id;
  });

  afterAll(async () => {
    // Close prisma connection so Jest exits cleanly
    await prisma.$disconnect();
  });

  it("1) Login with PIN and receive token", async () => {
    const res = await request(app)
      .post("/auth/pin")
      .send({ pin: "1234" }); // change if your demo PIN is different

    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    token = res.body.token;
  });

  it("2) Protected route should fail without token", async () => {
    const res = await request(app).get("/orders");
    expect(res.status).toBe(401);
  });

  it("3) Open shift", async () => {
    const res = await request(app)
      .post("/shifts/open")
      .set("Authorization", `Bearer ${token}`)
      .send({
        terminalCode: "TABLET-1",
        openingCashCents: 20000,
      });

    expect(res.status).toBe(200);
    expect(res.body.shift?.status).toBe("OPEN");
    shiftId = res.body.shift.id;
  });

  it("4) Create order (must be linked to OPEN shift + terminalCode)", async () => {
    const res = await request(app)
      .post("/orders")
      .set("Authorization", `Bearer ${token}`)
      .send({
        terminalCode: "TABLET-1",
        shiftId,
        type: "DINE_IN",
        tableNumber: "5",
        tipDollars: 2,
        items: [{ menuItemId, qty: 1 }],
      });

    expect(res.status).toBe(201);
    expect(res.body.order?.id).toBeTruthy();
    orderId = res.body.order.id;
  });

  it("5) Mark order as paid", async () => {
    const res = await request(app)
      .patch(`/orders/${orderId}/payment`)
      .set("Authorization", `Bearer ${token}`)
      .send({ method: "CASH" });

    expect(res.status).toBe(200);
    expect(res.body.order?.paymentStatus).toBe("PAID");
  });

  it("6) Close shift (should return totals + orderCount)", async () => {
    const res = await request(app)
      .post("/shifts/close")
      .set("Authorization", `Bearer ${token}`)
      .send({
        shiftId,
        closingCashCents: 250000,
      });

    expect(res.status).toBe(200);
    expect(res.body.shift?.status).toBe("CLOSED");
    expect(res.body.shift?.orderCount).toBeGreaterThanOrEqual(1);
  });
});
