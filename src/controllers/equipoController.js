// src/controllers/equipoController.js
const prisma = require("../config/db");
const fs = require("fs");
const path = require("path");

// =========================================================================
// A. Sincronizar Estado del Panel (Con resolución de nombres de sub-pruebas)
// =========================================================================
const obtenerEstadoPanel = async (req, res) => {
  try {
    const usuarioId = req.usuario?.id || req.query.usuarioId;

    if (!usuarioId) {
      return res
        .status(400)
        .json({ error: "Identificador de usuario ausente." });
    }

    const pruebasGlobales = await prisma.pruebaEspecifica.findMany({
      include: { disciplina: true },
      orderBy: { nombrePrueba: "asc" },
    });

    const miEquipo = await prisma.equipo.findUnique({
      where: { usuarioId: parseInt(usuarioId) },
      include: {
        disciplina: true,
        deportistas: {
          include: { prueba: true },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    let equipoFormateado = null;
    if (miEquipo) {
      // 🚀 RE-MAPEO INTELIGENTE: Traduce el ID de la segunda prueba a su nombre real para Angular
      const listaJugadoresConPruebas = miEquipo.deportistas.map((jugador) => {
        let nombreSegundaPrueba = null;
        if (jugador.idPrueba2) {
          const pruebaEncontrada = pruebasGlobales.find(
            (p) => p.id === jugador.idPrueba2,
          );
          nombreSegundaPrueba = pruebaEncontrada
            ? pruebaEncontrada.nombrePrueba
            : null;
        }
        return {
          ...jugador,
          nombrePrueba2: nombreSegundaPrueba,
        };
      });

      const primeraPrueba = miEquipo.deportistas[0]?.prueba || null;

      equipoFormateado = {
        ...miEquipo,
        jugadores: listaJugadoresConPruebas,
        pruebaEspecifica: primeraPrueba
          ? {
              nombrePrueba: primeraPrueba.nombrePrueba,
              maxJugadores: primeraPrueba.maxJugadores,
            }
          : {
              nombrePrueba: miEquipo.disciplina.nombre,
              maxJugadores: 10,
            },
      };
    }

    return res.status(200).json({
      pruebasDisponibles: pruebasGlobales,
      equipoCargado: equipoFormateado,
    });
  } catch (error) {
    console.error("❌ ERROR EN OBTENER ESTADO PANEL:", error);
    return res.status(500).json({
      error: "Error al sincronizar datos del panel.",
      detalle: error.message,
    });
  }
};

// =========================================================================
// B. Registrar Instancia/Equipo (Estado A del Front)
// =========================================================================
const registrarEquipo = async (req, res) => {
  try {
    const { nombreEquipo, idPrueba } = req.body;
    const usuarioId = req.usuario?.id || req.body.usuarioId;

    if (!nombreEquipo || !idPrueba) {
      return res.status(400).json({
        error:
          "El nombre del equipo y la instancia oficial de competencia son obligatorios.",
      });
    }

    const usuario = await prisma.usuario.findUnique({
      where: { id: parseInt(usuarioId) },
    });
    if (!usuario) {
      return res
        .status(404)
        .json({ error: "El representante de cuenta no existe." });
    }

    const equipoExistente = await prisma.equipo.findUnique({
      where: { usuarioId: parseInt(usuarioId) },
    });
    if (equipoExistente) {
      return res
        .status(400)
        .json({ error: "Su cuenta ya posee una delegación registrada." });
    }

    const pruebaEspecifica = await prisma.pruebaEspecifica.findUnique({
      where: { id: parseInt(idPrueba) },
    });

    if (!pruebaEspecifica) {
      return res
        .status(404)
        .json({ error: "La subcategoría seleccionada no existe." });
    }

    const siglasAutomáticas = nombreEquipo
      .replace(/\s+/g, "")
      .substring(0, 3)
      .toUpperCase();

    const nuevoEquipo = await prisma.equipo.create({
      data: {
        nombre: nombreEquipo.trim(),
        siglas: `${siglasAutomáticas}_${Math.floor(100 + Math.random() * 900)}`,
        municipio: usuario.municipioAsignado || "Sin Municipio",
        idDisciplina: pruebaEspecifica.idDisciplina,
        usuarioId: parseInt(usuarioId),
      },
      include: { disciplina: true },
    });

    return res.status(201).json({
      mensaje: `Equipo configurado con éxito para competir en la instancia oficial.`,
      equipo: nuevoEquipo,
    });
  } catch (error) {
    console.error("❌ ERROR EN REGISTRAR EQUIPO:", error);
    return res.status(500).json({
      error: "Error al procesar el alta de la delegación.",
      detalle: error.message,
    });
  }
};

// =========================================================================
// C. Registrar Deportista con Soporte Multi-Prueba y Antifugas de Disco
// =========================================================================
const registrarJugador = async (req, res) => {
  let archivosSubidos = [];

  try {
    const {
      dni,
      nombre,
      apellido,
      fechaNacimiento,
      genero,
      peso,
      altura,
      idPrueba1,
      idPrueba2,
    } = req.body;
    const usuarioId = req.usuario?.id || req.body.usuarioId;

    if (!dni || !nombre || !apellido || !fechaNacimiento || !genero) {
      return res
        .status(400)
        .json({
          error: "Todos los datos esenciales del atleta son requeridos.",
        });
    }

    if (
      !req.files ||
      !req.files["dniFrente"] ||
      !req.files["dniDorso"] ||
      !req.files["fichaMedica"]
    ) {
      return res
        .status(400)
        .json({
          error:
            "Documentación incompleta. Debe adjuntar los 3 archivos obligatorios.",
        });
    }

    const urlDniFrente = `/uploads/documentos/${req.files["dniFrente"][0].filename}`;
    const urlDniDorso = `/uploads/documentos/${req.files["dniDorso"][0].filename}`;
    const urlFichaMedica = `/uploads/documentos/${req.files["fichaMedica"][0].filename}`;

    archivosSubidos = [urlDniFrente, urlDniDorso, urlFichaMedica];

    const equipo = await prisma.equipo.findUnique({
      where: { usuarioId: parseInt(usuarioId) },
      include: { disciplina: true },
    });

    if (!equipo) {
      archivosSubidos.forEach(borrarArchivoFisico);
      return res
        .status(400)
        .json({
          error:
            "Primero debe dar de alta su delegación antes de inscribir atletas.",
        });
    }

    const pruebaTargetId = idPrueba1 ? parseInt(idPrueba1) : null;
    if (!pruebaTargetId) {
      archivosSubidos.forEach(borrarArchivoFisico);
      return res
        .status(400)
        .json({
          error: "Debe seleccionar una prueba específica de competencia.",
        });
    }

    const pruebaEspecifica = await prisma.pruebaEspecifica.findUnique({
      where: { id: pruebaTargetId },
    });

    if (!pruebaEspecifica) {
      archivosSubidos.forEach(borrarArchivoFisico);
      return res
        .status(404)
        .json({ error: "La categoría seleccionada no existe." });
    }

    const anioNacimientoAtleta = new Date(fechaNacimiento).getFullYear();
    if (
      anioNacimientoAtleta < pruebaEspecifica.anioNacimientoMin ||
      anioNacimientoAtleta > pruebaEspecifica.anioNacimientoMax
    ) {
      archivosSubidos.forEach(borrarArchivoFisico);
      return res
        .status(400)
        .json({
          error: `Inscripción rechazada. Rango de edad inválido para esta categoría.`,
        });
    }

    const cantidadActual = await prisma.deportista.count({
      where: { idEquipo: equipo.id, idPrueba: pruebaEspecifica.id },
    });

    if (cantidadActual >= pruebaEspecifica.maxJugadores) {
      archivosSubidos.forEach(borrarArchivoFisico);
      return res
        .status(400)
        .json({
          error: `Cupo Máximo Alcanzado para la modalidad seleccionada.`,
        });
    }

    const atletaDuplicadoEnEquipo = await prisma.deportista.findUnique({
      where: { dni_idEquipo: { dni: dni.trim(), idEquipo: equipo.id } },
    });

    if (atletaDuplicadoEnEquipo) {
      archivosSubidos.forEach(borrarArchivoFisico);
      return res
        .status(400)
        .json({
          error: "Este deportista ya se encuentra pre-inscripto en su equipo.",
        });
    }

    const participacionesTotales = await prisma.deportista.count({
      where: { dni: dni.trim() },
    });

    if (participacionesTotales >= 2) {
      archivosSubidos.forEach(borrarArchivoFisico);
      return res
        .status(400)
        .json({
          error:
            "El atleta ya alcanzó el límite reglamentario de dos (2) disciplinas.",
        });
    }

    // Insertar con soporte idPrueba2 e inyectar el include relacional 🚀
    const nuevoDeportista = await prisma.deportista.create({
      data: {
        dni: dni.trim(),
        nombre: nombre.trim(),
        apellido: apellido.trim(),
        fechaNacimiento: new Date(fechaNacimiento),
        genero: pruebaEspecifica.genero,
        deporteAsignado: equipo.disciplina.nombre,
        pesoKg: peso ? parseFloat(peso) : null,
        alturaCm: altura ? parseInt(altura) : null,
        estado: "PENDIENTE",
        urlDniFrente: urlDniFrente,
        urlDniDorso: urlDniDorso,
        urlFichaMedica: urlFichaMedica,
        equipo: { connect: { id: equipo.id } },
        prueba: { connect: { id: pruebaEspecifica.id } },
        idPrueba2: idPrueba2 ? parseInt(idPrueba2) : null, // Persistido en el modelo físico
      },
      include: { prueba: true },
    });

    // Resolvemos el nombre de la segunda prueba para el unshift inmediato de Angular
    let nombreSegundaPrueba = null;
    if (nuevoDeportista.idPrueba2) {
      const p2 = await prisma.pruebaEspecifica.findUnique({
        where: { id: nuevoDeportista.idPrueba2 },
      });
      nombreSegundaPrueba = p2 ? p2.nombrePrueba : null;
    }

    return res.status(201).json({
      mensaje: "Atleta pre-inscripto con éxito.",
      jugador: {
        ...nuevoDeportista,
        nombrePrueba2: nombreSegundaPrueba,
      },
    });
  } catch (error) {
    console.error("❌ ERROR CRÍTICO AL INSERTAR: LIMPIANDO DISCO...", error);
    archivosSubidos.forEach(borrarArchivoFisico);

    return res.status(500).json({
      error:
        "Error interno al procesar el alta. Se canceló la subida de archivos.",
      detalle: error.message,
    });
  }
};

// =========================================================================
// D. Modificar Datos de un Atleta (Campos de Texto/Biométricos)
// =========================================================================
const editarJugador = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      dni,
      nombre,
      apellido,
      fechaNacimiento,
      genero,
      peso,
      altura,
      idPrueba1,
      idPrueba2,
    } = req.body;

    const atletaExistente = await prisma.deportista.findUnique({
      where: { id },
    });
    if (!atletaExistente) {
      return res
        .status(404)
        .json({ error: "El atleta especificado no existe." });
    }

    const atletaActualizado = await prisma.deportista.update({
      where: { id },
      data: {
        dni: dni ? dni.trim() : atletaExistente.dni,
        nombre: nombre ? nombre.trim() : atletaExistente.nombre,
        apellido: apellido ? apellido.trim() : atletaExistente.apellido,
        fechaNacimiento: fechaNacimiento
          ? new Date(fechaNacimiento)
          : atletaExistente.fechaNacimiento,
        genero: genero || atletaExistente.genero,
        pesoKg: peso ? parseFloat(peso) : null,
        alturaCm: altura ? parseInt(altura) : null,
        idPrueba: idPrueba1 ? parseInt(idPrueba1) : atletaExistente.idPrueba,
        idPrueba2: idPrueba2 ? parseInt(idPrueba2) : null, // Actualiza o remueve la segunda prueba
      },
      include: { prueba: true },
    });

    let nombreSegundaPrueba = null;
    if (atletaActualizado.idPrueba2) {
      const p2 = await prisma.pruebaEspecifica.findUnique({
        where: { id: atletaActualizado.idPrueba2 },
      });
      nombreSegundaPrueba = p2 ? p2.nombrePrueba : null;
    }

    return res.status(200).json({
      mensaje: "Ficha del deportista modificada con éxito.",
      jugador: {
        ...atletaActualizado,
        nombrePrueba2: nombreSegundaPrueba,
      },
    });
  } catch (error) {
    console.error("❌ ERROR EN EDICIÓN DE ATLETA:", error);
    return res.status(500).json({
      error: "Error interno al modificar la ficha.",
      detalle: error.message,
    });
  }
};

// =========================================================================
// E. Dar de Baja Atleta y Limpiar Disco Físico Automáticamente 🗑️
// =========================================================================
const eliminarJugador = async (req, res) => {
  try {
    const { id } = req.params;

    const atleta = await prisma.deportista.findUnique({ where: { id } });
    if (!atleta) {
      return res
        .status(404)
        .json({ error: "El atleta que intenta dar de baja no existe." });
    }

    borrarArchivoFisico(atleta.urlDniFrente);
    borrarArchivoFisico(atleta.urlDniDorso);
    borrarArchivoFisico(atleta.urlFichaMedica);

    await prisma.deportista.delete({ where: { id } });

    return res.status(200).json({
      mensaje:
        "Atleta removido del roster provincial y espacio en disco liberado.",
    });
  } catch (error) {
    console.error("❌ ERROR EN ELIMINAR ATLETA:", error);
    return res.status(500).json({
      error: "No se pudo procesar la baja del deportista.",
      detalle: error.message,
    });
  }
};

// Helper de borrado físico en el disco
const borrarArchivoFisico = (rutaRelativaWeb) => {
  if (!rutaRelativaWeb) return;
  const rutaAbsoluta = path.join(__dirname, "../../", rutaRelativaWeb);
  if (fs.existsSync(rutaAbsoluta)) {
    fs.unlink(rutaAbsoluta, (err) => {
      if (err)
        console.error(
          `⚠️ No se pudo eliminar el archivo físico en ${rutaAbsoluta}:`,
          err,
        );
    });
  }
};

module.exports = {
  obtenerEstadoPanel,
  registrarEquipo,
  registrarJugador,
  editarJugador,
  eliminarJugador,
};
