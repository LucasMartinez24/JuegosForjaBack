// prisma/update-reglamento.js
// 🚀 REQUERIDO: Cargamos el entorno para morder la DATABASE_URL de producción
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const prisma = require("../src/config/db");

async function main() {
  console.log(
    "🌱 Sincronizando nuevas pruebas y categorías del Manual Técnico 2026...",
  );

  // 1. Recuperamos los IDs dinámicos de las disciplinas core para evitar harcodeos
  const atletismo = await prisma.disciplina.findFirst({
    where: { nombre: "ATLETISMO" },
  });
  const futsal = await prisma.disciplina.findFirst({
    where: { nombre: "FUTSAL" },
  });
  const handball = await prisma.disciplina.findFirst({
    where: { nombre: "HANDBALL" },
  });
  const voleibol = await prisma.disciplina.findFirst({
    where: { nombre: "VOLEIBOL" },
  });
  const natacion = await prisma.disciplina.findFirst({
    where: { nombre: "NATACION NO FEDERADOS" },
  });

  console.log(
    "⏱️  Paso 1: Actualizando rangos de edad competitivos oficiales...",
  );

  // Ejemplo: El Atletismo Competitivo consolida su rango Sub 15 (2011 a 2013)
  if (atletismo) {
    await prisma.pruebaEspecifica.updateMany({
      where: {
        idDisciplina: atletismo.id,
        NOT: { nombrePrueba: { contains: "Promocional" } },
      },
      data: {
        anioNacimientoMin: 2011,
        anioNacimientoMax: 2013,
      },
    });
    console.log("👉 Rango de Atletismo Competitivo Sub 15 sincronizado.");
  }

  // Ejemplo: Sincronización de Futsal a sus nuevos cortes reglamentarios
  if (futsal) {
    await prisma.pruebaEspecifica.updateMany({
      where: { idDisciplina: futsal.id },
      data: { anioNacimientoMin: 2012, anioNacimientoMax: 2014 },
    });
  }

  console.log(
    "\n✨ Paso 2: Inyectando las nuevas categorías Formativas y Promocionales...",
  );

  // 🚀 ALTA CATEGORÍAS ATLETISMO PROMOCIONAL SUB 12 (Años 2014 - 2015)
  if (atletismo) {
    const pruebasPromocionalesAtletismo = [
      "Lanzamiento de pelota de softbol",
      "Lanzamiento del martillo adaptado",
      "Salto en alto",
      "Salto en largo",
      "Marcha atlética 1 KM",
      "600 mts llanos",
      "60 mtrs llanos",
      "Carrera con vallas",
      "1000mtrs Cross Country",
      "Triatlón Combinadas",
    ];

    for (const p of pruebasPromocionalesAtletismo) {
      // El upsert garantiza que si la prueba ya existía, no duplica; si no estaba, la crea
      await prisma.pruebaEspecifica.upsert({
        where: {
          // Ajustar según los índices únicos de tu esquema de Prisma
          nombrePrueba_idDisciplina: {
            nombrePrueba: `${p} Promocional Sub 12`,
            idDisciplina: atletismo.id,
          },
        },
        update: {
          anioNacimientoMin: 2014,
          anioNacimientoMax: 2015,
          maxJugadores: 999,
        },
        create: {
          idDisciplina: atletismo.id,
          nombrePrueba: `${p} Promocional Sub 12`,
          genero: "MIXTO",
          anioNacimientoMin: 2014,
          anioNacimientoMax: 2015,
          maxJugadores: 999,
        },
      });
    }
    console.log("👉 Pruebas de Atletismo Promocional Sub 12 inyectadas.");
  }

  // 🚀 ALTA NATACIÓN PROMOCIONAL SUB 11 (Años 2015 - 2016)
  if (natacion) {
    const pruebasNatacionPromocional = [
      "100 Libres",
      "50 Libres",
      "50 Pecho",
      "25 Espalda",
      "25 Mariposa",
      "25 Libres",
    ];
    for (const p of pruebasNatacionPromocional) {
      await prisma.pruebaEspecifica.upsert({
        where: {
          nombrePrueba_idDisciplina: {
            nombrePrueba: `${p} Promocional Sub 11`,
            idDisciplina: natacion.id,
          },
        },
        update: {
          anioNacimientoMin: 2015,
          anioNacimientoMax: 2016,
          maxJugadores: 999,
        },
        create: {
          idDisciplina: natacion.id,
          nombrePrueba: `${p} Promocional Sub 11`,
          genero: "MIXTO",
          anioNacimientoMin: 2015,
          anioNacimientoMax: 2016,
          maxJugadores: 999,
        },
      });
    }
    console.log("👉 Pruebas de Natación Promocional Sub 11 inyectadas.");
  }

  // 🚀 ALTA VOLEIBOL PROMOCIONAL SUB 12 (Años 2014 - 2016)
  if (voleibol) {
    const ramas = ["Masculino", "Femenino"];
    for (const r of ramas) {
      await prisma.pruebaEspecifica.upsert({
        where: {
          nombrePrueba_idDisciplina: {
            nombrePrueba: `Voleibol Promocional Sub 12 ${r}`,
            idDisciplina: voleibol.id,
          },
        },
        update: {
          anioNacimientoMin: 2014,
          anioNacimientoMax: 2016,
          maxJugadores: 10,
        },
        create: {
          idDisciplina: voleibol.id,
          nombrePrueba: `Voleibol Promocional Sub 12 ${r}`,
          genero: r.toUpperCase(),
          anioNacimientoMin: 2014,
          anioNacimientoMax: 2016,
          maxJugadores: 10,
        },
      });
    }
    console.log("👉 Categorías de Voleibol Promocional Sub 12 inyectadas.");
  }

  console.log(
    "\n🏁 Sincronización reglamentaria finalizada de forma segura en producción.",
  );
  process.exit(0);
}

main().catch((e) => {
  console.error("❌ Error crítico al actualizar el reglamento:", e);
  process.exit(1);
});
