// prisma/update-localidades.js
const prisma = require("../src/config/db");
const bcrypt = require("bcryptjs");

async function main() {
  console.log("🔄 Iniciando actualización segura de la base de datos en producción...");

  // 1. Listado definitivo oficial de Municipalidades
  const municipalidades = [
    "Abra Pampa", "Aguas Calientes", "Caimancito", "Calilegua", "El Aguilar", 
    "El Carmen", "El Talar", "Fraile Pintado", "Hipólito Yrigoyen (Iturbe)", 
    "Humahuaca", "La Esperanza", "La Mendieta", "La Quiaca", 
    "Libertador General San Martín", "Maimará", "Monterrico", "Palma Sola", 
    "Palpalá", "Pampa Blanca", "Perico", "Puesto Viejo", "Purmamarca", 
    "Rodeíto", "San Antonio", "San Pedro de Jujuy", "San Salvador de Jujuy", 
    "Santa Clara", "Tilcara", "Yala"
  ];

  // 2. Listado definitivo oficial de Comisiones Municipales
  const comisiones = [
    "Abdón Castro Tolay (Barrancas)", "Abralaite", "Arrayanal", "Barrios", 
    "Cangrejillos", "Caspalá", "Catua", "Cieneguillas", "Coranzulí", 
    "Cusi Cusi", "El Cóndor", "El Fuerte", "El Piquete", "Huacalera", 
    "Mina Pirquitas", "Pampichuela", "Puesto del Marqués", "Pumahuasi", 
    "Rinconada", "Rosario de Río Grande (Barro Negro)", "San Francisco", 
    "Santa Ana", "Santa Catalina", "Susques", "Tres Cruces", "Tumbaya", 
    "Valle Grande", "Vinalito", "Volcán", "Yavi"
  ];

  console.log("📍 Procesando y actualizando jerarquías geográficas...");

  // Insertar o actualizar Municipalidades (Si eran comisiones, cambian de tipo automáticamente)
  for (const m of municipalidades) {
    await prisma.localidad.upsert({
      where: { nombre: m }, // Requiere que 'nombre' sea único en tu esquema, si no busca por ID
      update: { tipo: "MUNICIPALIDAD" },
      create: { nombre: m, tipo: "MUNICIPALIDAD" }
    });
  }

  // Insertar o actualizar Comisiones Municipales
  for (const c of comisiones) {
    await prisma.localidad.upsert({
      where: { nombre: c },
      update: { tipo: "COMISION_MUNICIPAL" },
      create: { nombre: c, tipo: "COMISION_MUNICIPAL" }
    });
  }

  console.log("✅ Geografía jujeña sincronizada sin pérdidas.");

  // 3. Matriculación segura de cuentas institucionales faltantes
  const localidadesFisicas = await prisma.localidad.findMany();
  const passwordComunMunicipios = "municipio2026"; 
  const saltRounds = 10;
  const hashedMunicipioPassword = await bcrypt.hash(passwordComunMunicipios, saltRounds);

  console.log("🏢 Verificando integridad de cuentas oficiales...");

  let creadas = 0;
  let omitidas = 0;

  for (const loc of localidadesFisicas) {
    const usernameLimpio = loc.nombre
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") 
      .replace(/[^a-z0-9]/g, ""); 

    const usernameFinal = `${usernameLimpio}_deportes`;

    // 🚀 CONTROL CRÍTICO: Buscamos si la cuenta o el DNI institucional ya existen
    const usuarioExistente = await prisma.usuario.findFirst({
      where: {
        OR: [
          { username: usernameFinal },
          { idLocalidad: loc.id }
        ]
      }
    });

    if (!usuarioExistente) {
      // Si la intendencia no tenía cuenta (como Tilcara o Cieneguillas), se genera de forma segura
      await prisma.usuario.create({
        data: {
          username: usernameFinal,
          passwordHash: hashedMunicipioPassword,
          rol: "MUNICIPIO", 
          dni: `99${Math.floor(100000 + Math.random() * 900000)}`, 
          nombre: "Director",
          apellido: `Deportes ${loc.nombre}`,
          idLocalidad: loc.id, 
          email: `${usernameFinal}@jujuy.gov.ar`,
        },
      });
      creadas++;
    } else {
      omitidas++;
    }
  }

  console.log(`\n🏁 Sincronización de Producción Finalizada.`);
  console.log(`✨ Cuentas nuevas creadas: ${creadas}`);
  console.log(`🔒 Cuentas preexistentes conservadas intactas: ${omitidas}`);
  process.exit(0);
}

main().catch((e) => {
  console.error("❌ Error en la actualización:", e);
  process.exit(1);
});
