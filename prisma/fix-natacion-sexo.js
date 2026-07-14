// prisma/fix-natacion-disciplinas.js
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const prisma = require("../src/config/db");

async function main() {
  console.log("🔄 Sincronizando separación de disciplinas: No Federados vs Promocional...");

  // 1. Aseguramos las DOS disciplinas macro de forma independiente
  const noFederadosDisc = await prisma.disciplina.upsert({
    where: { nombre: "NATACION NO FEDERADOS" },
    update: { tipo: "CONVENCIONAL" },
    create: { nombre: "NATACION NO FEDERADOS", tipo: "CONVENCIONAL" }
  });

  const promocionalDisc = await prisma.disciplina.upsert({
    where: { nombre: "NATACION PROMOCIONAL" },
    update: { tipo: "CONVENCIONAL" },
    create: { nombre: "NATACION PROMOCIONAL", tipo: "CONVENCIONAL" }
  });

  // Nombres de las pruebas base sin género
  const pruebasCompetitivas = ["50m Libre Competitivo", "100m Libres Competitivo", "50m Espalda Competitivo", "50m Pecho Competitivo", "50m Mariposa Competitivo", "Relevo 4x50m Libre Competitivo"];
  const pruebasPromocionales = ["25m Libres Promocional Sub 11", "25m Espalda Promocional Sub 11", "25m Mariposa Promocional Sub 11", "50m Libres Promocional Sub 11", "50m Pecho Promocional Sub 11", "100m Libres Promocional Sub 11"];
  
  const ramas = [
    { sufijo: "Masc", enumGenero: "MASCULINO" },
    { sufijo: "Fem", enumGenero: "FEMENINO" }
  ];

  // 2. Inyectamos pruebas en NATACION NO FEDERADOS (Sub 15 | Cupo: 5)
  for (const p of pruebasCompetitivas) {
    for (const r of ramas) {
      const nombreFinal = `${p} ${r.sufijo}`;
      
      const existe = await prisma.pruebaEspecifica.findFirst({
        where: { nombrePrueba: nombreFinal, idDisciplina: noFederadosDisc.id }
      });

      if (existe) {
        await prisma.pruebaEspecifica.update({
          where: { id: existe.id },
          data: { genero: r.enumGenero, anioNacimientoMin: 2011, anioNacimientoMax: 2013, maxJugadores: 5 }
        });
      } else {
        await prisma.pruebaEspecifica.create({
          data: {
            idDisciplina: noFederadosDisc.id,
            nombrePrueba: nombreFinal,
            genero: r.enumGenero,
            anioNacimientoMin: 2011,
            anioNacimientoMax: 2013,
            maxJugadores: 5
          }
        });
      }
    }
  }
  console.log("✅ Pruebas asignadas a la disciplina 'NATACION NO FEDERADOS'.");

  // 3. Inyectamos pruebas en la nueva 'NATACION PROMOCIONAL' (Sub 11 | Cupo: Ilimitado)
  for (const p of pruebasPromocionales) {
    for (const r of ramas) {
      const nombreFinal = `${p} ${r.sufijo}`;
      
      const existe = await prisma.pruebaEspecifica.findFirst({
        where: { nombrePrueba: nombreFinal, idDisciplina: promocionalDisc.id }
      });

      if (existe) {
        await prisma.pruebaEspecifica.update({
          where: { id: existe.id },
          data: { genero: r.enumGenero, anioNacimientoMin: 2015, anioNacimientoMax: 2016, maxJugadores: 999 }
        });
      } else {
        await prisma.pruebaEspecifica.create({
          data: {
            idDisciplina: promocionalDisc.id,
            nombrePrueba: nombreFinal,
            genero: r.enumGenero,
            anioNacimientoMin: 2015,
            anioNacimientoMax: 2016,
            maxJugadores: 999
          }
        });
      }
    }
  }
  console.log("✅ Pruebas asignadas a la nueva disciplina 'NATACION PROMOCIONAL'.");

  console.log("\n🏁 Sincronización exitosa: Ambas disciplinas quedaron separadas e indexadas por sexo.");
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
