const prisma = require("../config/db");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// =========================================================================
// 1. Obtener Árbol Estructurado de Delegaciones (Disciplina -> Municipios -> Equipos)
// =========================================================================
const obtenerArbolDelegaciones = async (req, res) => {
  try {
    // 1. Traemos todos los equipos navegando de manera anidada hasta su localidad real 📍
    const equipos = await prisma.equipo.findMany({
      include: {
        disciplina: true,
        usuario: {
          include: {
            localidad: true,
          },
        },
        deportistas: {
          include: {
            prueba: true, // Carga la prueba física principal si existe
            // 🚀 INCLUSIÓN NATIVA: Mapeamos la tabla asociativa con sus pruebas_especificas
            pruebasAdicionales: {
              include: {
                prueba: true,
              },
            },
          },
          orderBy: { apellido: "asc" },
        },
      },
    });

    // 2. 🔥 AGRUPACIÓN JERÁRQUICA: Disciplina -> Localidades -> Equipos
    const arbolDisciplinas = equipos.reduce((acc, equipo) => {
      if (!equipo.disciplina) return acc;

      const nombreDisciplina = equipo.disciplina.nombre.toUpperCase();

      const nombreLocalidadEstetica =
        equipo.usuario?.localidad?.nombre || "Sin Jurisdicción Asignada";
      const nombreLocalidadKey = nombreLocalidadEstetica.toUpperCase();

      if (!acc[nombreDisciplina]) {
        acc[nombreDisciplina] = {
          idDisciplina: equipo.disciplina.id,
          nombreDisciplina: nombreDisciplina,
          totalAtletas: 0,
          totalPendientes: 0,
          municipios: {},
        };
      }

      if (!acc[nombreDisciplina].municipios[nombreLocalidadKey]) {
        acc[nombreDisciplina].municipios[nombreLocalidadKey] = {
          nombreMunicipio: nombreLocalidadEstetica,
          equipos: [],
        };
      }

      const atletasPendientesEquipo = equipo.deportistas.filter(
        (d) => d.estado === "PENDIENTE",
      ).length;

      acc[nombreDisciplina].totalAtletas += equipo.deportistas.length;
      acc[nombreDisciplina].totalPendientes += atletasPendientesEquipo;

      // Mapeamos los atletas inyectando las pruebas adicionales formateadas para Angular
      const atletasMapeados = equipo.deportistas.map((atleta) => {
        const extras = atleta.pruebasAdicionales || [];

        return {
          ...atleta,
          prueba: atleta.prueba
            ? atleta.prueba
            : { nombrePrueba: equipo.disciplina.nombre },
          // 🚀 Formateamos las pruebas adicionales de manera idéntica al panel de equipos
          pruebasAdicionales: extras.map((e) => ({
            prueba: e.prueba,
          })),
        };
      });

      acc[nombreDisciplina].municipios[nombreLocalidadKey].equipos.push({
        idEquipo: equipo.id,
        nombreEquipo: equipo.nombre,
        atletasCount: atletasMapeados.length,
        atletasPendientes: atletasPendientesEquipo,
        atletas: atletasMapeados,
      });

      return acc;
    }, {});

    // 3. Formateamos los objetos indexados a Arrays limpios para Angular (*ngFor)
    const resultadoFinal = Object.values(arbolDisciplinas).map((disc) => {
      return {
        ...disc,
        municipios: Object.values(disc.municipios),
      };
    });

    return res.status(200).json(resultadoFinal);
  } catch (error) {
    console.error("❌ ERROR CRÍTICO EN OBTENER ÁRBOL ADMIN:", error);
    return res.status(500).json({
      error:
        "Error interno en el servidor al recopilar el catálogo ministerial.",
      detalle: error.message,
    });
  }
};

// =========================================================================
// 2. Dictaminar Estado de Habilitación de un Deportista (Auditoría)
// =========================================================================
const dictaminarAtleta = async (req, res) => {
  try {
    const { id } = req.params;
    const { estado, motivoRechazo } = req.body;

    const dataUpdate = { estado: estado };

    if (estado === "RECHAZADO" && motivoRechazo) {
      dataUpdate.motivoRechazo = motivoRechazo;
    } else if (estado === "APROBADO") {
      dataUpdate.motivoRechazo = null; // Limpiar motivo si es aprobado
    }

    const atletaActualizado = await prisma.deportista.update({
      where: { id: id },
      data: dataUpdate,
    });

    return res
      .status(200)
      .json({ mensaje: "Estado actualizado", atleta: atletaActualizado });
  } catch (error) {
    console.error("Error al dictaminar:", error);
    return res
      .status(500)
      .json({ error: "Error de base de datos", detalle: error.message });
  }
};

// =========================================================================
// 3. Eliminar Delegación desde Auditoría (Purga Completa)
// =========================================================================
const eliminarEquipoPorAuditoria = async (req, res) => {
  try {
    const { idEquipo } = req.params;

    const equipo = await prisma.equipo.findUnique({
      where: { id: idEquipo },
      include: { deportistas: true },
    });

    if (!equipo) {
      return res
        .status(404)
        .json({ error: "La delegación que intenta eliminar no existe." });
    }

    // 🧹 LIMPIEZA DE DISCO FÍSICO: Iteramos y borramos los archivos de todos sus atletas
    equipo.deportistas.forEach((atleta) => {
      borrarArchivoFisico(atleta.urlDniFrente);
      borrarArchivoFisico(atleta.urlDniDorso);
      borrarArchivoFisico(atleta.urlFichaMedica);
      if (atleta.urlCud) borrarArchivoFisico(atleta.urlCud);
    });

    // Borramos el equipo (Prisma elimina los deportistas y relaciones en cascada automáticamente)
    await prisma.equipo.delete({
      where: { id: idEquipo },
    });

    return res.status(200).json({
      mensaje: `La delegación "${equipo.nombre}" fue eliminada del sistema provincial y se liberó el espacio en disco.`,
    });
  } catch (error) {
    console.error("❌ ERROR AL ELIMINAR EQUIPO (ADMIN):", error);
    return res.status(500).json({
      error: "No se pudo procesar la baja de la delegación.",
      detalle: error.message,
    });
  }
};

// =========================================================================
// 4. Listar Municipios con sus Estadísticas de Cuentas y Tokens
// =========================================================================
const obtenerLocalidadesYTokens = async (req, res) => {
  try {
    const localidades = await prisma.localidad.findMany({
      include: {
        usuarios: { where: { rol: "MUNICIPIO" } },
        tokens: true,
      },
      orderBy: { nombre: "asc" },
    });

    const resultado = localidades.map((loc) => ({
      id: loc.id,
      nombre: loc.nombre,
      tipo: loc.tipo,
      tieneCuenta: loc.usuarios.length > 0,
      usernameCuenta: loc.usuarios[0]?.username || null,
      totalTokens: loc.tokens.length,
      tokensDisponibles: loc.tokens.filter((t) => !t.utilizado).length,
    }));

    return res.status(200).json(resultado);
  } catch (error) {
    console.error("❌ ERROR AL OBTENER MUNICIPIOS/TOKENS:", error);
    return res
      .status(500)
      .json({ error: "Error al recuperar el mapa de tokens municipales." });
  }
};

// =========================================================================
// 5. Crear Cuenta Oficial de Rol MUNICIPIO (Lista Blanca Central)
// =========================================================================
const crearUsuarioMunicipio = async (req, res) => {
  try {
    const {
      username,
      password,
      idLocalidad,
      nombreResponsante,
      apellidoResponsante,
      dni,
    } = req.body;

    if (
      !username ||
      !password ||
      !idLocalidad ||
      !nombreResponsante ||
      !apellidoResponsante ||
      !dni
    ) {
      return res
        .status(400)
        .json({ error: "Todos los campos institucionales son obligatorios." });
    }

    const localidadId = parseInt(idLocalidad);

    const cuentaExistente = await prisma.usuario.findFirst({
      where: { idLocalidad: localidadId, rol: "MUNICIPIO" },
    });
    if (cuentaExistente) {
      return res.status(400).json({
        error: "Esta jurisdicción ya posee una cuenta oficial activa.",
      });
    }

    const usernameExistente = await prisma.usuario.findUnique({
      where: { username: username.toLowerCase().trim() },
    });
    if (usernameExistente) {
      return res
        .status(400)
        .json({ error: "El nombre de usuario ya se encuentra ocupado." });
    }

    const bcrypt = require("bcryptjs");
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);

    const nuevoMunicipioUser = await prisma.usuario.create({
      data: {
        username: username.toLowerCase().trim(),
        passwordHash: hash,
        rol: "MUNICIPIO",
        dni: dni.trim(),
        nombre: nombreResponsante.trim(),
        apellido: apellidoResponsante.trim(),
        idLocalidad: localidadId,
      },
    });

    return res.status(201).json({
      mensaje: "Cuenta institucional de Municipio dada de alta con éxito.",
      usuario: {
        id: nuevoMunicipioUser.id,
        username: nuevoMunicipioUser.username,
      },
    });
  } catch (error) {
    console.error("❌ ERROR AL CREAR USUARIO MUNICIPIO:", error);
    return res
      .status(500)
      .json({ error: "Error interno al procesar el alta institucional." });
  }
};

// =========================================================================
// 6. Generar Token Alfanumérico Único de Lista Blanca
// =========================================================================
const generarTokenMunicipio = async (req, res) => {
  try {
    const { idLocalidad } = req.body;
    const localidadId = parseInt(idLocalidad, 10);

    if (!localidadId || isNaN(localidadId)) {
      return res.status(400).json({
        error: "Identificador de localidad inválido o ausente.",
        recibido: idLocalidad,
      });
    }

    const localidadExiste = await prisma.localidad.findUnique({
      where: { id: localidadId },
    });

    if (!localidadExiste) {
      return res.status(444).json({
        error: `La localidad con ID ${localidadId} no existe en el mapa geográfico sembrado.`,
      });
    }

    const caracterPermitido = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    const segmentador = (largo) => {
      let resultado = "";
      for (let i = 0; i < largo; i++) {
        resultado += caracterPermitido[crypto.randomInt(caracterPermitido.length)];
      }
      return resultado;
    };

    // Reintentamos hasta conseguir un token que no colisione con uno existente
    let tokenGenerado;
    do {
      tokenGenerado = `FORJA-${segmentador(4)}-${segmentador(4)}`;
    } while (
      await prisma.tokenInvitacion.findUnique({ where: { token: tokenGenerado } })
    );

    const nuevoToken = await prisma.tokenInvitacion.create({
      data: {
        token: tokenGenerado,
        idLocalidad: localidadId,
        utilizado: false,
      },
    });

    return res.status(201).json({
      mensaje: "Token de Lista Blanca generado con éxito.",
      token: nuevoToken,
    });
  } catch (error) {
    console.log(
      "\n🚨 ==================== ERROR CRÍTICO PRISMA ====================",
    );
    console.error(error);
    console.log(
      "==================================================================\n",
    );

    return res.status(500).json({
      error: "No se pudo emitir el token de invitación en la base de datos.",
      detalle: error.message,
    });
  }
};

// =========================================================================
// 7. Obtener Datos del Delegado/Representante por Equipo
//    - ADMIN: ve cualquier equipo.
//    - MUNICIPIO: solo equipos de su misma localidad.
// =========================================================================
const obtenerDelegadoPorEquipo = async (req, res) => {
  try {
    const { idEquipo } = req.params;
    const rol = req.usuario.rol;
    const localidadDelToken = req.usuario.idLocalidad;

    const equipo = await prisma.equipo.findUnique({
      where: { id: idEquipo },
      include: {
        usuario: {
          select: {
            idLocalidad: true,
            nombre: true,
            apellido: true,
            dni: true,
            urlDniFrente: true,
            urlDniDorso: true,
          },
        },
      },
    });

    if (!equipo || !equipo.usuario) {
      return res.status(404).json({
        error: "No se encontró un representante asociado a esta delegación.",
      });
    }

    if (
      rol === "MUNICIPIO" &&
      equipo.usuario.idLocalidad !== localidadDelToken
    ) {
      return res.status(403).json({
        error: "No tiene jurisdicción sobre esta delegación.",
      });
    }

    return res.status(200).json({
      usuarioResponsable: equipo.usuario,
    });
  } catch (error) {
    console.error("❌ ERROR AL OBTENER DELEGADO:", error);
    return res.status(500).json({
      error: "Error interno al recuperar los datos del representante.",
    });
  }
};

// =========================================================================
// 8. Alta de Club + Usuario Responsable (Asignando Disciplina desde Admin)
// =========================================================================
const crearClubConUsuario = async (req, res) => {
  try {
    const {
      username,
      password,
      idLocalidad,
      nombreRepresentante,
      apellido,
      dniRepresentante,
      idDisciplina,
    } = req.body;

    if (
      !username ||
      !password ||
      !idLocalidad ||
      !nombreRepresentante ||
      !apellido ||
      !dniRepresentante ||
      !idDisciplina
    ) {
      return res
        .status(400)
        .json({ error: "Todos los campos del club son obligatorios." });
    }

    const usernameFormateado = username.toLowerCase().trim();

    const usuarioExistente = await prisma.usuario.findFirst({
      where: {
        OR: [
          { username: usernameFormateado },
          { dni: dniRepresentante.trim() },
        ],
      },
    });
    if (usuarioExistente) {
      const causante =
        usuarioExistente.username === usernameFormateado
          ? "El nombre de usuario"
          : "El DNI";
      return res
        .status(400)
        .json({ error: `${causante} ya se encuentra registrado.` });
    }

    const disciplina = await prisma.disciplina.findUnique({
      where: { id: parseInt(idDisciplina, 10) },
    });
    if (!disciplina) {
      return res.status(404).json({ error: "La disciplina indicada no existe." });
    }

    const localidad = await prisma.localidad.findUnique({
      where: { id: parseInt(idLocalidad, 10) },
    });
    if (!localidad) {
      return res
        .status(404)
        .json({ error: "La jurisdicción indicada no existe." });
    }

    const bcrypt = require("bcryptjs");
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);

    // Generamos un nombre de club a partir del apellido (fallback si el front no lo manda)
    const nombreClub =
      req.body.nombreClub && req.body.nombreClub.toString().trim().length > 0
        ? req.body.nombreClub.toString().trim()
        : `CLUB ${apellido.toUpperCase().trim()}`;

    const resultado = await prisma.$transaction(async (tx) => {
      const nuevoUsuario = await tx.usuario.create({
        data: {
          username: usernameFormateado,
          passwordHash: hash,
          rol: "EQUIPO",
          dni: dniRepresentante.trim(),
          nombre: nombreRepresentante.trim(),
          apellido: apellido.trim(),
          idLocalidad: parseInt(idLocalidad, 10),
          requiereCambioPassword: false,
        },
      });

      const siglas = `${nombreClub.substring(0, 3).toUpperCase()}_${Math.floor(100 + Math.random() * 900)}`;

      const nuevoEquipo = await tx.equipo.create({
        data: {
          nombre: nombreClub,
          siglas,
          municipio: localidad.nombre,
          idDisciplina: parseInt(idDisciplina, 10),
          usuarioId: nuevoUsuario.id,
        },
        include: { disciplina: true },
      });

      return { nuevoUsuario, nuevoEquipo };
    });

    return res.status(201).json({
      mensaje: `Club "${resultado.nuevoEquipo.nombre}" creado y vinculado a ${disciplina.nombre}.`,
      equipo: resultado.nuevoEquipo,
    });
  } catch (error) {
    console.error("❌ ERROR AL CREAR CLUB DESDE ADMIN:", error);
    return res
      .status(500)
      .json({ error: "Error interno al procesar el alta del club." });
  }
};

// =========================================================================
// 9. Listar Equipos por Disciplina separados en Femenino y Masculino
// =========================================================================
const obtenerEquiposPorDisciplinaYRama = async (req, res) => {
  try {
    const { idDisciplina } = req.params;

    const disciplina = await prisma.disciplina.findUnique({
      where: { id: parseInt(idDisciplina, 10) },
    });
    if (!disciplina) {
      return res
        .status(404)
        .json({ error: "La disciplina solicitada no existe." });
    }

    const equipos = await prisma.equipo.findMany({
      where: { idDisciplina: parseInt(idDisciplina, 10) },
      include: {
        disciplina: true,
        usuario: { include: { localidad: true } },
        deportistas: {
          include: {
            prueba: true,
            pruebasAdicionales: {
              include: {
                prueba: true,
              },
            },
          },
          orderBy: { apellido: "asc" },
        },
      },
    });

    const resumen = equipos.map((eq) => {
      const atletas = eq.deportistas || [];
      const femeninos = atletas.filter(
        (a) => (a.genero || "").toUpperCase() === "FEMENINO",
      ).length;
      const masculinos = atletas.filter(
        (a) => (a.genero || "").toUpperCase() === "MASCULINO",
      ).length;
      const mixtos = atletas.filter(
        (a) => (a.genero || "").toUpperCase() === "MIXTO",
      ).length;

      let ramaPrincipal = "MIXTO";
      if (femeninos > 0 && masculinos === 0) ramaPrincipal = "FEMENINO";
      else if (masculinos > 0 && femeninos === 0) ramaPrincipal = "MASCULINO";
      else if (femeninos === 0 && masculinos === 0 && mixtos > 0)
        ramaPrincipal = "MIXTO";

      const atletasMapeados = atletas.map((atleta) => ({
        ...atleta,
        prueba: atleta.prueba
          ? atleta.prueba
          : { nombrePrueba: eq.disciplina?.nombre || "Prueba General" },
        pruebasAdicionales: (atleta.pruebasAdicionales || []).map((e) => ({
          prueba: e.prueba,
        })),
      }));

      return {
        idEquipo: eq.id,
        nombreEquipo: eq.nombre,
        siglas: eq.siglas || "",
        municipio: eq.municipio,
        localidadNombre: eq.usuario?.localidad?.nombre || eq.municipio,
        disciplina: eq.disciplina?.nombre,
        tipoDisciplina: eq.disciplina?.tipo || "CONVENCIONAL",
        representante: eq.usuario
          ? `${eq.usuario.nombre} ${eq.usuario.apellido}`
          : "Sin representante",
        usernameRepresentante: eq.usuario?.username || "",
        dniRepresentante: eq.usuario?.dni || "",
        totalAtletas: atletas.length,
        atletasFemeninos: femeninos,
        atletasMasculinos: masculinos,
        atletasMixtos: mixtos,
        atletasPendientes: atletas.filter((a) => a.estado === "PENDIENTE").length,
        atletasAprobados: atletas.filter((a) => a.estado === "APROBADO").length,
        atletasRechazados: atletas.filter((a) => a.estado === "RECHAZADO").length,
        ramaPrincipal,
        atletas: atletasMapeados,
      };
    });

    return res.status(200).json({
      disciplina: {
        id: disciplina.id,
        nombre: disciplina.nombre,
        tipo: disciplina.tipo,
      },
      equipos: resumen,
    });
  } catch (error) {
    console.error("❌ ERROR AL LISTAR EQUIPOS POR DISCIPLINA:", error);
    return res
      .status(500)
      .json({ error: "No se pudo obtener el desglose por rama." });
  }
};

// =========================================================================
// 10. Listado completo de Disciplinas (Catálogo) para selects de admin
// =========================================================================
const obtenerCatalogoDisciplinas = async (req, res) => {
  try {
    const disciplinas = await prisma.disciplina.findMany({
      orderBy: { nombre: "asc" },
    });
    return res.status(200).json(disciplinas);
  } catch (error) {
    console.error("❌ ERROR AL OBTENER CATÁLOGO DE DISCIPLINAS:", error);
    return res
      .status(500)
      .json({ error: "No se pudo obtener el catálogo de disciplinas." });
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
      if (err) {
        console.error(
          `⚠️ No se pudo eliminar el archivo físico en ${rutaAbsoluta}:`,
          err,
        );
      } else {
        console.log(`🗑️ Archivo purgado con éxito: ${rutaAbsoluta}`);
      }
    });
  }
};

module.exports = {
  obtenerArbolDelegaciones,
  dictaminarAtleta,
  eliminarEquipoPorAuditoria,
  obtenerLocalidadesYTokens,
  crearUsuarioMunicipio,
  generarTokenMunicipio,
  obtenerDelegadoPorEquipo,
  crearClubConUsuario,
  obtenerEquiposPorDisciplinaYRama,
  obtenerCatalogoDisciplinas,
};
