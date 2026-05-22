const express = require("express");
const router = express.Router();
const equipoController = require("../controllers/equipoController");

// 🚀 REVISÁ ESTA LÍNEA: Nos aseguramos de desestructurar la propiedad del archivo middleware
const { subirDocumentacionAtleta } = require("../middlewares/uploadMiddleware");

// (Opcional): Aquí añadirías tu middleware de validación de tokens
// const { verificarToken } = require('../middlewares/authMiddleware');
// router.use(verificarToken);

// Rutas mapeadas para el flujo guiado por estados
router.get("/estado-panel", equipoController.obtenerEstadoPanel);
router.post("/registrar-equipo", equipoController.registrarEquipo);
// Línea 14 corregida: Ahora los 3 argumentos son funciones reales reconocidas por Express
router.post(
  "/registrar-jugador",
  subirDocumentacionAtleta,
  equipoController.registrarJugador,
);
// 👇 NUEVAS RUTAS DE EDICIÓN Y BAJA ASIGNADAS
router.put("/editar-jugador/:id", equipoController.editarJugador);
router.delete("/eliminar-jugador/:id", equipoController.eliminarJugador);
module.exports = router;
