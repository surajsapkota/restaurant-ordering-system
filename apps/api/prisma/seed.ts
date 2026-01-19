import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashSecret } from "../src/utils/auth";


if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is missing. Make sure apps/api/.env has DATABASE_URL="
  );
}

// direct DB connection string
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

const dollarsToCents = (d: number) => Math.round(d * 100);

async function main() {

  // ✅ Create first admin user (so we can login)
const adminPasswordHash = await hashSecret("Admin@12345");
const adminPinHash = await hashSecret("1234");

await prisma.user.upsert({
  where: { email: "admin@bombaytomumbai.ca" },
  update: {},
  create: {
    name: "Admin",
    email: "admin@bombaytomumbai.ca",
    role: "ADMIN",
    passwordHash: adminPasswordHash,
    pinHash: adminPinHash,
    isActive: true,
  },
});

  console.log("🌱 Seeding...");

  // ✅ Reset only transactional tables (orders)
  // (Menu stays stable so you can seed many times without losing menu IDs)
  await prisma.orderItemModifier.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.voidLog.deleteMany();
  await prisma.order.deleteMany();

  // ✅ Demo employee user (needed for createdById later)
  const employee = await prisma.user.upsert({
    where: { email: "employee@demo.com" },
    update: {
      name: "Demo Employee",
      role: "EMPLOYEE",
    },
    create: {
      name: "Demo Employee",
      email: "employee@demo.com",
      role: "EMPLOYEE",
    },
  });

  // ✅ Categories (upsert by slug)
  const featured = await prisma.menuCategory.upsert({
    where: { slug: "featured" },
    update: { name: "Featured", sortOrder: 0, isActive: true },
    create: { name: "Featured", slug: "featured", sortOrder: 0, isActive: true },
  });

  const hotApp = await prisma.menuCategory.upsert({
    where: { slug: "hot-appetizers" },
    update: { name: "Hot Appetizers", sortOrder: 1, isActive: true },
    create: {
      name: "Hot Appetizers",
      slug: "hot-appetizers",
      sortOrder: 1,
      isActive: true,
    },
  });

  const tandoori = await prisma.menuCategory.upsert({
    where: { slug: "tandoori-clay-oven" },
    update: { name: "Tandoori (Clay Oven)", sortOrder: 2, isActive: true },
    create: {
      name: "Tandoori (Clay Oven)",
      slug: "tandoori-clay-oven",
      sortOrder: 2,
      isActive: true,
    },
  });

  const curriesNonVeg = await prisma.menuCategory.upsert({
    where: { slug: "curries-non-veg" },
    update: { name: "Curries (Non-Veg)", sortOrder: 3, isActive: true },
    create: {
      name: "Curries (Non-Veg)",
      slug: "curries-non-veg",
      sortOrder: 3,
      isActive: true,
    },
  });

  const curriesVeg = await prisma.menuCategory.upsert({
    where: { slug: "curries-veg" },
    update: { name: "Curries (Veg)", sortOrder: 4, isActive: true },
    create: {
      name: "Curries (Veg)",
      slug: "curries-veg",
      sortOrder: 4,
      isActive: true,
    },
  });

  const hakka = await prisma.menuCategory.upsert({
    where: { slug: "hakka" },
    update: { name: "Hakka", sortOrder: 5, isActive: true },
    create: { name: "Hakka", slug: "hakka", sortOrder: 5, isActive: true },
  });

  // ✅ Menu items (upsert by slug)
  // IMPORTANT: slug must be unique (you had duplicates like Butter Chicken in 2 categories)
  const items = [
    // --- Featured ---
    {
      slug: "non-vegetarian-thali",
      categoryId: featured.id,
      name: "Non-Vegetarian Thali",
      description:
        "Combo meal (Dal Makhani, Choose 1 protein (Chicken, Goat, Lamb), Rice, Naan, Raita, 1 Dessert).",
      priceCents: dollarsToCents(23.99),
      taxable: true,
      imageUrl:
        "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=900&q=60",
      imageAlt: "Thali",
    },
    {
      slug: "vegetarian-thali",
      categoryId: featured.id,
      name: "Vegetarian Thali",
      description:
        "Combo meal (Dal Makhani, Choose 1 Veggie (Chana masala or Aloo Gobi), Rice, Naan, Raita, 1 Dessert).",
      priceCents: dollarsToCents(21.99),
      taxable: true,
      imageUrl:
        "https://images.unsplash.com/photo-1542367592-8849eb950fd8?auto=format&fit=crop&w=900&q=60",
      imageAlt: "Veg thali",
    },
    {
      slug: "daal-makhani",
      categoryId: featured.id,
      name: "Daal Makhani",
      description: "Lentils",
      priceCents: dollarsToCents(15.99),
      taxable: true,
      imageUrl:
        "https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&w=900&q=60",
      imageAlt: "Daal makhani",
    },
    {
      slug: "butter-chicken-featured",
      categoryId: featured.id,
      name: "Butter Chicken",
      description: "Boneless tandoori chicken in butter, tomato, cream sauce.",
      priceCents: dollarsToCents(18.99),
      taxable: true,
      imageUrl:
        "https://images.unsplash.com/photo-1604908177522-040a2f98ce7e?auto=format&fit=crop&w=900&q=60",
      imageAlt: "Butter chicken",
    },
    {
      slug: "chilli-chicken-featured",
      categoryId: featured.id,
      name: "Chilli Chicken",
      description: "Hakka-style chilli chicken",
      priceCents: dollarsToCents(16.99),
      taxable: true,
      imageUrl:
        "https://images.unsplash.com/photo-1625944525533-473f1a3b2f52?auto=format&fit=crop&w=900&q=60",
      imageAlt: "Chilli chicken",
    },
    {
      slug: "vegetable-noodles-featured",
      categoryId: featured.id,
      name: "Vegetable Noodles",
      description: "Hakka noodles",
      priceCents: dollarsToCents(15.99),
      taxable: true,
      imageUrl:
        "https://images.unsplash.com/photo-1604909053233-48c2b0bd3d2b?auto=format&fit=crop&w=900&q=60",
      imageAlt: "Veg noodles",
    },
    {
      slug: "paneer-makhani",
      categoryId: featured.id,
      name: "Paneer Makhani",
      description: "Paneer curry",
      priceCents: dollarsToCents(17.99),
      taxable: true,
      imageUrl:
        "https://images.unsplash.com/photo-1604909053281-9e4f3c31c52a?auto=format&fit=crop&w=900&q=60",
      imageAlt: "Paneer makhani",
    },
    {
      slug: "tandoori-mixed-grill-featured",
      categoryId: featured.id,
      name: "Tandoori Mixed Grill",
      description:
        "4 pcs of each chicken tikka, reshmi tikka, sheekh kebab & fish tikka.",
      priceCents: dollarsToCents(30.99),
      taxable: true,
      imageUrl:
        "https://images.unsplash.com/photo-1604909053193-fb3a41c1b086?auto=format&fit=crop&w=900&q=60",
      imageAlt: "Mixed grill",
    },
    {
      slug: "chicken-momo",
      categoryId: featured.id,
      name: "Chicken Momo",
      description: "Momos",
      priceCents: dollarsToCents(14.99),
      taxable: true,
      imageUrl:
        "https://images.unsplash.com/photo-1625944109275-7d7f66c24e6c?auto=format&fit=crop&w=900&q=60",
      imageAlt: "Chicken momo",
    },

    // --- Hot Appetizers ---
    {
      slug: "vegetable-samosa-2pcs",
      categoryId: hotApp.id,
      name: "Vegetable Samosa (2 Pcs)",
      description: "Patties stuffed with vegetables.",
      priceCents: dollarsToCents(6.99),
      taxable: true,
      imageUrl:
        "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=900&q=60",
      imageAlt: "Vegetable samosa",
    },
    {
      slug: "vegetable-pakora-or-onion-bhaji-4pcs",
      categoryId: hotApp.id,
      name: "Vegetable Pakora or Onion Bhaji (4 Pcs)",
      description: "Fried mixed vegetables fritters.",
      priceCents: dollarsToCents(6.99),
      taxable: true,
      imageUrl:
        "https://images.unsplash.com/photo-1625944511859-5f4a69c0f2b0?auto=format&fit=crop&w=900&q=60",
      imageAlt: "Pakora",
    },
    {
      slug: "mixed-appetizer",
      categoryId: hotApp.id,
      name: "Mixed Appetizer",
      description: "Assorted veg appetizer platter.",
      priceCents: dollarsToCents(14.99),
      taxable: true,
      imageUrl:
        "https://images.unsplash.com/photo-1601050690185-5a4132b0f4f1?auto=format&fit=crop&w=900&q=60",
      imageAlt: "Mixed appetizer",
    },
    {
      slug: "aloo-tikki",
      categoryId: hotApp.id,
      name: "Aloo Tikki",
      description: "Mashed potatoes with tangy spices.",
      priceCents: dollarsToCents(6.99),
      taxable: true,
      imageUrl:
        "https://images.unsplash.com/photo-1606491956689-2ea866880c84?auto=format&fit=crop&w=900&q=60",
      imageAlt: "Aloo tikki",
    },
    {
      slug: "aloo-tikki-chaat",
      categoryId: hotApp.id,
      name: "Aloo Tikki Chat",
      description: "Aloo tikki with chickpeas gravy + chutneys.",
      priceCents: dollarsToCents(9.99),
      taxable: true,
      imageUrl:
        "https://images.unsplash.com/photo-1598514983318-2f64f8f4796c?auto=format&fit=crop&w=900&q=60",
      imageAlt: "Aloo tikki chaat",
    },
    {
      slug: "fish-pakora-6pcs",
      categoryId: hotApp.id,
      name: "Fish Pakora (6 Pcs)",
      description: "Fried fish fritters.",
      priceCents: dollarsToCents(12.99),
      taxable: true,
      imageUrl:
        "https://images.unsplash.com/photo-1604909053220-1b1a4f1c6e1c?auto=format&fit=crop&w=900&q=60",
      imageAlt: "Fish pakora",
    },

    // --- Tandoori ---
    {
      slug: "tandoori-chicken-with-bones",
      categoryId: tandoori.id,
      name: "Tandoori Chicken (with Bones)",
      description: "Chicken leg marinated in yogurt and grilled in tandoori.",
      priceCents: dollarsToCents(14.99),
      taxable: true,
      imageUrl:
        "https://images.unsplash.com/photo-1604909053193-fb3a41c1b086?auto=format&fit=crop&w=900&q=60",
      imageAlt: "Tandoori chicken",
    },
    {
      slug: "chicken-tikka-boneless-white-meat",
      categoryId: tandoori.id,
      name: "Chicken Tikka (Boneless White Meat)",
      description: "Cubes of chicken marinated in yogurt + spices.",
      priceCents: dollarsToCents(17.99),
      taxable: true,
      imageUrl:
        "https://images.unsplash.com/photo-1625944525533-473f1a3b2f52?auto=format&fit=crop&w=900&q=60",
      imageAlt: "Chicken tikka",
    },
    {
      slug: "fish-tikka",
      categoryId: tandoori.id,
      name: "Fish Tikka",
      description: "Marinated and grilled with tandoori spices.",
      priceCents: dollarsToCents(19.99),
      taxable: true,
      imageUrl:
        "https://images.unsplash.com/photo-1604909053199-2d5d8c4b8d0c?auto=format&fit=crop&w=900&q=60",
      imageAlt: "Fish tikka",
    },
    {
      slug: "achari-tikka-boneless-white-meat",
      categoryId: tandoori.id,
      name: "Achari Tikka (Boneless White Meat)",
      description: "Chicken marinated in pickling flavour.",
      priceCents: dollarsToCents(17.99),
      taxable: true,
      imageUrl:
        "https://images.unsplash.com/photo-1625944525533-473f1a3b2f52?auto=format&fit=crop&w=900&q=60",
      imageAlt: "Achari tikka",
    },
    {
      slug: "reshmi-tikka-boneless-white-meat",
      categoryId: tandoori.id,
      name: "Reshmi Tikka (Boneless White Meat)",
      description: "Chicken marinated in cream and white pepper.",
      priceCents: dollarsToCents(17.99),
      taxable: true,
      imageUrl:
        "https://images.unsplash.com/photo-1625944525533-473f1a3b2f52?auto=format&fit=crop&w=900&q=60",
      imageAlt: "Reshmi tikka",
    },
    {
      slug: "paneer-tikka-shashlik",
      categoryId: tandoori.id,
      name: "Paneer Tikka / Shashlik",
      description: "Homemade cheese marinated in spices.",
      priceCents: dollarsToCents(16.99),
      taxable: true,
      imageUrl:
        "https://images.unsplash.com/photo-1604909053281-9e4f3c31c52a?auto=format&fit=crop&w=900&q=60",
      imageAlt: "Paneer tikka",
    },
    {
      slug: "chicken-sheekh-kabab",
      categoryId: tandoori.id,
      name: "Chicken Sheekh Kabab",
      description: "Ground chicken seasoned and roasted on skewers.",
      priceCents: dollarsToCents(16.99),
      taxable: true,
      imageUrl:
        "https://images.unsplash.com/photo-1604909053193-fb3a41c1b086?auto=format&fit=crop&w=900&q=60",
      imageAlt: "Sheekh kabab",
    },
    {
      slug: "tandoori-mixed-grill",
      categoryId: tandoori.id,
      name: "Tandoori Mixed Grill",
      description: "Chicken tikka, reshmi tikka, sheekh kebab & fish tikka.",
      priceCents: dollarsToCents(30.99),
      taxable: true,
      imageUrl:
        "https://images.unsplash.com/photo-1604909053193-fb3a41c1b086?auto=format&fit=crop&w=900&q=60",
      imageAlt: "Mixed grill",
    },

    // --- Curries (Non-Veg) ---
    {
      slug: "butter-chicken",
      categoryId: curriesNonVeg.id,
      name: "Butter Chicken",
      description: "Boneless tandoori chicken in butter, tomato, cream sauce.",
      priceCents: dollarsToCents(18.99),
      taxable: true,
      imageUrl:
        "https://images.unsplash.com/photo-1604908177522-040a2f98ce7e?auto=format&fit=crop&w=900&q=60",
      imageAlt: "Butter chicken",
    },
    {
      slug: "chicken-tikka-masala-white-meat",
      categoryId: curriesNonVeg.id,
      name: "Chicken Tikka Masala (White Meat)",
      description: "Chicken tikka cooked in thick sauce with onions & peppers.",
      priceCents: dollarsToCents(19.99),
      taxable: true,
      imageUrl:
        "https://images.unsplash.com/photo-1604908177522-040a2f98ce7e?auto=format&fit=crop&w=900&q=60",
      imageAlt: "Chicken tikka masala",
    },
    {
      slug: "karahi-chicken-goat-with-bone",
      categoryId: curriesNonVeg.id,
      name: "Karahi Chicken / Goat (with Bone)",
      description:
        "Cooked with peppers, coriander & spices with ginger flavour.",
      priceCents: dollarsToCents(19.99),
      taxable: true,
      imageUrl:
        "https://images.unsplash.com/photo-1604908177522-040a2f98ce7e?auto=format&fit=crop&w=900&q=60",
      imageAlt: "Karahi",
    },
    {
      slug: "saag-chicken-goat-with-bone",
      categoryId: curriesNonVeg.id,
      name: "Saag Chicken / Goat (with Bone)",
      description: "Cooked in curried spinach.",
      priceCents: dollarsToCents(19.99),
      taxable: true,
      imageUrl:
        "https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&w=900&q=60",
      imageAlt: "Saag curry",
    },
    {
      slug: "korma-chicken-goat-with-bone",
      categoryId: curriesNonVeg.id,
      name: "Korma Chicken / Goat (with Bone)",
      description: "Thick cream sauce with cashew nuts.",
      priceCents: dollarsToCents(19.99),
      taxable: true,
      imageUrl:
        "https://images.unsplash.com/photo-1604908177522-040a2f98ce7e?auto=format&fit=crop&w=900&q=60",
      imageAlt: "Korma curry",
    },
    {
      slug: "vindaloo-chicken-goat-with-bone",
      categoryId: curriesNonVeg.id,
      name: "Vindaloo Chicken / Goat (with Bone)",
      description: "Hot tangy sauce with potatoes & vinegar.",
      priceCents: dollarsToCents(19.99),
      taxable: true,
      imageUrl:
        "https://images.unsplash.com/photo-1604908177522-040a2f98ce7e?auto=format&fit=crop&w=900&q=60",
      imageAlt: "Vindaloo curry",
    },

    // --- Hakka ---
    {
      slug: "vegetable-noodles-hakka",
      categoryId: hakka.id,
      name: "Vegetable Noodles",
      description: "Hakka noodles (as listed on Uber Eats).",
      priceCents: dollarsToCents(15.99),
      taxable: true,
      imageUrl:
        "https://images.unsplash.com/photo-1604909053233-48c2b0bd3d2b?auto=format&fit=crop&w=900&q=60",
      imageAlt: "Hakka noodles",
    },
    {
      slug: "chilli-chicken-hakka",
      categoryId: hakka.id,
      name: "Chilli Chicken",
      description: "Hakka-style chilli chicken (as listed on Uber Eats).",
      priceCents: dollarsToCents(16.99),
      taxable: true,
      imageUrl:
        "https://images.unsplash.com/photo-1625944525533-473f1a3b2f52?auto=format&fit=crop&w=900&q=60",
      imageAlt: "Chilli chicken",
    },
  ] as const;

  for (const item of items) {
    await prisma.menuItem.upsert({
      where: { slug: item.slug },
      update: {
        categoryId: item.categoryId,
        name: item.name,
        slug: item.slug,
        description: item.description,
        priceCents: item.priceCents,
        taxable: item.taxable,
        isActive: true,
        imageUrl: item.imageUrl,
        imageAlt: item.imageAlt,
      },
      create: {
        categoryId: item.categoryId,
        name: item.name,
        slug: item.slug,
        description: item.description,
        priceCents: item.priceCents,
        taxable: item.taxable,
        isActive: true,
        imageUrl: item.imageUrl,
        imageAlt: item.imageAlt,
      },
    });
  }

  console.log("✅ Seed completed");
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
