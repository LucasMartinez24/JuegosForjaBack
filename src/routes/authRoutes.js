// src/routes/authRoutes.js
const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");

// 🚀 REQUERIDO: Importamos path para poder procesar las extensiones de las imágenes (.png, .jpg, .pdf)
const path = require("path");

// Importamos el middleware de control de roles para proteger la ruta de cambio de contraseña
const { verificarRol } = require("../middlewares/auth");

// Importar la instancia global de Prisma
const prisma = require("../config/db");

// 🚀 CONFIGURACIÓN DE MULTER: Captura física de los archivos DNI de los representantes
const multer = require("multer");
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/documentos/"); // 💡 Recordá asegurarte de que esta carpeta exista en la raíz del proyecto
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `rep-${Date.now()}-${Math.round(Math.random() * 1e4)}${ext}`);
  },
});
const upload = multer({ storage: storage });

// =========================================================================
// ENDPOINTS
// =========================================================================

// 1. Endpoint público para el combo del Front de Angular (Se ejecuta al cargar el Login)
router.get("/localidades", async (req, res) => {
  try {
    const localidades = await prisma.localidad.findMany({
      orderBy: { nombre: "asc" },
    });
    return res.status(200).json(localidades);
  } catch (error) {
    console.error("❌ Error al obtener localidades para el combo:", error);
    return res
      .status(500)
      .json({ error: "No se pudo cargar el listado de municipios." });
  }
});

// 2. Registro directo de Clubes/Equipos (Intercepta y parsea los archivos binarios obligatorios)
router.post(
  "/register",
  upload.fields([
    { name: "dniFrente", maxCount: 1 },
    { name: "dniDorso", maxCount: 1 },
  ]),
  authController.register,
);

// 3. Inicio de sesión general (Envía la bandera debeCambiarClave para control de seguridad)
router.post("/login", authController.login);

// 4. Endpoint protegido para el primer cambio de clave obligatorio
router.post(
  "/cambiar-password-inicial",
  verificarRol(["ADMIN", "MUNICIPIO", "EQUIPO"]), // Abre el token e inyecta req.usuario
  authController.actualizarPasswordPrimerLogin, // Modifica la clave en Prisma
);

module.exports = router;
