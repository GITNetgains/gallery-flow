import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  // ✅ Seed your global setting if not exists
  await db.setting.upsert({
    where: { id: "global-setting" },
    update: {},
    create: {
      id: "global-setting",
      addEventEnabled: true, // default value
    },
  });

  console.log("✅ Global setting seeded");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
