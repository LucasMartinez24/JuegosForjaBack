// src/controllers/authController.js
const prisma = require("../config/db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// src/controllers/authController.js -> Reemplazar bloque register

exports.register = async (req, res) => {
  try {
    const {
      username,
      password,
      nombreRepresentante,
      apellido,
      idLocalidad, // <-- Ahora recibimos el ID numérico relacional
      dniRepresentante,
      tokenInvitacion, // <-- Exigimos el token de lista blanca
    } = req.body;

    if (
      !username ||
      !password ||
      !nombreRepresentante ||
      !apellido ||
      !idLocalidad ||
      !dniRepresentante ||
      !tokenInvitacion
    ) {
      return res.status(400).json({
        error:
          "Todos los campos, incluyendo el Token de Lista Blanca, son requeridos.",
      });
    }

    // 1. 🛡️ FILTRO DE LISTA BLANCA DE TOKENS
    const tokenValido = await prisma.tokenInvitacion.findFirst({
      where: {
        token: tokenInvitacion.trim(),
        idLocalidad: parseInt(idLocalidad),
        utilizado: false,
      },
    });

    if (!tokenValido) {
      return res.status(403).json({
        error:
          "El Token de invitación es inválido, ya fue utilizado o no corresponde a la localidad seleccionada.",
      });
    }

    const usernameFormateado = username.toLowerCase().trim();

    // 2. Control de duplicados tradicionales
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

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);

    // 3. Crear el usuario enlazando la localidad de la BD y quemando el token
    const nuevoUsuario = await prisma.$transaction(async (tx) => {
      // Marcamos el token como usado para que nadie más pueda meterse con esa clave
      await tx.tokenInvitacion.update({
        where: { id: tokenValido.id },
        data: { utilizado: true },
      });

      return await tx.usuario.create({
        data: {
          username: usernameFormateado,
          passwordHash: hash,
          rol: "EQUIPO",
          dni: dniRepresentante.trim(),
          nombre: nombreRepresentante.trim(),
          apellido: apellido.trim(),
          idLocalidad: parseInt(idLocalidad),
        },
      });
    });

    return res.status(201).json({
      mensaje:
        "Usuario representante validado por lista blanca e inscripto con éxito.",
      usuario: { id: nuevoUsuario.id, username: nuevoUsuario.username },
    });
  } catch (error) {
    console.error("❌ ERROR CRÍTICO EN REGISTRO:", error);
    return res.status(500).json({
      error: "Error interno del servidor al procesar la lista blanca.",
    });
  }
};

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
      include: { localidad: true }, // 👈 Incluimos la relación para sacar el nombre si es necesario
    });

    if (!usuario) {
      return res.status(401).json({ error: "Credenciales inválidas." });
    }

    const passwordValido = await bcrypt.compare(password, usuario.passwordHash);
    if (!passwordValido) {
      return res.status(401).json({ error: "Credenciales inválidas." });
    }

    // 🚩 IMPORTANTE: Incluir idLocalidad en el JWT para los middlewares
    const token = jwt.sign(
      {
        id: usuario.id,
        rol: usuario.rol,
        idLocalidad: usuario.idLocalidad, // 👈 Agregado al Token
      },
      process.env.JWT_SECRET || "FORJA_SECRET_KEY_2026",
      { expiresIn: "8h" },
    );

    return res.status(200).json({
      token,
      usuario: {
        id: usuario.id,
        username: usuario.username,
        rol: usuario.rol,
        dni: usuario.dni,
        // 🚩 CORRECCIÓN DE NOMBRES:
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
