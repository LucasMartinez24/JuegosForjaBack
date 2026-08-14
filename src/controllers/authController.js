// src/controllers/authController.js
const prisma = require("../config/db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// 🚀 REQUERIDOS: Módulos nativos para interactuar de forma segura con el disco rígido
const fs = require("fs");
const path = require("path");

// =========================================================================
// 1. REGISTRO DE CLUBES/EQUIPOS (CON CONTROL DE DNI Y ANTIFUGAS EN DISCO)
// =========================================================================
exports.register = async (req, res) => {
  let archivosRepresentante = [];

  try {
    const {
      username,
      password,
      nombreRepresentante,
      apellido,
      idLocalidad,
      dniRepresentante,
    } = req.body;

    // 1. Validar que vengan los campos requeridos
    if (
      !username ||
      !password ||
      !nombreRepresentante ||
      !apellido ||
      !idLocalidad ||
      !dniRepresentante
    ) {
      if (req.files)
        Object.values(req.files)
          .flat()
          .forEach((f) => fs.unlinkSync(f.path));
      return res
        .status(400)
        .json({ error: "Todos los campos de texto son obligatorios." });
    }

    // 2. Validar que el Front envíe obligatoriamente los DNI cargados
    if (!req.files || !req.files["dniFrente"] || !req.files["dniDorso"]) {
      if (req.files)
        Object.values(req.files)
          .flat()
          .forEach((f) => fs.unlinkSync(f.path));
      return res.status(400).json({
        error: "Debe adjuntar el Frente y Dorso del DNI del Representante.",
      });
    }

    const usernameFormateado = username.toLowerCase().trim();

    // 3. Control de duplicación
    const usuarioExistente = await prisma.usuario.findFirst({
      where: {
        OR: [
          { username: usernameFormateado },
          { dni: dniRepresentante.trim() },
        ],
      },
    });

    if (usuarioExistente) {
      Object.values(req.files)
        .flat()
        .forEach((f) => fs.unlinkSync(f.path));
      const causante =
        usuarioExistente.username === usernameFormateado
          ? "El nombre de usuario"
          : "El DNI";
      return res
        .status(400)
        .json({ error: `${causante} ya se encuentra registrado.` });
    }

    // Mapeamos rutas físicas de almacenamiento
    const urlDniFrente = `/uploads/documentos/${req.files["dniFrente"][0].filename}`;
    const urlDniDorso = `/uploads/documentos/${req.files["dniDorso"][0].filename}`;
    archivosRepresentante = [urlDniFrente, urlDniDorso];

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);

    // 4. Inserción directa
    const nuevoUsuario = await prisma.usuario.create({
      data: {
        username: usernameFormateado,
        passwordHash: hash,
        rol: "EQUIPO",
        dni: dniRepresentante.trim(),
        nombre: nombreRepresentante.trim(),
        apellido: apellido.trim(),
        idLocalidad: parseInt(idLocalidad, 10),
        requiereCambioPassword: false, // Entran directo con su clave autogestionada
        urlDniFrente: urlDniFrente,
        urlDniDorso: urlDniDorso,
      },
    });

    return res.status(201).json({
      mensaje:
        "Usuario delegado registrado y documentación enlazada correctamente.",
      usuario: { id: nuevoUsuario.id, username: nuevoUsuario.username },
    });
  } catch (error) {
    console.error("❌ ERROR CRÍTICO EN REGISTRO DE REPRESENTANTE:", error);

    // Antifugas de archivos en disco si explota Prisma al insertar
    archivosRepresentante.forEach((ruta) => {
      if (ruta) {
        const rutaAbs = path.join(__dirname, "../../", ruta);
        if (fs.existsSync(rutaAbs)) fs.unlinkSync(rutaAbs);
      }
    });
    return res
      .status(500)
      .json({ error: "Error interno al procesar el alta del representante." });
  }
};

// =========================================================================
// 2. LOGIN (CON DETECTOR DE PRIMER INICIO DE SESIÓN PARA ADMIN Y MUNICIPIO)
// =========================================================================
exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res
        .status(400)
        .json({ error: "Nombre de usuario y contraseña requeridos." });
    }

    const usuario = await prisma.usuario.findUnique({
      where: { username: username.toLowerCase().trim() },
      include: { localidad: true },
    });

    if (!usuario) {
      return res.status(401).json({ error: "Credenciales inválidas." });
    }

    const passwordValido = await bcrypt.compare(password, usuario.passwordHash);
    if (!passwordValido) {
      return res.status(401).json({ error: "Credenciales inválidas." });
    }

    // Fail-closed: sin JWT_SECRET no se emiten tokens
    if (!process.env.JWT_SECRET) {
      return res
        .status(500)
        .json({ error: "Configuración del servidor incompleta (JWT_SECRET)." });
    }

    // Firmamos el token JWT tradicional
    const token = jwt.sign(
      {
        id: usuario.id,
        rol: usuario.rol,
        idLocalidad: usuario.idLocalidad,
      },
      process.env.JWT_SECRET,
      { expiresIn: "8h" },
    );

    // 🚀 CONTROL CLAVE: Si es ADMIN o MUNICIPIO y es su primer login, notificamos al Front
    const debeCambiarClave =
      (usuario.rol === "ADMIN" || usuario.rol === "MUNICIPIO") &&
      usuario.requiereCambioPassword;

    return res.status(200).json({
      token,
      debeCambiarClave, // Interceptado por Angular para forzar la redirección
      usuario: {
        id: usuario.id,
        username: usuario.username,
        rol: usuario.rol,
        dni: usuario.dni,
        idLocalidad: usuario.idLocalidad,
        localidadNombre: usuario.localidad?.nombre || "Sin Localidad",
      },
    });
  } catch (error) {
    console.error("❌ ERROR EN LOGIN:", error);
    return res.status(500).json({
      error: "Error en el servidor al autenticar.",
      detalle: error.message,
    });
  }
};

// =========================================================================
// 3. NUEVO ENDPOINT: PERMITIR ACTUALIZAR LA CONTRASEÑA POR PRIMERA VEZ
// =========================================================================
exports.actualizarPasswordPrimerLogin = async (req, res) => {
  try {
    const { nuevaPassword } = req.body;
    const usuarioId = req.usuario.id; // Inyectado desde el token por el middleware de seguridad

    if (!nuevaPassword || nuevaPassword.length < 6) {
      return res.status(400).json({
        error: "La nueva contraseña debe tener un mínimo de 6 caracteres.",
      });
    }

    const salt = await bcrypt.genSalt(10);
    const nuevoHash = await bcrypt.hash(nuevaPassword, salt);

    // Actualizamos la clave y liberamos la cuenta
    await prisma.usuario.update({
      where: { id: usuarioId },
      data: {
        passwordHash: nuevoHash,
        requiereCambioPassword: false, // El bloqueo se apaga de forma definitiva
      },
    });

    return res.status(200).json({
      mensaje:
        "Contraseña actualizada de forma exitosa. Su cuenta ha sido activada.",
    });
  } catch (error) {
    console.error("❌ ERROR AL ACTUALIZAR PASSWORD:", error);
    return res.status(500).json({
      error: "Error interno al intentar guardar la nueva contraseña.",
    });
  }
};
