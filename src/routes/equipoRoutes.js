const express = require("express");
const router = express.Router();
const equipoController = require("../controllers/equipoController");
const { subirDocumentacionAtleta } = require("../middlewares/uploadMiddleware");
const { verificarRol } = require("../middlewares/auth");

// Todas las rutas de delegación requieren estar autenticado y tener rol EQUIPO o ADMIN.
// Cierra el IDOR histórico que aceptaba ?usuarioId= sin auth.
router.use(verificarRol(["EQUIPO", "ADMIN"]));

// Estado del panel (carga catálogo + equipo del usuario autenticado)
router.get("/estado-panel", equipoController.obtenerEstadoPanel);

// Alta inicial de delegación
router.post("/registrar-equipo", equipoController.registrarEquipo);

// Inscripción de atletas
router.post(
  "/registrar-jugador",
  subirDocumentacionAtleta,
  equipoController.registrarJugador,
);

// Edición y baja
router.put(
  "/editar-jugador/:id",
  subirDocumentacionAtleta,
  equipoController.editarJugador,
);
router.delete("/eliminar-jugador/:id", equipoController.eliminarJugador);

module.exports = router;