// src/controllers/adminAtletaController.js
//
// Funcionalidad pedida: que el ADMIN pueda cargar atletas a un equipo
// cualquiera, en el mismo flujo que usa el representante desde su panel.
//
// Estrategia: refactor del controlador de equipo para extraer la lógica
// pesada de validación/inserción a una función pura `procesarAltaAtleta`
// que sirve tanto para el flujo EQUIPO (auto-registro) como para el flujo
// ADMIN (sobre cualquier equipo).
//
const prisma = require("../config/db");
const fs = require("fs");
const path = require("path");

// =========================================================================
// HELPERS COPIADOS DEL equipoController.js
// Mantenerlos sincronizados si se actualizan allí.
// =========================================================================

const NATACION_MULTI = ["NATACION NO FEDERADOS", "NATACION PROMOCIONAL"];

const obtenerMaxPruebas = (nombreDisciplina) => {
  const nombre = (nombreDisciplina || "").toUpperCase().trim();
  if (nombre === "ATLETISMO") return 2;
  if (NATACION_MULTI.includes(nombre)) return 6;
  return 1;
};

const validarPesoAltura = (prueba, peso, altura) => {
  if (!prueba?.requierePeso) return { ok: true };

  if (!peso || peso.toString().trim() === "") {
    return {
      ok: false,
      error: `Falta el peso corporal. Es obligatorio para inscribirse en "${prueba.nombrePrueba}".`,
    };
  }

  const pesoIngresado = parseFloat(peso.toString().replace(",", "."));
  if (isNaN(pesoIngresado) || pesoIngresado <= 0) {
    return {
      ok: false,
      error: `El peso ingresado no es válido. Ingresá un número mayor a 0 (en kg).`,
    };
  }

  const pesoMax = prueba.pesoMaximo ? parseFloat(prueba.pesoMaximo) : null;
  let pesoMin = prueba.pesoMinimo ? parseFloat(prueba.pesoMinimo) : 0;

  if (!prueba.pesoMinimo) {
    const rangoMatch = prueba.nombrePrueba.match(
      /(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)/,
    );
    if (rangoMatch) pesoMin = parseFloat(rangoMatch[1]);
    else {
      const minimoMatch = prueba.nombrePrueba.match(/más de (\d+(?:\.\d+)?)/i);
      if (minimoMatch) pesoMin = parseFloat(minimoMatch[1]);
    }
  }

  if (pesoIngresado < pesoMin) {
    return {
      ok: false,
      error: `El peso ingresado (${pesoIngresado} kg) es MENOR al mínimo permitido (${pesoMin} kg) para "${prueba.nombrePrueba}".`,
    };
  }

  if (pesoMax && pesoIngresado > pesoMax) {
    return {
      ok: false,
      error: `El peso ingresado (${pesoIngresado} kg) SUPERA el máximo permitido (${pesoMax} kg) para "${prueba.nombrePrueba}".`,
    };
  }

  if (!altura || altura.toString().trim() === "") {
    return {
      ok: false,
      error: `Falta la altura. Es obligatoria para inscribirse en "${prueba.nombrePrueba}".`,
    };
  }

  const alturaIngresada = parseInt(altura, 10);
  if (
    isNaN(alturaIngresada) ||
    alturaIngresada < 100 ||
    alturaIngresada > 250
  ) {
    return {
      ok: false,
      error: `La altura ingresada (${altura} cm) no es válida. Ingresá un valor realista entre 100 y 250 cm.`,
    };
  }

  return { ok: true, pesoFinal: pesoIngresado, alturaFinal: alturaIngresada };
};

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

const limpiarArchivosMulter = (files) => {
  if (!files) return;
  Object.values(files)
    .flat()
    .forEach((f) => {
      if (f && f.path) {
        try {
          fs.unlinkSync(f.path);
        } catch {
          // El archivo ya no existe o no pudo borrarse; no bloqueamos la respuesta
        }
      }
    });
};

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

// =========================================================================
// NÚCLEO REUTILIZABLE: procesarAltaAtleta({ equipoId, body, files })
// - equipoId viene del token (rol EQUIPO) o de la URL (rol ADMIN)
// - body y files vienen del middleware de multer
// Devuelve { ok: true, jugador } o { ok: false, status, error }
// =========================================================================
const procesarAltaAtleta = async ({ equipoId, body, files }) => {
  const {
    dni,
    nombre,
    apellido,
    fechaNacimiento,
    genero,
    peso,
    altura,
    idPrueba1,
  } = body;

  let pruebasAdicionalesIds = [];
  if (body.pruebasAdicionales) {
    try {
      pruebasAdicionalesIds = JSON.parse(body.pruebasAdicionales);
      if (!Array.isArray(pruebasAdicionalesIds)) pruebasAdicionalesIds = [];
    } catch {
      pruebasAdicionalesIds = [];
    }
  }

  if (!dni || !nombre || !apellido || !fechaNacimiento || !genero) {
    limpiarArchivosMulter(files);
    return {
      ok: false,
      status: 400,
      error: "Todos los datos esenciales del atleta son requeridos.",
    };
  }

  if (!files || !files.dniFrente || !files.dniDorso || !files.fichaMedica) {
    limpiarArchivosMulter(files);
    return {
      ok: false,
      status: 400,
      error:
        "Documentación incompleta. Debe adjuntar los 3 archivos obligatorios.",
    };
  }

  const equipo = await prisma.equipo.findUnique({
    where: { id: equipoId },
    include: { disciplina: true },
  });

  if (!equipo) {
    return {
      ok: false,
      status: 404,
      error: "La delegación indicada no existe.",
    };
  }

  const esAdaptado = equipo.disciplina.tipo === "ADAPTADO";
  if (esAdaptado && (!files.cud || files.cud.length === 0)) {
    return {
      ok: false,
      status: 400,
      error:
        "Inscripción Denegada. El Certificado Único de Discapacidad (CUD) es obligatorio para disciplinas de Deporte Adaptado.",
    };
  }

  const urlDniFrente = `/uploads/documentos/${files.dniFrente[0].filename}`;
  const urlDniDorso = `/uploads/documentos/${files.dniDorso[0].filename}`;
  const urlFichaMedica = `/uploads/documentos/${files.fichaMedica[0].filename}`;
  const urlCud =
    esAdaptado && files.cud
      ? `/uploads/documentos/${files.cud[0].filename}`
      : null;

  const archivosSubidos = [urlDniFrente, urlDniDorso, urlFichaMedica];
  if (urlCud) archivosSubidos.push(urlCud);

  const pruebaTargetId = idPrueba1 ? parseInt(idPrueba1) : null;
  if (!pruebaTargetId) {
    archivosSubidos.forEach(borrarArchivoFisico);
    return {
      ok: false,
      status: 400,
      error: "Debe seleccionar al menos una prueba específica de competencia.",
    };
  }

  const maxPruebas = obtenerMaxPruebas(equipo.disciplina.nombre);
  const idsUnicos = [
    ...new Set([
      pruebaTargetId,
      ...pruebasAdicionalesIds.map((id) => parseInt(id)),
    ]),
  ];

  if (idsUnicos.length > maxPruebas) {
    archivosSubidos.forEach(borrarArchivoFisico);
    return {
      ok: false,
      status: 400,
      error: `Superó el límite de pruebas. Para "${equipo.disciplina.nombre}" puede inscribirse en un máximo de ${maxPruebas} prueba(s).`,
    };
  }

  const pruebasSeleccionadas = await prisma.pruebaEspecifica.findMany({
    where: { id: { in: idsUnicos } },
  });

  if (pruebasSeleccionadas.length !== idsUnicos.length) {
    archivosSubidos.forEach(borrarArchivoFisico);
    return {
      ok: false,
      status: 404,
      error: "Una o más de las categorías seleccionadas no existen.",
    };
  }

  const pruebaFueraDeDisciplina = pruebasSeleccionadas.find(
    (p) => p.idDisciplina !== equipo.idDisciplina,
  );
  if (pruebaFueraDeDisciplina) {
    archivosSubidos.forEach(borrarArchivoFisico);
    return {
      ok: false,
      status: 400,
      error: `La prueba "${pruebaFueraDeDisciplina.nombrePrueba}" no pertenece a la disciplina de su delegación.`,
    };
  }

  const pruebaPrincipal = pruebasSeleccionadas.find(
    (p) => p.id === pruebaTargetId,
  );

  const anioNacimientoAtleta = new Date(fechaNacimiento).getFullYear();
  for (const p of pruebasSeleccionadas) {
    if (
      anioNacimientoAtleta < p.anioNacimientoMin ||
      anioNacimientoAtleta > p.anioNacimientoMax
    ) {
      archivosSubidos.forEach(borrarArchivoFisico);
      return {
        ok: false,
        status: 400,
        error: `Edad no permitida para "${p.nombrePrueba}". El atleta debe haber nacido entre ${p.anioNacimientoMin} y ${p.anioNacimientoMax} (nació en ${anioNacimientoAtleta}).`,
      };
    }
    if (p.genero !== "MIXTO" && p.genero !== genero) {
      archivosSubidos.forEach(borrarArchivoFisico);
      return {
        ok: false,
        status: 400,
        error: `La prueba "${p.nombrePrueba}" es exclusiva de la rama ${p.genero}, no coincide con el género del atleta.`,
      };
    }
  }

  const validacionPeso = validarPesoAltura(pruebaPrincipal, peso, altura);
  if (!validacionPeso.ok) {
    archivosSubidos.forEach(borrarArchivoFisico);
    return { ok: false, status: 400, error: validacionPeso.error };
  }
  const pesoFinal = validacionPeso.pesoFinal ?? null;
  const alturaFinal = validacionPeso.alturaFinal ?? null;

  const nombreDisciplinaActual = equipo.disciplina.nombre.toUpperCase().trim();
  const esDeporteColectivo = deportesEstrictamenteColectivos.includes(
    nombreDisciplinaActual,
  );

  if (esDeporteColectivo) {
    const cantidadActual = await prisma.deportista.count({
      where: { idEquipo: equipo.id, idPrueba: pruebaPrincipal.id },
    });
    if (cantidadActual >= pruebaPrincipal.maxJugadores) {
      archivosSubidos.forEach(borrarArchivoFisico);
      return {
        ok: false,
        status: 400,
        error: `Cupo Máximo Alcanzado. "${pruebaPrincipal.nombrePrueba}" solo admite ${pruebaPrincipal.maxJugadores} jugadores por delegación.`,
      };
    }
  }

  const atletaDuplicadoEnEquipo = await prisma.deportista.findUnique({
    where: { dni_idEquipo: { dni: dni.trim(), idEquipo: equipo.id } },
  });
  if (atletaDuplicadoEnEquipo) {
    archivosSubidos.forEach(borrarArchivoFisico);
    return {
      ok: false,
      status: 400,
      error: "Este deportista ya se encuentra pre-inscripto en su equipo.",
    };
  }

  const idsAdicionales = idsUnicos.filter((id) => id !== pruebaTargetId);

  const deportistaData = {
    dni: dni.trim(),
    nombre: nombre.trim(),
    apellido: apellido.trim(),
    fechaNacimiento: new Date(fechaNacimiento),
    genero: genero,
    deporteAsignado: equipo.disciplina.nombre,
    pesoKg: pesoFinal,
    alturaCm: alturaFinal,
    estado: "PENDIENTE",
    urlDniFrente,
    urlDniDorso,
    urlFichaMedica,
    urlCud,
    equipo: { connect: { id: equipo.id } },
    prueba: { connect: { id: pruebaPrincipal.id } },
  };

  if (idsAdicionales.length > 0) {
    deportistaData.pruebasAdicionales = {
      create: idsAdicionales.map((id) => ({
        prueba: { connect: { id } },
      })),
    };
  }

  const nuevoDeportista = await prisma.deportista.create({
    data: deportistaData,
    include: {
      prueba: true,
      pruebasAdicionales: { include: { prueba: true } },
    },
  });

  return { ok: true, jugador: nuevoDeportista };
};

// =========================================================================
// ENDPOINT: POST /api/admin/agregar-atleta/:idEquipo
// Permite a un ADMIN cargar un atleta a cualquier equipo.
// =========================================================================
const agregarAtletaAEquipo = async (req, res) => {
  const archivosSubidosPaths = [];
  try {
    const { idEquipo } = req.params;

    if (!idEquipo || !idEquipo.startsWith("c")) {
      return res.status(400).json({
        error: "Identificador de equipo inválido.",
      });
    }

    // Cacheamos las rutas para limpieza en caso de fallo a mitad de camino
    if (req.files) {
      Object.values(req.files)
        .flat()
        .forEach((f) => {
          archivosSubidosPaths.push(`/uploads/documentos/${f.filename}`);
        });
    }

    const resultado = await procesarAltaAtleta({
      equipoId: idEquipo,
      body: req.body,
      files: req.files,
    });

    if (!resultado.ok) {
      return res
        .status(resultado.status)
        .json({ error: resultado.error });
    }

    return res.status(201).json({
      mensaje: "Atleta pre-inscripto con éxito (alta realizada por admin).",
      jugador: resultado.jugador,
    });
  } catch (error) {
    console.error("❌ ERROR ADMIN CARGANDO ATLETA:", error);
    archivosSubidosPaths.forEach(borrarArchivoFisico);
    return res
      .status(500)
      .json({ error: "Error interno al procesar el alta." });
  }
};

// =========================================================================
// ENDPOINT: GET /api/admin/pruebas-por-disciplina/:idDisciplina
// Devuelve el catálogo de pruebas específicas filtrado por disciplina.
// Útil para cargar el <select> de pruebas en el formulario admin.
// =========================================================================
const obtenerPruebasPorDisciplina = async (req, res) => {
  try {
    const { idDisciplina } = req.params;
    const id = parseInt(idDisciplina, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: "ID de disciplina inválido." });
    }

    const disciplina = await prisma.disciplina.findUnique({ where: { id } });
    if (!disciplina) {
      return res.status(404).json({ error: "La disciplina no existe." });
    }

    const pruebas = await prisma.pruebaEspecifica.findMany({
      where: { idDisciplina: id },
      orderBy: { nombrePrueba: "asc" },
    });

    return res.status(200).json({
      disciplina: { id: disciplina.id, nombre: disciplina.nombre, tipo: disciplina.tipo },
      pruebas,
    });
  } catch (error) {
    console.error("❌ ERROR AL OBTENER PRUEBAS POR DISCIPLINA:", error);
    return res
      .status(500)
      .json({ error: "No se pudo obtener el catálogo de pruebas." });
  }
};

// =========================================================================
// ENDPOINT: GET /api/admin/equipos-disponibles
// Lista de equipos del sistema (para que el admin elija a cuál cargar atletas).
// =========================================================================
const listarEquiposDisponibles = async (req, res) => {
  try {
    const equipos = await prisma.equipo.findMany({
      select: {
        id: true,
        nombre: true,
        siglas: true,
        municipio: true,
        disciplina: { select: { id: true, nombre: true, tipo: true } },
        usuario: {
          select: { nombre: true, apellido: true, dni: true },
        },
        _count: { select: { deportistas: true } },
      },
      orderBy: { nombre: "asc" },
    });

    return res.status(200).json(equipos);
  } catch (error) {
    console.error("❌ ERROR AL LISTAR EQUIPOS:", error);
    return res
      .status(500)
      .json({ error: "No se pudo obtener el listado de equipos." });
  }
};

module.exports = {
  agregarAtletaAEquipo,
  obtenerPruebasPorDisciplina,
  listarEquiposDisponibles,
  // Exportados por si futuro flujo los reutiliza:
  procesarAltaAtleta,
};