// src/controllers/adminController.js
const prisma = require("../config/db");

// =========================================================================
// 1. Obtener Árbol Estructurado de Delegaciones (Disciplina -> Municipios -> Equipos)
// =========================================================================
// src/controllers/adminController.js

const obtenerArbolDelegaciones = async (req, res) => {
  try {
    // 1. Traemos todos los equipos navegando de manera anidada hasta su localidad real 📍
    const equipos = await prisma.equipo.findMany({
      include: {
        disciplina: true,
        // 🚀 SOLUCIÓN: Pasamos por usuario e incluimos su localidad asignada en el registro
        usuario: {
          include: {
            localidad: true,
          },
        },
        deportistas: {
          include: {
            prueba: true, // Trae la prueba física si existe
          },
          orderBy: { apellido: "asc" },
        },
      },
    });

    // 2. 🔥 AGRUPACIÓN JERÁRQUICA: Disciplina -> Localidades -> Equipos
    const arbolDisciplinas = equipos.reduce((acc, equipo) => {
      if (!equipo.disciplina) return acc;

      const nombreDisciplina = equipo.disciplina.nombre.toUpperCase();

      // 🚀 CAPTURA SEGURA: Extraemos el nombre de la localidad navegando por el puente del usuario
      const nombreLocalidadEstetica =
        equipo.usuario?.localidad?.nombre || "Sin Jurisdicción Asignada";
      const nombreLocalidadKey = nombreLocalidadEstetica.toUpperCase();

      // Si la disciplina macro no existe en el acumulador, la creamos
      if (!acc[nombreDisciplina]) {
        acc[nombreDisciplina] = {
          nombreDisciplina: nombreDisciplina,
          totalAtletas: 0,
          totalPendientes: 0,
          municipios: {},
        };
      }

      // Si el municipio/comisión no existe dentro de esta disciplina, lo inicializamos
      if (!acc[nombreDisciplina].municipios[nombreLocalidadKey]) {
        acc[nombreDisciplina].municipios[nombreLocalidadKey] = {
          nombreMunicipio: nombreLocalidadEstetica, // Conserva mayúsculas estéticas (ej: "Abra Pampa")
          equipos: [],
        };
      }

      const atletasPendientesEquipo = equipo.deportistas.filter(
        (d) => d.estado === "PENDIENTE",
      ).length;

      // Sumamos métricas a la disciplina macro
      acc[nombreDisciplina].totalAtletas += equipo.deportistas.length;
      acc[nombreDisciplina].totalPendientes += atletasPendientesEquipo;

      // Inyección anti-fallos por si la modalidad viene nula en deportes colectivos
      const atletasMapeados = equipo.deportistas.map((atleta) => {
        return {
          ...atleta,
          prueba: atleta.prueba
            ? atleta.prueba
            : { nombrePrueba: equipo.disciplina.nombre },
        };
      });

      // Insertamos el roster del club en el casillero municipal correspondiente usando la clave limpia
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
    const { estado } = req.body;

    // 🚀 CAMBIO CRÍTICO: Si tu ID es CUID (string), NO uses parseInt.
    // Usa el ID tal cual llega de la URL.
    const atletaActualizado = await prisma.deportista.update({
      where: { id: id }, // ID recibido directo del parámetro
      data: { estado: estado },
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
// src/controllers/adminController.js -> Agregar al final

const eliminarEquipoPorAuditoria = async (req, res) => {
  try {
    const { idEquipo } = req.params;

    // 1. Buscamos el equipo junto con todos sus deportistas antes de borrar
    const equipo = await prisma.equipo.findUnique({
      where: { id: idEquipo },
      include: { deportistas: true },
    });

    if (!equipo) {
      return res
        .status(404)
        .json({ error: "La delegación que intenta eliminar no existe." });
    }

    // 2. 🧹 LIMPIEZA DE DISCO FISCO: Iteramos y borramos los archivos de todos sus atletas
    equipo.deportistas.forEach((atleta) => {
      borrarArchivoFisico(atleta.urlDniFrente);
      borrarArchivoFisico(atleta.urlDniDorso);
      borrarArchivoFisico(atleta.urlFichaMedica);
      if (atleta.urlCud) borrarArchivoFisico(atleta.urlCud);
    });

    // 3. Borramos el equipo (Prisma elimina los deportistas en cascada automáticamente)
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
// 3. Listar Municipios con sus Estadísticas de Cuentas y Tokens
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
// 4. Crear Cuenta Oficial de Rol MUNICIPIO (Lista Blanca Central)
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

    // Validar si la localidad ya posee un usuario asignado
    const cuentaExistente = await prisma.usuario.findFirst({
      where: { idLocalidad: localidadId, rol: "MUNICIPIO" },
    });
    if (cuentaExistente) {
      return res.status(400).json({
        error: "Esta jurisdicción ya posee una cuenta oficial activa.",
      });
    }

    // Validar duplicado de username general
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
        rol: "MUNICIPIO", // <-- ROL CONFIGURADO NATIVAMENTE
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
// 5. Generar Token Alfanumérico Único de Lista Blanca
// =========================================================================
const generarTokenMunicipio = async (req, res) => {
  try {
    const { idLocalidad } = req.body;

    // 1. Forzar parsing numérico estricto
    const localidadId = parseInt(idLocalidad, 10);

    if (!localidadId || isNaN(localidadId)) {
      return res.status(400).json({
        error: "Identificador de localidad inválido o ausente.",
        recibido: idLocalidad,
      });
    }

    // 2. Controlar físicamente la existencia de la localidad en MariaDB
    const localidadExiste = await prisma.localidad.findUnique({
      where: { id: localidadId },
    });

    if (!localidadExiste) {
      return res.status(444).json({
        error: `La localidad con ID ${localidadId} no existe en el mapa geográfico sembrado.`,
      });
    }

    // 3. Generador de Token Premium: FORJA-XXXX-XXXX
    const caracterPermitido = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    const segmentador = (largo) =>
      Array.from(
        { length: largo }, // <-- CORREGIDO: Usar 'length' nativo en lugar de objeto 'largo'
        () =>
          caracterPermitido[
            Math.floor(Math.random() * caracterPermitido.length)
          ],
      ).join("");

    const tokenGenerado = `FORJA-${segmentador(4)}-${segmentador(4)}`;

    // 4. Inserción transaccional limpia
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
    // 🚀 LOG DETALLADO EXPLICITO: Esto va a obligar a tu terminal a cantar el error exacto
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
const obtenerDelegadoPorEquipo = async (req, res) => {
  try {
    const { idEquipo } = req.params;

    // Buscamos el equipo pero incluyendo los campos exactos del usuario responsable
    const equipo = await prisma.equipo.findUnique({
      where: { id: idEquipo },
      select: {
        usuario: {
          select: {
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

    // Retornamos el formato exacto que tu HTML está esperando leer (usuarioResponsable)
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
const borrarArchivoFisico = (rutaRelativaWeb) => {
  if (!rutaRelativaWeb) return;

  // Requerimos path y fs de forma segura si no los tenías arriba
  const fs = require("fs");
  const path = require("path");

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
// No olvides exportarlos al final de tu archivo:
module.exports = {
  obtenerArbolDelegaciones,
  dictaminarAtleta,
  eliminarEquipoPorAuditoria,
  obtenerLocalidadesYTokens, // <-- Agregar
  crearUsuarioMunicipio, // <-- Agregar
  generarTokenMunicipio,
  obtenerDelegadoPorEquipo, // <-- Agregar
};
