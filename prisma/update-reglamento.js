// prisma/update-reglamento-completo.js
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const prisma = require("../src/config/db");

async function main() {
  console.log(
    "🌱 Sincronizando Catálogo Reglamentario Completo (Manual Técnico 2026)...",
  );

  // =========================================================================
  // LOCALIZADOR Y ALTA DE DISCIPLINAS MACRO (CONVENCIONALES Y ADAPTADAS)
  // =========================================================================
  const mapaDisciplinas = [
    { nombre: "ATLETISMO", tipo: "CONVENCIONAL" },
    { nombre: "BADMINTON", tipo: "CONVENCIONAL" },
    { nombre: "BASQUET 3X3", tipo: "CONVENCIONAL" },
    { nombre: "FUTSAL", tipo: "CONVENCIONAL" },
    { nombre: "HANDBALL DE PLAYA", tipo: "CONVENCIONAL" }, // 🚀 NUEVA
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
    // Adaptados
    { nombre: "ATLETISMO ADAPTADO", tipo: "ADAPTADO" },
    { nombre: "NATACION ADAPTADA", tipo: "ADAPTADO" },
    { nombre: "BOCCIA", tipo: "ADAPTADO" },
    { nombre: "TENIS DE MESA ADAPTADO", tipo: "ADAPTADO" },
    { nombre: "BASQUET 3X3 ADAPTADO", tipo: "ADAPTADO" },
    { nombre: "GOALBALL", tipo: "ADAPTADO" },
    { nombre: "VOLEIBOL SENTADO", tipo: "ADAPTADO" },
  ];

  console.log("⚡ Creando o asegurando disciplinas principales...");
  for (const d of mapaDisciplinas) {
    await prisma.disciplina.upsert({
      where: { nombre: d.nombre },
      update: { tipo: d.tipo },
      create: { nombre: d.nombre, tipo: d.tipo },
    });
  }

  // =========================================================================
  // INYECCIÓN DE PRUEBAS DE LAS NUEVAS DISCIPLINAS Y MODALIDADES FORMATIVAS
  // =========================================================================

  // 1. 🤾‍♂️ HANDBALL DE PLAYA (Sub 16 / Cortes 2013-2015)
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
    console.log("✅ Handball de Playa Sub 16 inyectado.");
  }

  // 2. 🏊‍♂️ NATACIÓN PROMOCIONAL SUB 11 (Cortes 2015-2016)
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
        },
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
    console.log("✅ Natación Promocional Sub 11 inyectada.");
  }

  // 3. 🏐 VOLEIBOL PROMOCIONAL SUB 12 (Cortes 2014-2016)
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
    console.log("✅ Voleibol Promocional Sub 12 inyectado.");
  }

  // 4. 🏃‍♂️ ATLETISMO PROMOCIONAL SUB 12 (Cortes 2014-2015)
  const atlDisc = await prisma.disciplina.findFirst({
    where: { nombre: "ATLETISMO" },
  });
  if (atlDisc) {
    // Sincronizamos las competitivas Sub 15 primero (2011-2013)
    await prisma.pruebaEspecifica.updateMany({
      where: {
        idDisciplina: atlDisc.id,
        NOT: { nombrePrueba: { contains: "Promocional" } },
      },
      data: { anioNacimientoMin: 2011, anioNacimientoMax: 2013 },
    });

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
      "✅ Atletismo Promocional Sub 12 e instancias Sub 15 actualizadas.",
    );
  }

  console.log(
    "\n🏁 Sincronización global y segura de reglamentos finalizada con éxito.",
  );
  process.exit(0);
}

main().catch((e) => {
  console.error("❌ Error en la migración de reglamento:", e);
  process.exit(1);
});
