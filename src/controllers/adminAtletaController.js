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
  // La disciplina NO exige peso: aun así, si el operador cargó peso/altura
  // los validamos y guardamos (campos opcionales pero persistibles).
  if (!prueba?.requierePeso) {
    let pesoFinal = null;
    let alturaFinal = null;

    if (peso && peso.toString().trim() !== "") {
      const p = parseFloat(peso.toString().replace(",", "."));
      if (isNaN(p) || p <= 0) {
        return {
          ok: false,
          error: `El peso ingresado (${peso}) no es válido. Ingresá un número mayor a 0 (en kg).`,
        };
      }
      pesoFinal = p;
    }

    if (altura && altura.toString().trim() !== "") {
      const a = parseInt(altura, 10);
      if (isNaN(a) || a < 100 || a > 250) {
        return {
          ok: false,
          error: `La altura ingresada (${altura} cm) no es válida. Ingresá un valor realista entre 100 y 250 cm.`,
        };
      }
      alturaFinal = a;
    }

    return { ok: true, pesoFinal, alturaFinal };
  }

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

  // La documentación es OPCIONAL cuando el alta la realiza un ADMIN.
  // Los representantes la siguen cargando a través de su propio flujo.
  const urlDniFrente = files?.dniFrente?.length
    ? `/uploads/documentos/${files.dniFrente[0].filename}`
    : null;
  const urlDniDorso = files?.dniDorso?.length
    ? `/uploads/documentos/${files.dniDorso[0].filename}`
    : null;
  const urlFichaMedica = files?.fichaMedica?.length
    ? `/uploads/documentos/${files.fichaMedica[0].filename}`
    : null;
  const urlCud = files?.cud?.length
    ? `/uploads/documentos/${files.cud[0].filename}`
    : null;

  const archivosSubidos = [urlDniFrente, urlDniDorso, urlFichaMedica, urlCud].filter(
    Boolean,
  );

  const equipo = await prisma.equipo.findUnique({
    where: { id: equipoId },
    include: { disciplina: true },
  });

  if (!equipo) {
    archivosSubidos.forEach(borrarArchivoFisico);
    return {
      ok: false,
      status: 404,
      error: "La delegación indicada no existe.",
    };
  }

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

// =========================================================================
// ENDPOINT: PUT /api/admin/actualizar-atleta/:id
// Edita los datos y las pruebas de un atleta SIN reemplazar su documentación.
// Re-valida las mismas reglas que el alta (edad, género, peso, cupo, pruebas).
// El atleta conserva su equipo y su disciplina.
// =========================================================================
const actualizarAtleta = async (req, res) => {
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
    } = req.body;

    if (!dni || !nombre || !apellido || !fechaNacimiento || !genero) {
      return res.status(400).json({
        error: "Todos los datos esenciales del atleta son requeridos.",
      });
    }

    const atleta = await prisma.deportista.findUnique({
      where: { id },
      include: { equipo: { include: { disciplina: true } } },
    });
    if (!atleta) {
      return res.status(404).json({ error: "El atleta indicado no existe." });
    }
    const equipo = atleta.equipo;

    const pruebaTargetId = idPrueba1 ? parseInt(idPrueba1, 10) : null;
    if (!pruebaTargetId) {
      return res.status(400).json({
        error: "Debe seleccionar al menos una prueba específica de competencia.",
      });
    }

    let pruebasAdicionalesIds = [];
    if (req.body.pruebasAdicionales) {
      if (Array.isArray(req.body.pruebasAdicionales)) {
        pruebasAdicionalesIds = req.body.pruebasAdicionales;
      } else {
        try {
          const parsed = JSON.parse(req.body.pruebasAdicionales);
          if (Array.isArray(parsed)) pruebasAdicionalesIds = parsed;
        } catch {
          pruebasAdicionalesIds = [];
        }
      }
    }

    const maxPruebas = obtenerMaxPruebas(equipo.disciplina.nombre);
    const idsUnicos = [
      ...new Set([
        pruebaTargetId,
        ...pruebasAdicionalesIds.map((idP) => parseInt(idP, 10)),
      ]),
    ];

    if (idsUnicos.length > maxPruebas) {
      return res.status(400).json({
        error: `Superó el límite de pruebas. Para "${equipo.disciplina.nombre}" puede inscribirse en un máximo de ${maxPruebas} prueba(s).`,
      });
    }

    const pruebasSeleccionadas = await prisma.pruebaEspecifica.findMany({
      where: { id: { in: idsUnicos } },
    });

    if (pruebasSeleccionadas.length !== idsUnicos.length) {
      return res.status(404).json({
        error: "Una o más de las categorías seleccionadas no existen.",
      });
    }

    const pruebaFueraDeDisciplina = pruebasSeleccionadas.find(
      (p) => p.idDisciplina !== equipo.idDisciplina,
    );
    if (pruebaFueraDeDisciplina) {
      return res.status(400).json({
        error: `La prueba "${pruebaFueraDeDisciplina.nombrePrueba}" no pertenece a la disciplina de su delegación.`,
      });
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
        return res.status(400).json({
          error: `Edad no permitida para "${p.nombrePrueba}". El atleta debe haber nacido entre ${p.anioNacimientoMin} y ${p.anioNacimientoMax} (nació en ${anioNacimientoAtleta}).`,
        });
      }
      if (p.genero !== "MIXTO" && p.genero !== genero) {
        return res.status(400).json({
          error: `La prueba "${p.nombrePrueba}" es exclusiva de la rama ${p.genero}, no coincide con el género del atleta.`,
        });
      }
    }

    const validacionPeso = validarPesoAltura(pruebaPrincipal, peso, altura);
    if (!validacionPeso.ok) {
      return res.status(400).json({ error: validacionPeso.error });
    }
    const pesoFinal = validacionPeso.pesoFinal ?? null;
    const alturaFinal = validacionPeso.alturaFinal ?? null;

    const nombreDisciplinaActual = equipo.disciplina.nombre.toUpperCase().trim();
    const esDeporteColectivo = deportesEstrictamenteColectivos.includes(
      nombreDisciplinaActual,
    );

    if (
      esDeporteColectivo &&
      pruebaPrincipal.id !== atleta.idPrueba
    ) {
      const cantidadActual = await prisma.deportista.count({
        where: { idEquipo: equipo.id, idPrueba: pruebaPrincipal.id },
      });
      if (cantidadActual >= pruebaPrincipal.maxJugadores) {
        return res.status(400).json({
          error: `Cupo Máximo Alcanzado. "${pruebaPrincipal.nombrePrueba}" solo admite ${pruebaPrincipal.maxJugadores} jugadores por delegación.`,
        });
      }
    }

    const atletaDuplicadoEnEquipo = await prisma.deportista.findFirst({
      where: { dni: dni.trim(), idEquipo: equipo.id, NOT: { id } },
    });
    if (atletaDuplicadoEnEquipo) {
      return res.status(400).json({
        error: "Este deportista ya se encuentra pre-inscripto en su equipo.",
      });
    }

    const idsAdicionales = idsUnicos.filter((idP) => idP !== pruebaTargetId);

    const atletaActualizado = await prisma.$transaction(async (tx) => {
      await tx.deportistaPruebaAdicional.deleteMany({
        where: { idDeportista: id },
      });

      const dataUpdate = {
        dni: dni.trim(),
        nombre: nombre.trim(),
        apellido: apellido.trim(),
        fechaNacimiento: new Date(fechaNacimiento),
        genero,
        pesoKg: pesoFinal,
        alturaCm: alturaFinal,
        idPrueba: pruebaPrincipal.id,
      };

      if (req.files?.dniFrente?.length) {
        if (atleta.urlDniFrente) borrarArchivoFisico(atleta.urlDniFrente);
        dataUpdate.urlDniFrente = `/uploads/documentos/${req.files.dniFrente[0].filename}`;
      }
      if (req.files?.dniDorso?.length) {
        if (atleta.urlDniDorso) borrarArchivoFisico(atleta.urlDniDorso);
        dataUpdate.urlDniDorso = `/uploads/documentos/${req.files.dniDorso[0].filename}`;
      }
      if (req.files?.fichaMedica?.length) {
        if (atleta.urlFichaMedica) borrarArchivoFisico(atleta.urlFichaMedica);
        dataUpdate.urlFichaMedica = `/uploads/documentos/${req.files.fichaMedica[0].filename}`;
      }
      if (req.files?.cud?.length) {
        if (atleta.urlCud) borrarArchivoFisico(atleta.urlCud);
        dataUpdate.urlCud = `/uploads/documentos/${req.files.cud[0].filename}`;
      }

      if (idsAdicionales.length > 0) {
        dataUpdate.pruebasAdicionales = {
          create: idsAdicionales.map((idP) => ({
            prueba: { connect: { id: idP } },
          })),
        };
      }

      return tx.deportista.update({
        where: { id },
        data: dataUpdate,
        include: {
          prueba: true,
          pruebasAdicionales: { include: { prueba: true } },
        },
      });
    });

    return res.status(200).json({
      mensaje: "Atleta actualizado con éxito.",
      atleta: atletaActualizado,
    });
  } catch (error) {
    console.error("❌ ERROR AL ACTUALIZAR ATLETA (ADMIN):", error);
    return res
      .status(500)
      .json({ error: "Error interno al actualizar el atleta." });
  }
};

// =========================================================================
// ENDPOINT: DELETE /api/admin/eliminar-atleta/:id
// Baja lógica-física de un atleta: elimina el registro, sus pruebas
// adicionales (en cascada) y los archivos de documentación del disco.
// =========================================================================
const eliminarAtleta = async (req, res) => {
  try {
    const { id } = req.params;

    const atleta = await prisma.deportista.findUnique({ where: { id } });
    if (!atleta) {
      return res
        .status(404)
        .json({ error: "El atleta que intenta eliminar no existe." });
    }

    borrarArchivoFisico(atleta.urlDniFrente);
    borrarArchivoFisico(atleta.urlDniDorso);
    borrarArchivoFisico(atleta.urlFichaMedica);
    if (atleta.urlCud) borrarArchivoFisico(atleta.urlCud);

    await prisma.deportista.delete({ where: { id } });

    return res.status(200).json({
      mensaje: `El atleta "${atleta.apellido}, ${atleta.nombre}" fue eliminado del sistema.`,
    });
  } catch (error) {
    console.error("❌ ERROR AL ELIMINAR ATLETA (ADMIN):", error);
    return res
      .status(500)
      .json({ error: "Error interno al eliminar el atleta." });
  }
};

// =========================================================================
// ENDPOINT: GET /api/admin/atleta/:id
// Devuelve la ficha COMPLETA de un atleta (datos + prueba + adicionales +
// equipo/disciplina). Lo usa el modal de edición para pre-cargar TODO,
// evitando depender de los datos parciales que trae el árbol/grilla.
// =========================================================================
const obtenerAtletaDetalle = async (req, res) => {
  try {
    const { id } = req.params;

    const atleta = await prisma.deportista.findUnique({
      where: { id },
      include: {
        prueba: true,
        pruebasAdicionales: { include: { prueba: true } },
        equipo: {
          include: {
            disciplina: true,
            usuario: { include: { localidad: true } },
          },
        },
      },
    });

    if (!atleta) {
      return res.status(404).json({ error: "El atleta indicado no existe." });
    }

    return res.status(200).json({
      ...atleta,
      prueba: atleta.prueba || {
        nombrePrueba: atleta.equipo?.disciplina?.nombre || "Prueba General",
      },
      pruebasAdicionales: (atleta.pruebasAdicionales || []).map((e) => ({
        prueba: e.prueba,
      })),
      equipo: atleta.equipo
        ? {
            idEquipo: atleta.equipo.id,
            nombreEquipo: atleta.equipo.nombre,
            siglas: atleta.equipo.siglas,
            municipio: atleta.equipo.municipio,
            disciplina: atleta.equipo.disciplina?.nombre || null,
            idDisciplina: atleta.equipo.idDisciplina,
            tipoDisciplina: atleta.equipo.disciplina?.tipo || "CONVENCIONAL",
            localidadNombre:
              atleta.equipo.usuario?.localidad?.nombre ||
              atleta.equipo.municipio,
          }
        : null,
    });
  } catch (error) {
    console.error("❌ ERROR AL OBTENER DETALLE DE ATLETA:", error);
    return res
      .status(500)
      .json({ error: "No se pudo recuperar la ficha del atleta." });
  }
};

module.exports = {
  agregarAtletaAEquipo,
  obtenerPruebasPorDisciplina,
  listarEquiposDisponibles,
  actualizarAtleta,
  eliminarAtleta,
  obtenerAtletaDetalle,
  // Exportados por si futuro flujo los reutiliza:
  procesarAltaAtleta,
};