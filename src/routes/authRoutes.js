// src/routes/authRoutes.js
const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");

// 🚀 LA LÍNEA QUE FALTA: Importar la instancia global de Prisma
const prisma = require("../config/db");

// El endpoint que daba el fallo ahora va a encontrar la variable sin problemas:
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

// Tus demás rutas...
router.post("/register", authController.register);
router.post("/login", authController.login);

module.exports = router;
