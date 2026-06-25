// prisma/update-reglamento-completo.js
// 🚀 REQUERIDO: Cargamos el entorno para morder la DATABASE_URL de tu .env en producción
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

const prisma = require("../src/config/db");

async function main() {
  console.log(
    "🌱 =========================================================================",
  );
  console.log(
    "🌱 INICIANDO MIGRACIÓN REGLAMENTARIA INTEGRAL - JUEGOS FORJA 2026",
  );
  console.log(
    "🌱 =========================================================================",
  );

  // =========================================================================
  // SECCIÓN 1: ALTA Y ASEGURAMIENTO DE DISCIPLINAS MACRO (CONVENCIONAL / ADAPTADO)
  // =========================================================================
  const mapaDisciplinas = [
    { nombre: "ATLETISMO", tipo: "CONVENCIONAL" },
    { nombre: "BADMINTON", tipo: "CONVENCIONAL" },
    { nombre: "BASQUET 3X3", tipo: "CONVENCIONAL" },
    { nombre: "FUTSAL", tipo: "CONVENCIONAL" },
    { nombre: "HANDBALL DE PLAYA", tipo: "CONVENCIONAL" }, // 🚀 Nueva incorporación del manual
    { nombre: "HOCKEY SEVEN", tipo: "CONVENCIONAL" },
    { nombre: "RUGBY 7", tipo: "CONVENCIONAL" },
    { nombre: "VOLEIBOL", tipo: "CONVENCIONAL" },
    { nombre: "VOLEIBOL PLAYA", tipo: "CONVENCIONAL" },
    { nombre: "BOXEO", tipo: "CONVENCIONAL" },
    { nombre: "JUDO", tipo: "CONVENCIONAL" },
    { nombre: "KARATE", tipo: "CONVENCIONAL" },
    { nombre: "LEVANTAMIENTO OLIMPICO", tipo: "CONVENCIONAL" },
    { nombre: "LUCHA LIBRE", tipo: "CONVENCIONAL" },
    { nombre: "TAEKWONDO WTF", tipo: "CONVENCIONAL" },
    { nombre: "GIMNASIA ARTISTICA", tipo: "CONVENCIONAL" },
    { nombre: "GIMNASIA RITMICA", tipo: "CONVENCIONAL" },
    { nombre: "BMX FREESTYLE", tipo: "CONVENCIONAL" },
    { nombre: "BREAKING", tipo: "CONVENCIONAL" },
    { nombre: "CANOTAJE", tipo: "CONVENCIONAL" },
    { nombre: "CICLISMO", tipo: "CONVENCIONAL" },
    { nombre: "ESGRIMA", tipo: "CONVENCIONAL" },
    { nombre: "NATACION NO FEDERADOS", tipo: "CONVENCIONAL" },
    { nombre: "SKATE", tipo: "CONVENCIONAL" },
    { nombre: "TENIS", tipo: "CONVENCIONAL" },
    { nombre: "TENIS DE MESA", tipo: "CONVENCIONAL" },
    { nombre: "TIRO", tipo: "CONVENCIONAL" },
    { nombre: "TIRO CON ARCO", tipo: "CONVENCIONAL" },
    { nombre: "TRIATLON SUPER SPRINT", tipo: "CONVENCIONAL" },
    { nombre: "PADEL", tipo: "CONVENCIONAL" },
    // Bloque de Adaptados Oficiales
    { nombre: "ATLETISMO ADAPTADO", tipo: "ADAPTADO" },
    { nombre: "NATACION ADAPTADA", tipo: "ADAPTADO" },
    { nombre: "BOCCIA", tipo: "ADAPTADO" },
    { nombre: "TENIS DE MESA ADAPTADO", tipo: "ADAPTADO" },
    { nombre: "BASQUET 3X3 ADAPTADO", tipo: "ADAPTADO" },
    { nombre: "GOALBALL", tipo: "ADAPTADO" },
    { nombre: "VOLEIBOL SENTADO", tipo: "ADAPTADO" },
  ];

  console.log(
    "⚡ Creando o verificando existencia de las disciplinas estructurales...",
  );
  for (const d of mapaDisciplinas) {
    await prisma.disciplina.upsert({
      where: { nombre: d.nombre },
      update: { tipo: d.tipo },
      create: { nombre: d.nombre, tipo: d.tipo },
    });
  }
  console.log("✅ Bloque de disciplinas macro asegurado.");

  // =========================================================================
  // SECCIÓN 2: MIGRACIÓN QUIRÚRGICA DE CATEGORÍAS Y RANGOS DE EDAD EXISTENTES
  // =========================================================================

  // 🥊 A. BOXEO: Sincronización estricta a Sub 16 (2010 - 2011)
  const boxeoDisc = await prisma.disciplina.findFirst({
    where: { nombre: "BOXEO" },
  });
  if (boxeoDisc) {
    await prisma.pruebaEspecifica.updateMany({
      where: { idDisciplina: boxeoDisc.id },
      data: {
        anioNacimientoMin: 2010, // Permite pugilistas clase 2010[cite: 2]
        anioNacimientoMax: 2011, // Cierre en clase 2011[cite: 2]
      },
    });
    console.log(
      "✅ BOXEO: Categorías de pesajes actualizadas a Sub 16 (2010-2011) [Manual pág. 10].",
    );
  }

  // 🏃‍♂️ B. ATLETISMO COMPETITIVO: Fijación Sub 15 (2011 - 2013)
  const atlDisc = await prisma.disciplina.findFirst({
    where: { nombre: "ATLETISMO" },
  });
  if (atlDisc) {
    await prisma.pruebaEspecifica.updateMany({
      where: {
        idDisciplina: atlDisc.id,
        NOT: { nombrePrueba: { contains: "Promocional" } },
      },
      data: {
        anioNacimientoMin: 2011,
        anioNacimientoMax: 2013,
      },
    });
    console.log(
      "✅ ATLETISMO: Pruebas de grilla competitiva fijadas en Sub 15 (2011-2013).",
    );
  }

  // =========================================================================
  // SECCIÓN 3: INYECCIÓN DE NUEVAS DISCIPLINAS Y CATEGORÍAS PROMOCIONALES
  // =========================================================================

  // 1. 🤾‍♂️ HANDBALL DE PLAYA (Nueva Disciplina Oficial - Sub 16 / 2013-2015)
  const hpDisc = await prisma.disciplina.findFirst({
    where: { nombre: "HANDBALL DE PLAYA" },
  });
  if (hpDisc) {
    const ramas = ["Masculino", "Femenino"];
    for (const r of ramas) {
      await prisma.pruebaEspecifica.upsert({
        where: {
          nombrePrueba_idDisciplina: {
            nombrePrueba: `Handball de Playa ${r} Sub 16`,
            idDisciplina: hpDisc.id,
          },
        },
        update: {
          anioNacimientoMin: 2013,
          anioNacimientoMax: 2015,
          maxJugadores: 8,
        },
        create: {
          idDisciplina: hpDisc.id,
          nombrePrueba: `Handball de Playa ${r} Sub 16`,
          genero: r.toUpperCase(),
          anioNacimientoMin: 2013,
          anioNacimientoMax: 2015,
          maxJugadores: 8,
        },
      });
    }
    console.log(
      "✅ NUEVO: Handball de Playa registrado con cupo de 8 jugadores.",
    );
  }

  // 2. 🏊‍♂️ NATACIÓN PROMOCIONAL FORMATIVA (Sub 11 / 2015-2016)
  const natDisc = await prisma.disciplina.findFirst({
    where: { nombre: "NATACION NO FEDERADOS" },
  });
  if (natDisc) {
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
            idDisciplina: natDisc.id,
          },
        },
        update: {
          anioNacimientoMin: 2015,
          anioNacimientoMax: 2016,
          maxJugadores: 999,
        }, // Ilimitado por ser individual
        create: {
          idDisciplina: natDisc.id,
          nombrePrueba: `${p} Promocional Sub 11`,
          genero: "MIXTO",
          anioNacimientoMin: 2015,
          anioNacimientoMax: 2016,
          maxJugadores: 999,
        },
      });
    }
    console.log(
      "✅ FORMATIVO: Pruebas de Natación Promocional Sub 11 inyectadas.",
    );
  }

  // 3. 🏐 VOLEIBOL PROMOCIONAL FORMATIVO (Sub 12 / 2014-2016)
  const volDisc = await prisma.disciplina.findFirst({
    where: { nombre: "VOLEIBOL" },
  });
  if (volDisc) {
    const ramas = ["Masculino", "Femenino"];
    for (const r of ramas) {
      await prisma.pruebaEspecifica.upsert({
        where: {
          nombrePrueba_idDisciplina: {
            nombrePrueba: `Voleibol Promocional Sub 12 ${r}`,
            idDisciplina: volDisc.id,
          },
        },
        update: {
          anioNacimientoMin: 2014,
          anioNacimientoMax: 2016,
          maxJugadores: 10,
        },
        create: {
          idDisciplina: volDisc.id,
          nombrePrueba: `Voleibol Promocional Sub 12 ${r}`,
          genero: r.toUpperCase(),
          anioNacimientoMin: 2014,
          anioNacimientoMax: 2016,
          maxJugadores: 10,
        },
      });
    }
    console.log(
      "✅ FORMATIVO: Ramas de Voleibol Promocional Sub 12 configuradas (10 jugadores).",
    );
  }

  // 4. 🏃‍♂️ ATLETISMO PROMOCIONAL FORMATIVO (Sub 12 / 2014-2015)
  if (atlDisc) {
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
      await prisma.pruebaEspecifica.upsert({
        where: {
          nombrePrueba_idDisciplina: {
            nombrePrueba: `${p} Promocional Sub 12`,
            idDisciplina: atlDisc.id,
          },
        },
        update: {
          anioNacimientoMin: 2014,
          anioNacimientoMax: 2015,
          maxJugadores: 999,
        },
        create: {
          idDisciplina: atlDisc.id,
          nombrePrueba: `${p} Promocional Sub 12`,
          genero: "MIXTO",
          anioNacimientoMin: 2014,
          anioNacimientoMax: 2015,
          maxJugadores: 999,
        },
      });
    }
    console.log(
      "✅ FORMATIVO: Catálogo completo de Atletismo Promocional Sub 12 inyectado.",
    );
  }

  console.log(
    "\n🏁 =========================================================================",
  );
  console.log(
    "🏁 MIGRACIÓN EXITOSA: Base de datos en producción actualizada sin pérdida de registros.",
  );
  console.log(
    "🏁 =========================================================================",
  );
  process.exit(0);
}

main().catch((e) => {
  console.error("❌ ERROR CRÍTICO EN LA MIGRACIÓN REGLAMENTARIA:", e);
  process.exit(1);
});
