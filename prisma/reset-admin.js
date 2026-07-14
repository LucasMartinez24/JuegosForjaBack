// prisma/reset-admin.js
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

const prisma = require("../src/config/db");
const bcrypt = require("bcryptjs");

async function main() {
  console.log("🔒 Iniciando el reseteo con forzado de clave del Administrador Central...");

  const adminEmail = "admin@deportesjujuy.gov.ar";
  const adminPassword = "admin123"; 
  const saltRounds = 10;
  
  console.log("⚡ Generando hash seguro de rescate...");
  const hashedAdminPassword = await bcrypt.hash(adminPassword, saltRounds);

  // 1. Buscamos si el administrador ya está registrado
  const adminExistente = await prisma.usuario.findUnique({
    where: { username: "merakiatletismo" }
  });

  if (adminExistente) {
    // 🚀 ACTUALIZACIÓN: Reestablecemos clave y encendemos la bandera de forzado
    await prisma.usuario.update({
      where: { username:"merakiatletismo" },
      data: {
        passwordHash: hashedAdminPassword,
        // Ajustá el nombre exacto de la columna según tu schema.prisma 
        // (puede ser requiere_cambio_password o requiereCambioPassword)
        requiereCambioPassword: true 
      }
    });
    console.log("🔄 Cuenta existente encontrada. Contraseña reestablecida y bandera de cambio activada.");
  } else {
    // 🚀 ALTA DESDE CERO: Si la BD estaba vacía, creamos el perfil con la bandera encendida
    await prisma.usuario.create({
      data: {
        email: adminEmail,
        passwordHash: hashedAdminPassword,
        username: "admin",
        rol: "ADMIN",
        dni: "99000123",
        nombre: "Auditor",
        apellido: "Ministerial",
        requiereCambioPassword: true // 🛡️ Forzado activo desde el nacimiento de la cuenta
      }
    });
    console.log("✨ Perfil ADMIN creado desde cero con política de cambio obligatoria.");
  }

  console.log("\n◈===========================================================◈");
  console.log(`✅ ¡Proceso de restauración completado con éxito!`);
  console.log(`📧 Correo de Acceso: ${adminEmail}`);
  console.log(`🔑 Contraseña Temporal: ${adminPassword}`);
  console.log(`🛡️  Política Activa: El sistema exigirá el cambio de clave al ingresar.`);
  console.log("◈===========================================================◈");
  
  process.exit(0);
}

main().catch((e) => {
  console.error("❌ Error crítico al intentar resetear el administrador:", e);
  process.exit(1);
});
