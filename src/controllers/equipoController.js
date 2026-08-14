const prisma = require("../config/db");
const fs = require("fs");
const path = require("path");

// =========================================================================
// AUX: Determina cuántas pruebas puede elegir un deportista según disciplina
// =========================================================================
const NATACION_MULTI = ["NATACION NO FEDERADOS", "NATACION PROMOCIONAL"];

const obtenerMaxPruebas = (nombreDisciplina) => {
  const nombre = (nombreDisciplina || "").toUpperCase().trim();
  if (nombre === "ATLETISMO") return 2;
  if (NATACION_MULTI.includes(nombre)) return 6;
  return 1;
};

// =========================================================================
// AUX: Valida peso/altura con mensajes específicos y accionables
// =========================================================================
const validarPesoAltura = (prueba, peso, altura) => {
  // La disciplina NO exige peso: aun así, si se cargó peso/altura los
  // validamos y guardamos (campos opcionales pero persistibles).
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
      error: `El peso ingresado (${pesoIngresado} kg) es MENOR al mínimo permitido (${pesoMin} kg) para "${prueba.nombrePrueba}". Verificá la categoría de peso correcta.`,
    };
  }

  if (pesoMax && pesoIngresado > pesoMax) {
    return {
      ok: false,
      error: `El peso ingresado (${pesoIngresado} kg) SUPERA el máximo permitido (${pesoMax} kg) para "${prueba.nombrePrueba}". Verificá la categoría de peso correcta.`,
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

// =========================================================================
// 1. Sincronizar Estado del Panel (Inyectando Catálogo de Disciplinas Macro)
// =========================================================================
const obtenerEstadoPanel = async (req, res) => {
  try {
    // SEGURIDAD: el id de usuario SIEMPRE sale del token, jamás del query string.
    const usuarioId = req.usuario.id;

    if (!usuarioId) {
      return res
        .status(401)
        .json({ error: "Token sin identificador de usuario." });
    }

    const pruebasGlobales = await prisma.pruebaEspecifica.findMany({
      include: { disciplina: true },
      orderBy: { nombrePrueba: "asc" },
    });

    const disciplinasGlobales = await prisma.disciplina.findMany({
      orderBy: { nombre: "asc" },
    });

    const miEquipo = await prisma.equipo.findUnique({
      where: { usuarioId: parseInt(usuarioId) },
      include: {
        disciplina: true,
        deportistas: {
          include: {
            prueba: true,
            pruebasAdicionales: {
              include: {
                prueba: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    let equipoFormateado = null;
    if (miEquipo) {
      const listaJugadoresConPruebas = miEquipo.deportistas.map((jugador) => {
        const adicionales = jugador.pruebasAdicionales || [];
        const nombreSegundaPrueba =
          adicionales[0]?.prueba?.nombrePrueba || null;
        const idPrueba2 =
          adicionales[0]?.idPrueba || adicionales[0]?.id_prueba || null;

        return {
          ...jugador,
          idPrueba2: idPrueba2,
          nombrePrueba2: nombreSegundaPrueba,
          pruebasAdicionales: adicionales.map((ad) => ({
            idPrueba: ad.idPrueba || ad.id_prueba,
            prueba: ad.prueba,
          })),
          listaPruebasCompletas: adicionales.map(
            (ad) => ad.prueba,
          ),
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
// 2. Registrar Instancia/Equipo
// =========================================================================
const registrarEquipo = async (req, res) => {
  try {
    const { nombreEquipo, idDisciplina } = req.body;
    // SEGURIDAD: usuarioId solo del token.
    const usuarioId = parseInt(req.usuario.id, 10);

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
// 3. Registrar Deportista (Soporte CUD y Pruebas Adicionales Múltiples)
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
    } = req.body;

    let pruebasAdicionalesIds = [];
    if (req.body.pruebasAdicionales) {
      try {
        pruebasAdicionalesIds = JSON.parse(req.body.pruebasAdicionales);
        if (!Array.isArray(pruebasAdicionalesIds)) pruebasAdicionalesIds = [];
      } catch {
        pruebasAdicionalesIds = [];
      }
    }

    // SEGURIDAD: usuarioId solo del token (se mantiene en req.body como fallback
    // porque multer puede requerirlo en algún flujo, pero el front nunca debería
    // enviarlo).
    const usuarioId = req.usuario.id;

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
      // Antifuga: si el usuario subió 1 o 2 archivos, los borramos del disco
      if (req.files)
        Object.values(req.files)
          .flat()
          .forEach((f) => fs.unlinkSync(f.path));
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
      if (req.files)
        Object.values(req.files)
          .flat()
          .forEach((f) => fs.unlinkSync(f.path));
      return res.status(400).json({
        error:
          "Primero debe dar de alta su delegación antes de inscribir atletas.",
      });
    }

    const esAdaptado = equipo.disciplina.tipo === "ADAPTADO";
    if (esAdaptado && (!req.files["cud"] || req.files["cud"].length === 0)) {
      if (req.files)
        Object.values(req.files)
          .flat()
          .forEach((f) => fs.unlinkSync(f.path));
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
        error:
          "Debe seleccionar al menos una prueba específica de competencia.",
      });
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
      return res.status(400).json({
        error: `Superó el límite de pruebas. Para "${equipo.disciplina.nombre}" puede inscribirse en un máximo de ${maxPruebas} prueba(s).`,
      });
    }

    const pruebasSeleccionadas = await prisma.pruebaEspecifica.findMany({
      where: { id: { in: idsUnicos } },
    });

    if (pruebasSeleccionadas.length !== idsUnicos.length) {
      archivosSubidos.forEach(borrarArchivoFisico);
      return res.status(404).json({
        error: "Una o más de las categorías seleccionadas no existen.",
      });
    }

    const pruebaFueraDeDisciplina = pruebasSeleccionadas.find(
      (p) => p.idDisciplina !== equipo.idDisciplina,
    );
    if (pruebaFueraDeDisciplina) {
      archivosSubidos.forEach(borrarArchivoFisico);
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
        archivosSubidos.forEach(borrarArchivoFisico);
        return res.status(400).json({
          error: `Edad no permitida para "${p.nombrePrueba}". El atleta debe haber nacido entre ${p.anioNacimientoMin} y ${p.anioNacimientoMax} (nació en ${anioNacimientoAtleta}).`,
        });
      }
      if (p.genero !== "MIXTO" && p.genero !== genero) {
        archivosSubidos.forEach(borrarArchivoFisico);
        return res.status(400).json({
          error: `La prueba "${p.nombrePrueba}" es exclusiva de la rama ${p.genero}, no coincide con el género del atleta.`,
        });
      }
    }

    const validacionPeso = validarPesoAltura(pruebaPrincipal, peso, altura);
    if (!validacionPeso.ok) {
      archivosSubidos.forEach(borrarArchivoFisico);
      return res.status(400).json({ error: validacionPeso.error });
    }
    const pesoFinal = validacionPeso.pesoFinal ?? null;
    const alturaFinal = validacionPeso.alturaFinal ?? null;

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
        where: { idEquipo: equipo.id, idPrueba: pruebaPrincipal.id },
      });
      if (cantidadActual >= pruebaPrincipal.maxJugadores) {
        archivosSubidos.forEach(borrarArchivoFisico);
        return res.status(400).json({
          error: `Cupo Máximo Alcanzado. "${pruebaPrincipal.nombrePrueba}" solo admite ${pruebaPrincipal.maxJugadores} jugadores por delegación.`,
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
        pruebasAdicionales: {
          include: { prueba: true },
        },
      },
    });

    return res.status(201).json({
      mensaje: "Atleta pre-inscripto con éxito.",
      jugador: nuevoDeportista,
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
// 4. Modificar Datos de un Atleta (Edición de Roster y Sincronización)
// =========================================================================
const editarJugador = async (req, res) => {
  let nuevosArchivosParaRemover = [];
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

    let pruebasAdicionalesIds = [];
    if (req.body.pruebasAdicionales) {
      try {
        pruebasAdicionalesIds = JSON.parse(req.body.pruebasAdicionales);
        if (!Array.isArray(pruebasAdicionalesIds)) pruebasAdicionalesIds = [];
      } catch {
        pruebasAdicionalesIds = [];
      }
    }

    const atletaExistente = await prisma.deportista.findUnique({
      where: { id },
      include: { equipo: { include: { disciplina: true } } },
    });

    if (!atletaExistente) {
      if (req.files)
        Object.values(req.files)
          .flat()
          .forEach((f) => fs.unlinkSync(f.path));
      return res
        .status(404)
        .json({ error: "El atleta especificado no existe." });
    }

    let nuevosArchivosData = {};

    if (req.files) {
      if (req.files["dniFrente"] && req.files["dniFrente"].length > 0) {
        nuevosArchivosData.urlDniFrente = `/uploads/documentos/${req.files["dniFrente"][0].filename}`;
        nuevosArchivosParaRemover.push(atletaExistente.urlDniFrente);
      }
      if (req.files["dniDorso"] && req.files["dniDorso"].length > 0) {
        nuevosArchivosData.urlDniDorso = `/uploads/documentos/${req.files["dniDorso"][0].filename}`;
        nuevosArchivosParaRemover.push(atletaExistente.urlDniDorso);
      }
      if (req.files["fichaMedica"] && req.files["fichaMedica"].length > 0) {
        nuevosArchivosData.urlFichaMedica = `/uploads/documentos/${req.files["fichaMedica"][0].filename}`;
        nuevosArchivosParaRemover.push(atletaExistente.urlFichaMedica);
      }
      if (req.files["cud"] && req.files["cud"].length > 0) {
        nuevosArchivosData.urlCud = `/uploads/documentos/${req.files["cud"][0].filename}`;
        if (atletaExistente.urlCud)
          nuevosArchivosParaRemover.push(atletaExistente.urlCud);
      }
    }

    const pruebaTargetId = idPrueba1
      ? parseInt(idPrueba1)
      : atletaExistente.idPrueba;
    const maxPruebas = obtenerMaxPruebas(
      atletaExistente.equipo.disciplina.nombre,
    );
    const idsUnicos = [
      ...new Set([
        pruebaTargetId,
        ...pruebasAdicionalesIds.map((id) => parseInt(id)),
      ]),
    ];

    if (idsUnicos.length > maxPruebas) {
      if (req.files)
        Object.values(req.files)
          .flat()
          .forEach((f) => fs.unlinkSync(f.path));
      return res.status(400).json({
        error: `Superó el límite de pruebas. Para "${atletaExistente.equipo.disciplina.nombre}" puede inscribirse en un máximo de ${maxPruebas} prueba(s).`,
      });
    }

    const pruebasSeleccionadas = await prisma.pruebaEspecifica.findMany({
      where: { id: { in: idsUnicos } },
    });

    if (pruebasSeleccionadas.length !== idsUnicos.length) {
      if (req.files)
        Object.values(req.files)
          .flat()
          .forEach((f) => fs.unlinkSync(f.path));
      return res.status(404).json({
        error: "Una o más de las categorías seleccionadas no existen.",
      });
    }

    const pruebaFueraDeDisciplina = pruebasSeleccionadas.find(
      (p) => p.idDisciplina !== atletaExistente.equipo.idDisciplina,
    );
    if (pruebaFueraDeDisciplina) {
      if (req.files)
        Object.values(req.files)
          .flat()
          .forEach((f) => fs.unlinkSync(f.path));
      return res.status(400).json({
        error: `La prueba "${pruebaFueraDeDisciplina.nombrePrueba}" no pertenece a la disciplina de su delegación.`,
      });
    }

    const pruebaPrincipal = pruebasSeleccionadas.find(
      (p) => p.id === pruebaTargetId,
    );

    const anioNacimientoAtleta = new Date(
      fechaNacimiento || atletaExistente.fechaNacimiento,
    ).getFullYear();
    const generoEvaluar = genero || atletaExistente.genero;
    for (const p of pruebasSeleccionadas) {
      if (
        anioNacimientoAtleta < p.anioNacimientoMin ||
        anioNacimientoAtleta > p.anioNacimientoMax
      ) {
        if (req.files)
          Object.values(req.files)
            .flat()
            .forEach((f) => fs.unlinkSync(f.path));
        return res.status(400).json({
          error: `Edad no permitida para "${p.nombrePrueba}". El atleta debe haber nacido entre ${p.anioNacimientoMin} y ${p.anioNacimientoMax} (nació en ${anioNacimientoAtleta}).`,
        });
      }
      if (p.genero !== "MIXTO" && p.genero !== generoEvaluar) {
        if (req.files)
          Object.values(req.files)
            .flat()
            .forEach((f) => fs.unlinkSync(f.path));
        return res.status(400).json({
          error: `La prueba "${p.nombrePrueba}" es exclusiva de rama ${p.genero}, no coincide con el género del atleta.`,
        });
      }
    }

    const validacionPeso = validarPesoAltura(pruebaPrincipal, peso, altura);
    if (!validacionPeso.ok) {
      if (req.files)
        Object.values(req.files)
          .flat()
          .forEach((f) => fs.unlinkSync(f.path));
      return res.status(400).json({ error: validacionPeso.error });
    }
    const pesoFinal = validacionPeso.pesoFinal ?? null;
    const alturaFinal = validacionPeso.alturaFinal ?? null;

    const idsAdicionales = idsUnicos.filter((id) => id !== pruebaTargetId);

    const atletaActualizado = await prisma.$transaction(async (tx) => {
      // 🚀 CORREGIDO: Usamos el argumento exacto del modelo nativo: id_deportista
      await tx.deportistaPruebaAdicional.deleteMany({
        where: { idDeportista: id },
      });

      // 🚀 CORREGIDO: Usamos id_deportista e id_prueba en el createMany relacional nativo
      if (idsAdicionales.length > 0) {
        await tx.deportistaPruebaAdicional.createMany({
          data: idsAdicionales.map((idPrueba) => ({
            idDeportista: id,
            idPrueba: idPrueba,
          })),
        });
      }

      return await tx.deportista.update({
        where: { id },
        data: {
          dni: dni ? dni.trim() : atletaExistente.dni,
          nombre: nombre ? nombre.trim() : atletaExistente.nombre,
          apellido: apellido ? apellido.trim() : atletaExistente.apellido,
          fechaNacimiento: fechaNacimiento
            ? new Date(fechaNacimiento)
            : atletaExistente.fechaNacimiento,
          genero: genero || atletaExistente.genero,
          pesoKg: pesoFinal,
          alturaCm: alturaFinal,
          idPrueba: pruebaTargetId,
          estado: "PENDIENTE",
          ...nuevosArchivosData,
        },
        include: {
          prueba: true,
          pruebasAdicionales: {
            include: { prueba: true },
          },
        },
      });
    });

    nuevosArchivosParaRemover.forEach(borrarArchivoFisico);

    return res.status(200).json({
      mensaje:
        "Ficha modificada con éxito. El estado retornó a PENDIENTE para re-auditoría.",
      jugador: atletaActualizado,
    });
  } catch (error) {
    console.error("❌ ERROR EN EDICIÓN DE ATLETA:", error);
    if (req.files)
      Object.values(req.files)
        .flat()
        .forEach((f) => fs.unlinkSync(f.path));
    return res
      .status(500)
      .json({ error: "Error interno al modificar la ficha." });
  }
};

// =========================================================================
// 5. Dar de Baja Atleta / Eliminar Delegación Completa
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
