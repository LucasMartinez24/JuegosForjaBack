// src/routes/adminRoutes.js
const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");
const { verificarRol } = require("../middlewares/auth");
// const { verificarToken, verificarAdmin } = require("../middlewares/authMiddleware");
// (Usa tus middlewares si los tenés activos)

// 🚀 ENLACE AL CONTROLADOR GEOGRÁFICO DE TOKENS
router.get("/localidades-tokens", adminController.obtenerLocalidadesYTokens);
router.post("/crear-municipio-usuario", adminController.crearUsuarioMunicipio);
router.post("/generar-token", adminController.generarTokenMunicipio);

// Tus rutas previas...
router.get("/arbol-delegaciones", adminController.obtenerArbolDelegaciones);
// src/routes/adminRoutes.js

// Mantén tu ruta original por si acaso
router.put("/dictaminar-atleta/:id", adminController.dictaminarAtleta);

// 🚀 AGREGA ESTA LÍNEA JUSTO DEBAJO para solucionar el error actual:
router.put("/dictaminar/:id", adminController.dictaminarAtleta);
router.delete(
  "/eliminar-equipo/:idEquipo",
  adminController.eliminarEquipoPorAuditoria,
);
router.get(
  "/equipo-delegado/:idEquipo",
  verificarRol(["ADMIN", "MUNICIPIO"]),
  adminController.obtenerDelegadoPorEquipo,
);
module.exports = router;
