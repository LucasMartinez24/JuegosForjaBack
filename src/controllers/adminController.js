// src/controllers/adminController.js
const prisma = require("../config/db");

// =========================================================================
// 1. Obtener Árbol Estructurado de Delegaciones (Municipio -> Disciplinas -> Atletas)
// =========================================================================
const obtenerArbolDelegaciones = async (req, res) => {
  try {
    // 1. Traemos todos los equipos con sus atletas y sub-pruebas vinculadas
    const equipos = await prisma.equipo.findMany({
      include: {
        disciplina: true,
        deportistas: {
          include: { prueba: true },
          orderBy: { apellido: "asc" },
        },
      },
    });

    // 2. 🔥 AGRUPACIÓN JERÁRQUICA INVERSA: Disciplina -> Municipios -> Equipos
    const arbolDisciplinas = equipos.reduce((acc, equipo) => {
      const nombreDisciplina = equipo.disciplina.nombre.toUpperCase();
      const nombreMunicipio = equipo.municipio.toUpperCase();

      // Si la disciplina macro no existe en el acumulador, la creamos
      if (!acc[nombreDisciplina]) {
        acc[nombreDisciplina] = {
          nombreDisciplina: nombreDisciplina,
          totalAtletas: 0,
          totalPendientes: 0,
          municipios: {},
        };
      }

      // Si el municipio no existe dentro de esta disciplina, lo inicializamos
      if (!acc[nombreDisciplina].municipios[nombreMunicipio]) {
        acc[nombreDisciplina].municipios[nombreMunicipio] = {
          nombreMunicipio: equipo.municipio, // Mantiene capitalización estética
          equipos: [],
        };
      }

      const atletasPendientesEquipo = equipo.deportistas.filter(
        (d) => d.estado === "PENDIENTE",
      ).length;

      // Sumamos métricas a la disciplina macro
      acc[nombreDisciplina].totalAtletas += equipo.deportistas.length;
      acc[nombreDisciplina].totalPendientes += atletasPendientesEquipo;

      // Insertamos el roster del club en el casillero municipal correspondiente
      acc[nombreDisciplina].municipios[nombreMunicipio].equipos.push({
        idEquipo: equipo.id,
        nombreEquipo: equipo.nombre,
        atletasCount: equipo.deportistas.length,
        atletasPendientes: atletasPendientesEquipo,
        atletas: equipo.deportistas,
      });

      return acc;
    }, {});

    // 3. Formateamos los objetos indexados a Arrays limpios para que Angular los itere con *ngFor
    const resultadoFinal = Object.values(arbolDisciplinas).map((disc) => {
      return {
        ...disc,
        municipios: Object.values(disc.municipios), // Convierte los municipios indexados a array
      };
    });

    return res.status(200).json(resultadoFinal);
  } catch (error) {
    console.error("❌ ERROR EN OBTENER ÁRBOL ADMIN:", error);
    return res
      .status(500)
      .json({ error: "Error al recopilar el catálogo ministerial." });
  }
};

// =========================================================================
// 2. Dictaminar Estado de Habilitación de un Deportista (Auditoría)
// =========================================================================
const dictaminarAtleta = async (req, res) => {
  try {
    const { id } = req.params;
    const { estado } = req.body; // Viene 'APROBADO' o 'RECHAZADO'

    if (!["APROBADO", "RECHAZADO"].includes(estado)) {
      return res
        .status(400)
        .json({ error: "Dictamen inválido reglamentariamente." });
    }

    const atletaActualizado = await prisma.deportista.update({
      where: { id },
      data: { estado },
      include: { prueba: true },
    });

    return res.status(200).json({
      mensaje: `El atleta ha sido marcado como ${estado} con éxito.`,
      jugador: atletaActualizado,
    });
  } catch (error) {
    console.error("❌ ERROR EN DICTAMINAR ATLETA:", error);
    return res
      .status(500)
      .json({ error: "No se pudo impactar el dictamen ministerial." });
  }
};

module.exports = {
  obtenerArbolDelegaciones,
  dictaminarAtleta,
};
