import process from "node:process";
import dotenv from "dotenv";
import { hash } from "bcryptjs";
import { PrismaClient, Modulo } from "@prisma/client";

dotenv.config({ path: ".env.local" });
dotenv.config();

function readArg(flag) {
  const index = process.argv.indexOf(flag);
  if (index === -1) return null;
  return process.argv[index + 1] ?? null;
}

const email = readArg("--email") ?? process.env.BOOTSTRAP_ADMIN_EMAIL;
const password = readArg("--password") ?? process.env.BOOTSTRAP_ADMIN_PASSWORD;
const nome = readArg("--nome") ?? process.env.BOOTSTRAP_ADMIN_NOME ?? "Administrador Local";

if (!email || !password) {
  console.error(
    'Uso: node scripts/bootstrap-local-admin.mjs --email admin@local --password controle1 --nome "Administrador"',
  );
  process.exit(1);
}

const prisma = new PrismaClient();

try {
  const normalizedEmail = email.toLowerCase().trim();
  const passwordHash = await hash(password, 12);

  const user = await prisma.user.upsert({
    where: { email: normalizedEmail },
    update: {
      passwordHash,
      profile: {
        upsert: {
          create: {
            nome: nome.trim(),
            perfil: "admin",
            ativo: true,
          },
          update: {
            nome: nome.trim(),
            perfil: "admin",
            ativo: true,
          },
        },
      },
    },
    create: {
      email: normalizedEmail,
      passwordHash,
      profile: {
        create: {
          nome: nome.trim(),
          perfil: "admin",
          ativo: true,
        },
      },
    },
    select: { id: true, email: true },
  });

  await prisma.usuarioPermissao.deleteMany({
    where: { userId: user.id },
  });

  await prisma.usuarioPermissao.createMany({
    data: Object.values(Modulo).map((modulo) => ({
      userId: user.id,
      modulo,
      ver: true,
      criar: true,
      editar: true,
      deletar: true,
    })),
  });

  console.log(`Admin local pronto: ${user.email}`);
} finally {
  await prisma.$disconnect();
}
