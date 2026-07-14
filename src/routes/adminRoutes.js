const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");
const { verificarRol } = require("../middlewares/auth");

// 🚀 CONTROLADOR GEOGRÁFICO DE TOKENS Y CUENTAS
router.get("/localidades-tokens", adminController.obtenerLocalidadesYTokens);
router.post("/crear-municipio-usuario", adminController.crearUsuarioMunicipio);
router.post("/generar-token", adminController.generarTokenMunicipio);

// 📊 ÁRBOL DE AUDITORÍA MINISTERIAL
router.get("/arbol-delegaciones", adminController.obtenerArbolDelegaciones);

// ⚖️ DICTÁMENES DE ROSTER (Ambas variantes mapeadas de forma segura)
router.put("/dictaminar-atleta/:id", adminController.dictaminarAtleta);
router.put("/dictaminar/:id", adminController.dictaminarAtleta);

// 🗑️ PURGA DE ENTIDADES
router.delete(
  "/eliminar-equipo/:idEquipo",
  adminController.eliminarEquipoPorAuditoria,
);

// 🪪 RECOLECCIÓN DE CREDENCIALES DEL REPRESENTANTE
router.get(
  "/equipo-delegado/:idEquipo",
  verificarRol(["ADMIN", "MUNICIPIO"]),
  adminController.obtenerDelegadoPorEquipo,
);

module.exports = router;
