// src/controllers/authController.js
const prisma = require("../config/db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// 2. Asegúrate de que REGISTER esté exportado exactamente igual:
exports.register = async (req, res) => {
  try {
    const {
      email,
      password,
      nombreRepresentante,
      apellido,
      municipio,
      dniRepresentante,
    } = req.body; // <-- Recibir DNI

    // 1. Validaciones de presencia
    if (
      !email ||
      !password ||
      !nombreRepresentante ||
      !apellido ||
      !municipio ||
      !dniRepresentante
    ) {
      return res
        .status(400)
        .json({ error: "Todos los campos son obligatorios." });
    }

    if (password.length < 6) {
      return res
        .status(400)
        .json({ error: "La contraseña debe tener al menos 6 caracteres." });
    }

    // 2. Controlar duplicados (Email y DNI)
    const usuarioExistente = await prisma.usuario.findFirst({
      where: {
        OR: [
          { email: email.toLowerCase().trim() },
          { dni: dniRepresentante.trim() }, // <-- Validar que el DNI no exista
        ],
      },
    });

    if (usuarioExistente) {
      const causante =
        usuarioExistente.email === email.toLowerCase().trim()
          ? "El correo"
          : "El DNI";
      return res
        .status(400)
        .json({ error: `${causante} ya se encuentra registrado.` });
    }

    // 3. Encriptación
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);

    // 4. Inserción
    const nuevoUsuario = await prisma.usuario.create({
      data: {
        email: email.toLowerCase().trim(),
        passwordHash: hash,
        rol: "EQUIPO",
        dni: dniRepresentante.trim(), // <-- Persistir DNI
        nombre: nombreRepresentante.trim(),
        apellido: apellido.trim(),
        municipioAsignado: municipio,
      },
      select: {
        id: true,
        email: true,
        rol: true,
        dni: true,
        municipioAsignado: true,
      },
    });

    return res.status(201).json({
      mensaje: "Usuario representante registrado con éxito.",
      usuario: nuevoUsuario,
    });
  } catch (error) {
    console.error("❌ ERROR CRÍTICO EN REGISTRO:", error);
    return res.status(500).json({
      error: "Error interno del servidor al procesar el registro.",
      detalle: error.message,
    });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email y contraseña requeridos." });
    }

    const usuario = await prisma.usuario.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!usuario) {
      return res.status(401).json({ error: "Credenciales inválidas." });
    }

    const passwordValido = await bcrypt.compare(password, usuario.passwordHash);
    if (!passwordValido) {
      return res.status(401).json({ error: "Credenciales inválidas." });
    }

    const token = jwt.sign(
      { id: usuario.id, rol: usuario.rol },
      process.env.JWT_SECRET || "FORJA_SECRET_KEY_2026",
      { expiresIn: "8h" },
    );

    console.log(usuario);
    return res.status(200).json({
      token,
      usuario: {
        id: usuario.id,
        email: usuario.email,
        rol: usuario.rol,
        dni: usuario.dni, // <--- Enviamos el DNI al Front-end
        municipio: usuario.municipioAsignado,
      },
    });
  } catch (error) {
    return res.status(500).json({
      error: "Error en el servidor al autenticar.",
      detalle: error.message,
    });
  }
};
