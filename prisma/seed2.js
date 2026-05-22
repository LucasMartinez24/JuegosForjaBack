// prisma/seed.js
const prisma = require("../src/config/db");

async function main() {
  console.log(
    "🌱 Iniciando la siembra oficial y rigurosa de los Juegos FORJA 2026...",
  );

  // 1. Limpieza preventiva bajo cascada jerárquica
  await prisma.deportista.deleteMany({});
  await prisma.equipo.deleteMany({});
  await prisma.pruebaEspecifica.deleteMany({});
  await prisma.disciplina.deleteMany({});
  console.log("🧹 Base de datos purgada de configuraciones previas.");

  // =========================================================================
  // SECCIÓN A: DEPORTES CONVENCIONALES
  // =========================================================================

  // 1. Atletismo (2011-2013)
  const atletismo = await prisma.disciplina.create({
    data: { nombre: "ATLETISMO", tipo: "CONVENCIONAL" },
  });
  const pruebasAtletismo = [
    "Lanzamiento de bala",
    "Lanzamiento de jabalina",
    "Lanzamiento de disco",
    "Lanzamiento de martillo",
    "Salto en alto",
    "Salto en largo",
    "Salto con garrocha",
    "Salto triple",
    "Marcha atlética",
    "2000m Cross Country",
    "80m llanos",
    "200m llanos",
    "600m llanos",
  ];
  for (const p of pruebasAtletismo) {
    await prisma.pruebaEspecifica.create({
      data: {
        idDisciplina: atletismo.id,
        nombrePrueba: `${p} (Masc/Fem)`,
        genero: "MIXTO",
        anioNacimientoMin: 2011,
        anioNacimientoMax: 2013,
        maxJugadores: 2,
      },
    });
  }
  await prisma.pruebaEspecifica.create({
    data: {
      idDisciplina: atletismo.id,
      nombrePrueba: "80 c/v Femenino",
      genero: "FEMENINO",
      anioNacimientoMin: 2011,
      anioNacimientoMax: 2013,
      maxJugadores: 2,
    },
  });
  await prisma.pruebaEspecifica.create({
    data: {
      idDisciplina: atletismo.id,
      nombrePrueba: "100 c/v Masculino",
      genero: "MASCULINO",
      anioNacimientoMin: 2011,
      anioNacimientoMax: 2013,
      maxJugadores: 2,
    },
  });

  // 2. Bádminton (2012-2013)
  const badminton = await prisma.disciplina.create({
    data: { nombre: "BADMINTON", tipo: "CONVENCIONAL" },
  });
  await prisma.pruebaEspecifica.create({
    data: {
      idDisciplina: badminton.id,
      nombrePrueba: "Singles Masculino",
      genero: "MASCULINO",
      anioNacimientoMin: 2012,
      anioNacimientoMax: 2013,
      maxJugadores: 1,
      subCategoria: "Singles",
    },
  });
  await prisma.pruebaEspecifica.create({
    data: {
      idDisciplina: badminton.id,
      nombrePrueba: "Singles Femenino",
      genero: "FEMENINO",
      anioNacimientoMin: 2012,
      anioNacimientoMax: 2013,
      maxJugadores: 1,
      subCategoria: "Singles",
    },
  });
  await prisma.pruebaEspecifica.create({
    data: {
      idDisciplina: badminton.id,
      nombrePrueba: "Dobles Mixto",
      genero: "MIXTO",
      anioNacimientoMin: 2012,
      anioNacimientoMax: 2013,
      maxJugadores: 2,
      subCategoria: "Dobles Mixto",
    },
  });

  // 3. Deportes de Conjunto Lineales
  const conjuntos = [
    { nombre: "BASQUET 3X3", min: 2012, max: 2013, cupo: 4 },
    { nombre: "FUTSAL", min: 2012, max: 2014, cupo: 10 },
    { nombre: "HANDBALL", min: 2013, max: 2015, cupo: 8 },
    { nombre: "HOCKEY SEVEN", min: 2012, max: 2014, cupo: 10 },
    { nombre: "RUGBY 7", min: 2010, max: 2011, cupo: 11 },
    { nombre: "VOLEIBOL", min: 2012, max: 2014, cupo: 10 },
    { nombre: "VOLEIBOL PLAYA", min: 2012, max: 2014, cupo: 2 },
  ];
  for (const c of conjuntos) {
    const disc = await prisma.disciplina.create({
      data: { nombre: c.nombre, tipo: "CONVENCIONAL" },
    });
    await prisma.pruebaEspecifica.create({
      data: {
        idDisciplina: disc.id,
        nombrePrueba: `${disc.nombre} Masculino`,
        genero: "MASCULINO",
        anioNacimientoMin: c.min,
        anioNacimientoMax: c.max,
        maxJugadores: c.cupo,
      },
    });
    await prisma.pruebaEspecifica.create({
      data: {
        idDisciplina: disc.id,
        nombrePrueba: `${disc.nombre} Femenino`,
        genero: "FEMENINO",
        anioNacimientoMin: c.min,
        anioNacimientoMax: c.max,
        maxJugadores: c.cupo,
      },
    });
  }

  // 4. Boxeo (2010-2011) - DETALLE CORREGIDO
  const boxeo = await prisma.disciplina.create({
    data: { nombre: "BOXEO", tipo: "CONVENCIONAL" },
  });
  const pesosBoxMasc = [
    { label: "52-54 kg", max: 54.0 },
    { label: "54-57 kg", max: 57.0 },
    { label: "57-60 kg", max: 60.0 },
    { label: "60-63 kg", max: 63.0 },
    { label: "63-69 kg", max: 69.0 },
  ];
  const pesosBoxFem = [
    { label: "48-50 kg", max: 50.0 },
    { label: "52-54 kg", max: 54.0 },
    { label: "57-60 kg", max: 60.0 },
  ];
  for (const p of pesosBoxMasc) {
    await prisma.pruebaEspecifica.create({
      data: {
        idDisciplina: boxeo.id,
        nombrePrueba: `Boxeo Masc: ${p.label}`,
        genero: "MASCULINO",
        anioNacimientoMin: 2010,
        anioNacimientoMax: 2011,
        maxJugadores: 1,
        requierePeso: true,
        pesoMaximo: p.max,
      },
    });
  }
  for (const p of pesosBoxFem) {
    await prisma.pruebaEspecifica.create({
      data: {
        idDisciplina: boxeo.id,
        nombrePrueba: `Boxeo Fem: ${p.label}`,
        genero: "FEMENINO",
        anioNacimientoMin: 2010,
        anioNacimientoMax: 2011,
        maxJugadores: 1,
        requierePeso: true,
        pesoMaximo: p.max,
      },
    });
  }

  // 5. Judo (2012-2013) - DETALLE CORREGIDO
  const judo = await prisma.disciplina.create({
    data: { nombre: "JUDO", tipo: "CONVENCIONAL" },
  });
  const pesosJudo = [
    { label: "Menos de 44 kg", max: 44.0 },
    { label: "Menos de 53 kg", max: 53.0 },
    { label: "Menos de 64 kg", max: 64.0 },
    { label: "Más de 64 kg", max: 99.99 }, // 99.99 actúa como Open sin límite superior
  ];
  for (const p of pesosJudo) {
    await prisma.pruebaEspecifica.create({
      data: {
        idDisciplina: judo.id,
        nombrePrueba: `Judo Masc: ${p.label}`,
        genero: "MASCULINO",
        anioNacimientoMin: 2012,
        anioNacimientoMax: 2013,
        maxJugadores: 1,
        requierePeso: true,
        pesoMaximo: p.max,
      },
    });
    await prisma.pruebaEspecifica.create({
      data: {
        idDisciplina: judo.id,
        nombrePrueba: `Judo Fem: ${p.label}`,
        genero: "FEMENINO",
        anioNacimientoMin: 2012,
        anioNacimientoMax: 2013,
        maxJugadores: 1,
        requierePeso: true,
        pesoMaximo: p.max,
      },
    });
  }

  // 6. Karate (2011-2012) - DETALLE CORREGIDO
  const karate = await prisma.disciplina.create({
    data: { nombre: "KARATE", tipo: "CONVENCIONAL" },
  });
  const pesosKarateMasc = [
    { label: "-63 kg", max: 63.0 },
    { label: "-70 kg", max: 70.0 },
    { label: "+70 kg", max: 99.99 },
  ];
  const pesosKarateFem = [
    { label: "-54 kg", max: 54.0 },
    { label: "-61 kg", max: 61.0 },
    { label: "+61 kg", max: 99.99 },
  ];
  for (const p of pesosKarateMasc) {
    await prisma.pruebaEspecifica.create({
      data: {
        idDisciplina: karate.id,
        nombrePrueba: `Kumite Masc: ${p.label}`,
        genero: "MASCULINO",
        anioNacimientoMin: 2011,
        anioNacimientoMax: 2012,
        maxJugadores: 1,
        requierePeso: true,
        pesoMaximo: p.max,
      },
    });
  }
  for (const p of pesosKarateFem) {
    await prisma.pruebaEspecifica.create({
      data: {
        idDisciplina: karate.id,
        nombrePrueba: `Kumite Fem: ${p.label}`,
        genero: "FEMENINO",
        anioNacimientoMin: 2011,
        anioNacimientoMax: 2012,
        maxJugadores: 1,
        requierePeso: true,
        pesoMaximo: p.max,
      },
    });
  }
  await prisma.pruebaEspecifica.create({
    data: {
      idDisciplina: karate.id,
      nombrePrueba: "Kata Individual Masculino",
      genero: "MASCULINO",
      anioNacimientoMin: 2011,
      anioNacimientoMax: 2012,
      maxJugadores: 1,
    },
  });
  await prisma.pruebaEspecifica.create({
    data: {
      idDisciplina: karate.id,
      nombrePrueba: "Kata Individual Femenino",
      genero: "FEMENINO",
      anioNacimientoMin: 2011,
      anioNacimientoMax: 2012,
      maxJugadores: 1,
    },
  });

  // 7. Levantamiento Olímpico (2011-2013) - DETALLE CORREGIDO
  const levantamiento = await prisma.disciplina.create({
    data: { nombre: "LEVANTAMIENTO OLIMPICO", tipo: "CONVENCIONAL" },
  });
  const pesosLevantamientoFem = [
    { label: "Hasta 48 kg", max: 48.0 },
    { label: "Hasta 53 kg", max: 53.0 },
    { label: "Hasta 58 kg", max: 58.0 },
    { label: "Hasta 63 kg", max: 63.0 },
    { label: "Más de 53 kg", max: 99.99 },
  ];
  const pesosLevantamientoMasc = [
    { label: "Hasta 60 kg", max: 60.0 },
    { label: "Hasta 65 kg", max: 65.0 },
    { label: "Hasta 71 kg", max: 71.0 },
    { label: "Hasta 79 kg", max: 79.0 },
    { label: "Más de 79 kg", max: 99.99 },
  ];
  for (const p of pesosLevantamientoFem) {
    await prisma.pruebaEspecifica.create({
      data: {
        idDisciplina: levantamiento.id,
        nombrePrueba: `Levantamiento Fem: ${p.label}`,
        genero: "FEMENINO",
        anioNacimientoMin: 2011,
        anioNacimientoMax: 2013,
        maxJugadores: 1,
        requierePeso: true,
        pesoMaximo: p.max,
      },
    });
  }
  for (const p of pesosLevantamientoMasc) {
    await prisma.pruebaEspecifica.create({
      data: {
        idDisciplina: levantamiento.id,
        nombrePrueba: `Levantamiento Masc: ${p.label}`,
        genero: "MASCULINO",
        anioNacimientoMin: 2011,
        anioNacimientoMax: 2013,
        maxJugadores: 1,
        requierePeso: true,
        pesoMaximo: p.max,
      },
    });
  }

  // 8. Lucha Libre (2011-2013) - DETALLE CORREGIDO
  const lucha = await prisma.disciplina.create({
    data: { nombre: "LUCHA LIBRE", tipo: "CONVENCIONAL" },
  });
  const pesosLuchaMasc = [
    { label: "Más de 45 kg hasta 55 kg", max: 55.0 },
    { label: "Más de 55 kg hasta 65 kg", max: 65.0 },
    { label: "Más de 65 kg hasta 75 kg", max: 75.0 },
    { label: "Más de 76 kg hasta 85 kg", max: 85.0 },
  ];
  const pesosLuchaFem = [
    { label: "Más de 40 kg hasta 45 kg", max: 45.0 },
    { label: "Más de 45 kg hasta 51 kg", max: 51.0 },
    { label: "Más de 51 kg hasta 58 kg", max: 58.0 },
    { label: "Más de 58 kg hasta 65 kg", max: 65.0 },
  ];
  for (const p of pesosLuchaMasc) {
    await prisma.pruebaEspecifica.create({
      data: {
        idDisciplina: lucha.id,
        nombrePrueba: `Lucha Masc: ${p.label}`,
        genero: "MASCULINO",
        anioNacimientoMin: 2011,
        anioNacimientoMax: 2013,
        maxJugadores: 1,
        requierePeso: true,
        pesoMaximo: p.max,
      },
    });
  }
  for (const p of pesosLuchaFem) {
    await prisma.pruebaEspecifica.create({
      data: {
        idDisciplina: lucha.id,
        nombrePrueba: `Lucha Fem: ${p.label}`,
        genero: "FEMENINO",
        anioNacimientoMin: 2011,
        anioNacimientoMax: 2013,
        maxJugadores: 1,
        requierePeso: true,
        pesoMaximo: p.max,
      },
    });
  }

  // 9. Taekwondo WTF (2012-2013) - DETALLE CORREGIDO
  const taekwondo = await prisma.disciplina.create({
    data: { nombre: "TAEKWONDO WTF", tipo: "CONVENCIONAL" },
  });
  const pesosTaekwondoMasc = [
    { label: "Hasta 46 kg", max: 46.0 },
    { label: "Más de 46 kg y hasta 52 kg", max: 52.0 },
    { label: "Más de 52 kg y hasta 58 kg", max: 58.0 },
    { label: "Más de 58 kg y hasta 64 kg", max: 64.0 },
  ];
  const pesosTaekwondoFem = [
    { label: "Hasta 44 kg", max: 44.0 },
    { label: "Más de 44 kg y hasta 50 kg", max: 50.0 },
    { label: "Más de 50 kg y hasta 56 kg", max: 56.0 },
    { label: "Más de 56 kg y hasta 62 kg", max: 62.0 },
  ];
  for (const p of pesosTaekwondoMasc) {
    await prisma.pruebaEspecifica.create({
      data: {
        idDisciplina: taekwondo.id,
        nombrePrueba: `Taekwondo Masc: ${p.label}`,
        genero: "MASCULINO",
        anioNacimientoMin: 2012,
        anioNacimientoMax: 2013,
        maxJugadores: 1,
        requierePeso: true,
        pesoMaximo: p.max,
      },
    });
  }
  for (const p of pesosTaekwondoFem) {
    await prisma.pruebaEspecifica.create({
      data: {
        idDisciplina: taekwondo.id,
        nombrePrueba: `Taekwondo Fem: ${p.label}`,
        genero: "FEMENINO",
        anioNacimientoMin: 2012,
        anioNacimientoMax: 2013,
        maxJugadores: 1,
        requierePeso: true,
        pesoMaximo: p.max,
      },
    });
  }

  // 10. Gimnasia Artística
  const gimnasiaArt = await prisma.disciplina.create({
    data: { nombre: "GIMNASIA ARTISTICA", tipo: "CONVENCIONAL" },
  });
  await prisma.pruebaEspecifica.create({
    data: {
      idDisciplina: gimnasiaArt.id,
      nombrePrueba: "Nivel 1 Promocional Suelo Damas (2014-2015)",
      genero: "FEMENINO",
      anioNacimientoMin: 2014,
      anioNacimientoMax: 2015,
      maxJugadores: 4,
    },
  });
  await prisma.pruebaEspecifica.create({
    data: {
      idDisciplina: gimnasiaArt.id,
      nombrePrueba: "Nivel 2 Promocional Damas Aparatos (2014-2015)",
      genero: "FEMENINO",
      anioNacimientoMin: 2014,
      anioNacimientoMax: 2015,
      maxJugadores: 4,
    },
  });
  await prisma.pruebaEspecifica.create({
    data: {
      idDisciplina: gimnasiaArt.id,
      nombrePrueba: "Nivel 3 Proyección Damas (2014-2015)",
      genero: "FEMENINO",
      anioNacimientoMin: 2014,
      anioNacimientoMax: 2015,
      maxJugadores: 4,
    },
  });
  await prisma.pruebaEspecifica.create({
    data: {
      idDisciplina: gimnasiaArt.id,
      nombrePrueba: "Nivel 1 Promocional Caballeros (2011-2013)",
      genero: "MASCULINO",
      anioNacimientoMin: 2011,
      anioNacimientoMax: 2013,
      maxJugadores: 4,
    },
  });
  await prisma.pruebaEspecifica.create({
    data: {
      idDisciplina: gimnasiaArt.id,
      nombrePrueba: "Nivel 3 Proyección Caballeros (2011-2013)",
      genero: "MASCULINO",
      anioNacimientoMin: 2011,
      anioNacimientoMax: 2013,
      maxJugadores: 4,
    },
  });

  // 11. Resto de Convencionales Unitarios/Individuales
  const individuales = [
    { nombre: "BMX FREESTYLE", min: 2012, max: 2014, cupo: 1 },
    { nombre: "BREAKING", min: 2011, max: 2014, cupo: 1 },
    { nombre: "CANOTAJE", min: 2012, max: 2014, cupo: 2 },
    { nombre: "CICLISMO", min: 2010, max: 2012, cupo: 3 },
    { nombre: "ESGRIMA", min: 2013, max: 2015, cupo: 2 },
    { nombre: "NATACION NO FEDERADOS", min: 2012, max: 2014, cupo: 5 },
    { nombre: "SKATE", min: 2010, max: 2012, cupo: 2 },
    { nombre: "TENIS", min: 2010, max: 2012, cupo: 2 },
    { nombre: "TENIS DE MESA", min: 2012, max: 2014, cupo: 3 },
    { nombre: "TIRO", min: 2011, max: 2013, cupo: 2 },
    { nombre: "TIRO CON ARCO", min: 2012, max: 2014, cupo: 2 },
    { nombre: "TRIATLON SUPER SPRINT", min: 2010, max: 2012, cupo: 2 },
  ];
  for (const ind of individuales) {
    const disc = await prisma.disciplina.create({
      data: { nombre: ind.nombre, tipo: "CONVENCIONAL" },
    });
    await prisma.pruebaEspecifica.create({
      data: {
        idDisciplina: disc.id,
        nombrePrueba: `${disc.nombre} Masculino`,
        genero: "MASCULINO",
        anioNacimientoMin: ind.min,
        anioNacimientoMax: ind.max,
        maxJugadores: ind.cupo,
      },
    });
    await prisma.pruebaEspecifica.create({
      data: {
        idDisciplina: disc.id,
        nombrePrueba: `${disc.nombre} Femenino`,
        genero: "FEMENINO",
        anioNacimientoMin: ind.min,
        anioNacimientoMax: ind.max,
        maxJugadores: ind.cupo,
      },
    });
  }

  const rítmica = await prisma.disciplina.create({
    data: { nombre: "GIMNASIA RITMICA", tipo: "CONVENCIONAL" },
  });
  await prisma.pruebaEspecifica.create({
    data: {
      idDisciplina: rítmica.id,
      nombrePrueba: "Conjunto Femenino Sub-14",
      genero: "FEMENINO",
      anioNacimientoMin: 2012,
      anioNacimientoMax: 2014,
      maxJugadores: 5,
    },
  });

  const padel = await prisma.disciplina.create({
    data: { nombre: "PADEL", tipo: "CONVENCIONAL" },
  });
  await prisma.pruebaEspecifica.create({
    data: {
      idDisciplina: padel.id,
      nombrePrueba: "Pareja Mixta Sub-14",
      genero: "MIXTO",
      anioNacimientoMin: 2012,
      anioNacimientoMax: 2014,
      maxJugadores: 2,
    },
  });

  // =========================================================================
  // SECCIÓN B: DEPORTE ADAPTADO
  // =========================================================================
  const atlAdaptado = await prisma.disciplina.create({
    data: { nombre: "ATLETISMO ADAPTADO", tipo: "ADAPTADO" },
  });
  const clasificacionesAtl = [
    "Intelectual",
    "Síndrome de Down",
    "Discapacidad Motora",
    "Parálisis Cerebral",
    "Discapacidad Visual",
  ];
  for (const clase of clasificacionesAtl) {
    await prisma.pruebaEspecifica.create({
      data: {
        idDisciplina: atlAdaptado.id,
        nombrePrueba: `Atletismo Masc: ${clase}`,
        genero: "MASCULINO",
        anioNacimientoMin: 2008,
        anioNacimientoMax: 2011,
        maxJugadores: 3,
        subCategoria: clase,
      },
    });
    await prisma.pruebaEspecifica.create({
      data: {
        idDisciplina: atlAdaptado.id,
        nombrePrueba: `Atletismo Fem: ${clase}`,
        genero: "FEMENINO",
        anioNacimientoMin: 2008,
        anioNacimientoMax: 2011,
        maxJugadores: 3,
        subCategoria: clase,
      },
    });
  }

  const natAdaptada = await prisma.disciplina.create({
    data: { nombre: "NATACION ADAPTADA", tipo: "ADAPTADO" },
  });
  const clasesNat = [
    "Motores",
    "Parálisis Cerebral",
    "Intelectuales",
    "Síndrome de Down",
    "Ciegos/Disminuidos",
    "Sordos/Hipoacúsicos",
  ];
  for (const clase of clasesNat) {
    await prisma.pruebaEspecifica.create({
      data: {
        idDisciplina: natAdaptada.id,
        nombrePrueba: `Natación Mixta: ${clase}`,
        genero: "MIXTO",
        anioNacimientoMin: 2010,
        anioNacimientoMax: 2014,
        maxJugadores: 2,
        subCategoria: clase,
      },
    });
  }

  const boccia = await prisma.disciplina.create({
    data: { nombre: "BOCCIA", tipo: "ADAPTADO" },
  });
  const categoriasBoccia = ["Clase BC1", "Clase BC2", "Clase BC3"];
  for (const cat of categoriasBoccia) {
    await prisma.pruebaEspecifica.create({
      data: {
        idDisciplina: boccia.id,
        nombrePrueba: `Boccia Mixto: ${cat}`,
        genero: "MIXTO",
        anioNacimientoMin: 2008,
        anioNacimientoMax: 2013,
        maxJugadores: 1,
        subCategoria: cat,
      },
    });
  }

  const tmAdaptado = await prisma.disciplina.create({
    data: { nombre: "TENIS DE MESA ADAPTADO", tipo: "ADAPTADO" },
  });
  const deiscapacidadTM = [
    "Motriz o Parálisis Cerebral",
    "Discapacidad Intelectual",
  ];
  for (const disc of deiscapacidadTM) {
    await prisma.pruebaEspecifica.create({
      data: {
        idDisciplina: tmAdaptado.id,
        nombrePrueba: `Tenis de Mesa Mixto: ${disc}`,
        genero: "MIXTO",
        anioNacimientoMin: 2008,
        anioNacimientoMax: 2013,
        maxJugadores: 2,
        subCategoria: disc,
      },
    });
  }

  const adaptadosLineales = [
    { nombre: "BASQUET 3X3 ADAPTADO", min: 2010, max: 2014, cupo: 4 },
    { nombre: "GOALBALL", min: 2008, max: 2013, cupo: 6 },
    { nombre: "VOLEIBOL SENTADO", min: 2008, max: 2013, cupo: 8 },
  ];
  for (const al of adaptadosLineales) {
    const disc = await prisma.disciplina.create({
      data: { nombre: al.nombre, tipo: "ADAPTADO" },
    });
    await prisma.pruebaEspecifica.create({
      data: {
        idDisciplina: disc.id,
        nombrePrueba: `${disc.nombre} Unificada`,
        genero: "MIXTO",
        anioNacimientoMin: al.min,
        anioNacimientoMax: al.max,
        maxJugadores: al.cupo,
      },
    });
  }

  console.log(
    "🏁 ¡Base de datos MariaDB poblada y con pesajes máximos validados transaccionalmente!",
  );
  process.exit(0);
}

main().catch((e) => {
  console.error("❌ Error fatal en la ejecución del Seed:", e);
  process.exit(1);
});
