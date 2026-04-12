import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  await prisma.user.upsert({
    where: { email: "test@example.com" },
    update: {},
    create: {
      email: "test@example.com",
      password: "password123",
      role: "user",
    },
  })

  await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {},
    create: {
      email: "admin@example.com",
      password: "admin123",
      role: "admin",
    },
  })

  console.log("Seed complete: test@example.com / password123, admin@example.com / admin123")
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
