const prisma = require("../config/db");
const fs = require("fs");
const path = require("path");

// =========================================================================
// A. Sincronizar Estado del Panel (Inyectando Catálogo de Disciplinas Macro)
// =========================================================================
const obtenerEstadoPanel = async (req, res) => {
  try {
    const usuarioId = req.usuario?.id || req.query.usuarioId;

    if (!usuarioId) {
      return res
        .status(400)
        .json({ error: "Identificador de usuario ausente." });
    }

    // 1. Traemos todas las pruebas específicas para resolver nombres en el Front
    const pruebasGlobales = await prisma.pruebaEspecifica.findMany({
      include: { disciplina: true },
      orderBy: { nombrePrueba: "asc" },
    });

    // Traemos el catálogo de disciplinas generales que el Front necesita renderizar
    const disciplinasGlobales = await prisma.disciplina.findMany({
      orderBy: { nombre: "asc" },
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

      equipoFormateado = {
        ...miEquipo,
        jugadores: listaJugadoresConPruebas,
      };
    }

    return res.status(200).json({
      disciplinasDisponibles: disciplinasGlobales,
      pruebasDisponibles: pruebasGlobales,
      equipoCargado: equipoFormateado,
    });
  } catch (error) {
    console.error("❌ ERROR EN OBTENER ESTADO PANEL:", error);
    return res
      .status(500)
      .json({ error: "Error al sincronizar datos del panel." });
  }
};

// =========================================================================
// B. Registrar Instancia/Equipo
// =========================================================================
const registrarEquipo = async (req, res) => {
  try {
    const { nombreEquipo, idDisciplina } = req.body;

    const usuarioIdRaw = req.usuario?.id || req.body.usuarioId;
    const usuarioId = parseInt(usuarioIdRaw, 10);

    console.log(
      "DEBUG: usuarioId recibido:",
      usuarioIdRaw,
      " -> convertido:",
      usuarioId,
    );

    if (isNaN(usuarioId)) {
      return res
        .status(401)
        .json({ error: "Token de usuario inválido o ausente." });
    }

    if (!nombreEquipo || !idDisciplina) {
      return res.status(400).json({
        error: "Nombre de equipo e ID de disciplina son obligatorios.",
      });
    }

    const usuario = await prisma.usuario.findUnique({
      where: { id: usuarioId },
      include: { localidad: true },
    });

    if (!usuario) {
      return res.status(404).json({ error: "Representante no encontrado." });
    }

    const equipoExistente = await prisma.equipo.findUnique({
      where: { usuarioId: usuarioId },
    });

    if (equipoExistente) {
      return res
        .status(400)
        .json({ error: "Su cuenta ya posee una delegación registrada." });
    }

    const disciplina = await prisma.disciplina.findUnique({
      where: { id: parseInt(idDisciplina, 10) },
    });

    if (!disciplina) {
      return res.status(404).json({ error: "Disciplina no encontrada." });
    }

    const nombreMunicipio = usuario.localidad?.nombre || "Sin Jurisdicción";
    const siglas = `${nombreEquipo.substring(0, 3).toUpperCase()}_${Math.floor(100 + Math.random() * 900)}`;

    const nuevoEquipo = await prisma.equipo.create({
      data: {
        nombre: nombreEquipo.trim(),
        siglas: siglas,
        municipio: nombreMunicipio,
        idDisciplina: parseInt(idDisciplina, 10),
        usuarioId: usuarioId,
      },
      include: { disciplina: true },
    });

    return res.status(201).json({
      mensaje: `Delegación "${nuevoEquipo.nombre}" registrada correctamente bajo ${nombreMunicipio}.`,
      equipo: nuevoEquipo,
    });
  } catch (error) {
    console.error("❌ ERROR CRÍTICO EN REGISTRAR EQUIPO:", error);
    return res.status(500).json({
      error: "Error interno al procesar el alta.",
      detalle: error.message,
    });
  }
};

// =========================================================================
// C. Registrar Deportista (Soporte CUD y Cupos Ilimitados para Individuales)
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
      return res.status(400).json({
        error: "Todos los datos esenciales del atleta son requeridos.",
      });
    }

    if (
      !req.files ||
      !req.files["dniFrente"] ||
      !req.files["dniDorso"] ||
      !req.files["fichaMedica"]
    ) {
      return res.status(400).json({
        error:
          "Documentación incompleta. Debe adjuntar los 3 archivos obligatorios.",
      });
    }

    const equipo = await prisma.equipo.findUnique({
      where: { usuarioId: parseInt(usuarioId) },
      include: { disciplina: true },
    });

    if (!equipo) {
      if (req.files) {
        Object.values(req.files)
          .flat()
          .forEach((f) => fs.unlinkSync(f.path));
      }
      return res.status(400).json({
        error:
          "Primero debe dar de alta su delegación antes de inscribir atletas.",
      });
    }

    const esAdaptado = equipo.disciplina.tipo === "ADAPTADO";
    if (esAdaptado && (!req.files["cud"] || req.files["cud"].length === 0)) {
      if (req.files) {
        Object.values(req.files)
          .flat()
          .forEach((f) => fs.unlinkSync(f.path));
      }
      return res.status(400).json({
        error:
          "Inscripción Denegada. El Certificado Único de Discapacidad (CUD) es obligatorio para disciplinas de Deporte Adaptado.",
      });
    }

    const urlDniFrente = `/uploads/documentos/${req.files["dniFrente"][0].filename}`;
    const urlDniDorso = `/uploads/documentos/${req.files["dniDorso"][0].filename}`;
    const urlFichaMedica = `/uploads/documentos/${req.files["fichaMedica"][0].filename}`;
    const urlCud =
      esAdaptado && req.files["cud"]
        ? `/uploads/documentos/${req.files["cud"][0].filename}`
        : null;

    archivosSubidos = [urlDniFrente, urlDniDorso, urlFichaMedica];
    if (urlCud) archivosSubidos.push(urlCud);

    const pruebaTargetId = idPrueba1 ? parseInt(idPrueba1) : null;
    if (!pruebaTargetId) {
      archivosSubidos.forEach(borrarArchivoFisico);
      return res.status(400).json({
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
      return res.status(400).json({
        error: `Edad no permitida. Para la prueba "${pruebaEspecifica.nombrePrueba}", el atleta debe haber nacido entre ${pruebaEspecifica.anioNacimientoMin} y ${pruebaEspecifica.anioNacimientoMax} (Año ingresado: ${anioNacimientoAtleta}).`,
      });
    }

    if (pruebaEspecifica.requierePeso) {
      if (!peso || parseFloat(peso) <= 0) {
        archivosSubidos.forEach(borrarArchivoFisico);
        return res.status(400).json({
          error: `El peso corporal es obligatorio para competir en la prueba "${pruebaEspecifica.nombrePrueba}".`,
        });
      }

      const pesoIngresado = parseFloat(peso);
      const pesoMaximoPermitido = parseFloat(pruebaEspecifica.pesoMaximo);
      let pesoMinimoPermitido = 0;

      const rangoPesoMatch = pruebaEspecifica.nombrePrueba.match(
        /(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)/,
      );

      if (rangoPesoMatch) {
        pesoMinimoPermitido = parseFloat(rangoPesoMatch[1]);
      } else if (
        pruebaEspecifica.nombrePrueba.toLowerCase().includes("más de")
      ) {
        const minimoMatch = pruebaEspecifica.nombrePrueba.match(
          /más de (\d+(?:\.\d+)?)/i,
        );
        if (minimoMatch) pesoMinimoPermitido = parseFloat(minimoMatch[1]);
      }

      if (pesoIngresado < pesoMinimoPermitido) {
        archivosSubidos.forEach(borrarArchivoFisico);
        return res.status(400).json({
          error: `Peso insuficiente. El peso mínimo para la categoría "${pruebaEspecifica.nombrePrueba}" es de ${pesoMinimoPermitido} kg (Peso ingresado: ${pesoIngresado} kg).`,
        });
      }

      if (pesoMaximoPermitido && pesoIngresado > pesoMaximoPermitido) {
        archivosSubidos.forEach(borrarArchivoFisico);
        return res.status(400).json({
          error: `Exceso de peso. El peso máximo para la categoría "${pruebaEspecifica.nombrePrueba}" es de ${pesoMaximoPermitido} kg (Peso ingresado: ${pesoIngresado} kg).`,
        });
      }
    }

    // 🚀 FILTRO DE ACCESO DE CUPOS: Abierto e ilimitado para Individuales / Combate
    const deportesEstrictamenteColectivos = [
      "BASQUET 3X3",
      "FUTSAL",
      "HANDBALL",
      "HOCKEY SEVEN",
      "RUGBY 7",
      "VOLEIBOL",
      "VOLEIBOL PLAYA",
      "BASQUET 3X3 ADAPTADO",
      "GOALBALL",
      "VOLEIBOL SENTADO",
    ];

    const nombreDisciplinaActual = equipo.disciplina.nombre
      .toUpperCase()
      .trim();
    const esDeporteColectivo = deportesEstrictamenteColectivos.includes(
      nombreDisciplinaActual,
    );

    if (esDeporteColectivo) {
      const cantidadActual = await prisma.deportista.count({
        where: { idEquipo: equipo.id, idPrueba: pruebaEspecifica.id },
      });

      if (cantidadActual >= pruebaEspecifica.maxJugadores) {
        archivosSubidos.forEach(borrarArchivoFisico);
        return res.status(400).json({
          error: `Cupo Máximo Alcanzado. La modalidad colectiva "${pruebaEspecifica.nombrePrueba}" solo admite un máximo de ${pruebaEspecifica.maxJugadores} jugadores por delegación.`,
        });
      }
    }

    const atletaDuplicadoEnEquipo = await prisma.deportista.findUnique({
      where: { dni_idEquipo: { dni: dni.trim(), idEquipo: equipo.id } },
    });

    if (atletaDuplicadoEnEquipo) {
      archivosSubidos.forEach(borrarArchivoFisico);
      return res.status(400).json({
        error: "Este deportista ya se encuentra pre-inscripto en su equipo.",
      });
    }

    const nuevoDeportista = await prisma.deportista.create({
      data: {
        dni: dni.trim(),
        nombre: nombre.trim(),
        apellido: apellido.trim(),
        fechaNacimiento: new Date(fechaNacimiento),
        genero: genero,
        deporteAsignado: equipo.disciplina.nombre,
        pesoKg: peso ? parseFloat(peso) : null,
        alturaCm: altura ? parseInt(altura) : null,
        estado: "PENDIENTE",
        urlDniFrente: urlDniFrente,
        urlDniDorso: urlDniDorso,
        urlFichaMedica: urlFichaMedica,
        urlCud: urlCud,
        equipo: { connect: { id: equipo.id } },
        prueba: { connect: { id: pruebaEspecifica.id } },
        idPrueba2: idPrueba2 ? parseInt(idPrueba2) : null,
      },
      include: { prueba: true },
    });

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
    return res
      .status(500)
      .json({ error: "Error interno al procesar el alta." });
  }
};

// =========================================================================
// D. Modificar Datos de un Atleta (Limpieza de Binarios Huérfanos Corregida)
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
      if (req.files) {
        Object.values(req.files)
          .flat()
          .forEach((f) => fs.unlinkSync(f.path));
      }
      return res
        .status(404)
        .json({ error: "El atleta especificado no existe." });
    }

    // Mapeo selectivo y condicional de la nueva documentación cargada en el Front
    let nuevosArchivosData = {};

    if (req.files) {
      if (req.files["dniFrente"] && req.files["dniFrente"].length > 0) {
        nuevosArchivosData.urlDniFrente = `/uploads/documentos/${req.files["dniFrente"][0].filename}`;
        borrarArchivoFisico(atletaExistente.urlDniFrente);
      }
      if (req.files["dniDorso"] && req.files["dniDorso"].length > 0) {
        nuevosArchivosData.urlDniDorso = `/uploads/documentos/${req.files["dniDorso"][0].filename}`;
        borrarArchivoFisico(atletaExistente.urlDniDorso);
      }
      if (req.files["fichaMedica"] && req.files["fichaMedica"].length > 0) {
        nuevosArchivosData.urlFichaMedica = `/uploads/documentos/${req.files["fichaMedica"][0].filename}`;
        borrarArchivoFisico(atletaExistente.urlFichaMedica);
      }
      if (req.files["cud"] && req.files["cud"].length > 0) {
        nuevosArchivosData.urlCud = `/uploads/documentos/${req.files["cud"][0].filename}`;
        if (atletaExistente.urlCud) borrarArchivoFisico(atletaExistente.urlCud);
      }
    }

    const pruebaIdValidar = idPrueba1
      ? parseInt(idPrueba1)
      : atletaExistente.idPrueba;
    const pruebaData = await prisma.pruebaEspecifica.findUnique({
      where: { id: pruebaIdValidar },
    });

    if (pruebaData && pruebaData.requierePeso && peso) {
      const pesoIngresado = parseFloat(peso);
      const pesoMax = parseFloat(pruebaData.pesoMaximo);
      let pesoMin = 0;

      const rangoMatch = pruebaData.nombrePrueba.match(
        /(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)/,
      );
      if (rangoMatch) pesoMin = parseFloat(rangoMatch[1]);

      if (pesoIngresado < pesoMin || (pesoMax && pesoIngresado > pesoMax)) {
        if (req.files) {
          Object.values(req.files)
            .flat()
            .forEach((f) => fs.unlinkSync(f.path));
        }
        return res.status(400).json({
          error: `El peso ingresado (${pesoIngresado} kg) no corresponde al rango oficial de la categoría: ${pruebaData.nombrePrueba}.`,
        });
      }
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
        idPrueba2: idPrueba2 ? parseInt(idPrueba2) : null,
        ...nuevosArchivosData,
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
    if (req.files) {
      Object.values(req.files)
        .flat()
        .forEach((f) => fs.unlinkSync(f.path));
    }
    return res
      .status(500)
      .json({ error: "Error interno al modificar la ficha." });
  }
};

// =========================================================================
// E. Dar de Baja Atleta / Eliminar Delegación Falsa por Completo
// =========================================================================
const eliminarJugador = async (req, res) => {
  try {
    const { id } = req.params;
    const esBajaDeEquipoCompleto = id.startsWith("c");

    if (esBajaDeEquipoCompleto) {
      const equipo = await prisma.equipo.findUnique({
        where: { id: id },
        include: { deportistas: true, usuario: true },
      });

      if (!equipo) {
        return res
          .status(404)
          .json({ error: "La delegación que intenta auditar no existe." });
      }

      equipo.deportistas.forEach((atleta) => {
        borrarArchivoFisico(atleta.urlDniFrente);
        borrarArchivoFisico(atleta.urlDniDorso);
        borrarArchivoFisico(atleta.urlFichaMedica);
        if (atleta.urlCud) borrarArchivoFisico(atleta.urlCud);
      });

      if (equipo.usuario) {
        borrarArchivoFisico(equipo.usuario.urlDniFrente);
        borrarArchivoFisico(equipo.usuario.urlDniDorso);
      }

      await prisma.equipo.delete({ where: { id: id } });

      if (equipo.usuarioId) {
        await prisma.usuario.delete({ where: { id: equipo.usuarioId } });
      }

      return res.status(200).json({
        mensaje:
          "Delegación removida de la liga, credenciales liberadas y espacio en disco purgado con éxito.",
      });
    } else {
      const atleta = await prisma.deportista.findUnique({ where: { id } });
      if (!atleta) {
        return res
          .status(404)
          .json({ error: "El atleta que intenta dar de baja no existe." });
      }

      borrarArchivoFisico(atleta.urlDniFrente);
      borrarArchivoFisico(atleta.urlDniDorso);
      borrarArchivoFisico(atleta.urlFichaMedica);
      if (atleta.urlCud) borrarArchivoFisico(atleta.urlCud);

      await prisma.deportista.delete({ where: { id } });

      return res.status(200).json({
        mensaje:
          "Atleta removido del roster provincial y espacio en disco liberado.",
      });
    }
  } catch (error) {
    console.error("❌ ERROR EN ELIMINAR REGISTRO:", error);
    return res
      .status(500)
      .json({ error: "No se pudo procesar la remoción física del elemento." });
  }
};

// =========================================================================
// FUNCIÓN AUXILIAR: Purgado de Binarios
// =========================================================================
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
