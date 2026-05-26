// src/controllers/municipioController.js
const prisma = require("../config/db");

/**
 * 1. Obtener el árbol de delegaciones locales del municipio
 * Filtra los equipos registrados por usuarios que pertenezcan a la localidad de la sesión.
 */
const obtenerArbolMunicipio = async (req, res) => {
  try {
    const { idLocalidad } = req.usuario; // Inyectado por el middleware de autenticación

    if (!idLocalidad) {
      return res.status(403).json({
        error: "El usuario no tiene una jurisdicción municipal asignada.",
      });
    }

    // Buscamos los equipos mapeados con el esquema físico real
    const equipos = await prisma.equipo.findMany({
      where: {
        usuario: {
          idLocalidad: idLocalidad,
        },
      },
      include: {
        disciplina: true,
        deportistas: {
          include: {
            prueba: true,
          },
          orderBy: {
            apellido: "asc",
          },
        },
      },
    });

    // Procesamos y agrupamos los datos estructurados para los acordeones del Front
    const arbolDisciplinas = equipos.reduce((acc, eq) => {
      if (!eq.disciplina) return acc;

      const nombreDisc = eq.disciplina.nombre.toUpperCase();

      if (!acc[nombreDisc]) {
        acc[nombreDisc] = {
          nombreDisciplina: nombreDisc,
          totalAtletas: 0,
          totalPendientes: 0,
          municipios: [
            {
              nombreMunicipio: "Inscripciones Locales",
              equipos: [],
            },
          ],
        };
      }

      const pendientes = eq.deportistas.filter(
        (d) => d.estado === "PENDIENTE",
      ).length;

      acc[nombreDisc].totalAtletas += eq.deportistas.length;
      acc[nombreDisc].totalPendientes += pendientes;

      acc[nombreDisc].municipios[0].equipos.push({
        idEquipo: eq.id,
        nombreEquipo: eq.nombre,
        siglas: eq.siglas,
        atletas: eq.deportistas.map((a) => ({
          id: a.id,
          dni: a.dni,
          nombre: a.nombre,
          apellido: a.apellido,
          genero: a.genero,
          estado: a.estado,
          urlDniFrente: a.urlDniFrente,
          urlDniDorso: a.urlDniDorso,
          urlFichaMedica: a.urlFichaMedica,
          urlCud: a.urlCud,
          pruebaNombre: a.prueba?.nombrePrueba || eq.disciplina.nombre,
        })),
      });

      return acc;
    }, {});

    return res.status(200).json(Object.values(arbolDisciplinas));
  } catch (error) {
    console.error("❌ ERROR EN ARBOL MUNICIPIO:", error);
    return res
      .status(500)
      .json({ error: "Error interno al procesar el árbol de delegaciones." });
  }
};

/**
 * 2. Obtener el historial de tokens generados por este municipio
 */
const obtenerTokensPropios = async (req, res) => {
  try {
    const { idLocalidad } = req.usuario;

    if (!idLocalidad) {
      return res.status(403).json({
        error: "Identificador de localidad no encontrado en la sesión.",
      });
    }

    const tokens = await prisma.tokenInvitacion.findMany({
      where: {
        idLocalidad: parseInt(idLocalidad, 10), // 🚀 Forzamos que sea un entero para MySQL
      },
      orderBy: { createdAt: "desc" },
    });

    return res.status(200).json(tokens);
  } catch (error) {
    console.error("❌ ERROR EN OBTENER TOKENS LOCALES:", error);
    return res
      .status(500)
      .json({ error: "Error al recuperar las claves de lista blanca." });
  }
};

/**
 * 3. Generar un nuevo token de lista blanca de manera local
 */
const generarTokenLocal = async (req, res) => {
  try {
    const { idLocalidad } = req.usuario;

    if (!idLocalidad) {
      return res
        .status(403)
        .json({ error: "Jurisdicción no válida en la sesión." });
    }

    // Generamos un hash seguro corto (Ej: FORJA-A4B9)
    const codigoToken = `FORJA-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    const nuevoToken = await prisma.tokenInvitacion.create({
      data: {
        token: codigoToken,
        idLocalidad: idLocalidad,
        utilizado: false,
      },
    });

    return res.status(201).json(nuevoToken);
  } catch (error) {
    console.error("❌ ERROR AL EMITIR TOKEN LOCAL:", error);
    return res
      .status(500)
      .json({ error: "Error interno al generar clave de inscripción." });
  }
};
const dictaminarAtletaLocal = async (req, res) => {
  try {
    const { id } = req.params; // ID del atleta enviado en la URL
    const { estado } = req.body; // 'APROBADO' o 'RECHAZADO'
    const { idLocalidad } = req.usuario; // Localidad del coordinador logueado

    if (!["APROBADO", "RECHAZADO"].includes(estado)) {
      return res.status(400).json({ error: "Estado de dictamen no válido." });
    }

    // Verificación de seguridad: El municipio SOLO puede dictaminar atletas de su propia jurisdicción
    const atleta = await prisma.deportista.findUnique({
      where: { id: id },
      include: {
        equipo: {
          include: { usuario: true },
        },
      },
    });

    if (!atleta || atleta.equipo.usuario.idLocalidad !== idLocalidad) {
      return res
        .status(403)
        .json({
          error:
            "Acceso denegado. Este atleta pertenece a otra jurisdicción municipal.",
        });
    }

    // Impactamos el cambio en la base de datos
    const atletaActualizado = await prisma.deportista.update({
      where: { id: id },
      data: { estado: estado },
    });

    return res
      .status(200)
      .json({
        mensaje: `Atleta dictaminado como ${estado} con éxito.`,
        atletaActualizado,
      });
  } catch (error) {
    console.error("❌ ERROR AL DICTAMINAR MUNICIPIO:", error);
    return res
      .status(500)
      .json({ error: "Error interno al procesar el dictamen de la ficha." });
  }
};

// NO TE OLVIDES DE AGREGARLO AL MODULE.EXPORTS DEL ARCHIVO:
module.exports = {
  obtenerArbolMunicipio,
  obtenerTokensPropios,
  generarTokenLocal,
  dictaminarAtletaLocal, // 🚀 Agregado
};
