// prisma/seed.js
const bcrypt = require("bcrypt"); // Lo usamos para encriptar la clave oficial

const prisma = require("../src/config/db");

async function main() {
  console.log("🌱 Iniciando la siembra de datos (Database Seeding)...");

  // 1. Definimos las credenciales del Administrador del Ministerio
  const adminEmail = "admin@deportesjujuy.gov.ar";
  const adminPassword = "admin123"; // Asegurate de cambiarla en producción

  // 2. Hasheamos la clave de forma segura con 10 rondas de salting
  const saltRounds = 10;
  const hashedPassword = await bcrypt.hash(adminPassword, saltRounds);

  console.log(`🔐 Generando hash de seguridad para la cuenta maestro...`);

  // 3. Insertamos el usuario usando upsert para evitar duplicados si volvés a correr el comando
  const usuarioAdmin = await prisma.usuario.upsert({
    where: { email: adminEmail },
    update: {}, // Si ya existe, no le hace nada
    create: {
      email: adminEmail,
      passwordHash: hashedPassword,
      username: "admin",
      rol: "ADMIN", // El enum riguroso de tu schema
      dni: "99000123", // Un DNI de prueba institucional
      nombre: "Auditor",
      apellido: "Ministerial",
      municipioAsignado: "SAN SALVADOR DE JUJUY",
    },
  });

  console.log(
    `\n◈===========================================================◈`,
  );
  console.log(`✅ ¡Usuario ADMINISTRADOR matriculado con éxito!`);
  console.log(`📧 Email: ${usuarioAdmin.email}`);
  console.log(`🔑 Password: ${adminPassword}`);
  console.log(`👑 Rol asignado: ${usuarioAdmin.rol}`);
  console.log(
    `◈===========================================================◈\n`,
  );
}

main()
  .catch((e) => {
    console.error("❌ ERROR DURANTE EL SEEDING:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
