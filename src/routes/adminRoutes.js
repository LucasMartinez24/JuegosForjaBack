const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");
const adminAtletaController = require("../controllers/adminAtletaController");
const { verificarRol } = require("../middlewares/auth");
const { subirDocumentacionAtleta } = require("../middlewares/uploadMiddleware");

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

// 🏟️ ALTA DE CLUB/USUARIO CON DISCIPLINA ASIGNADA (Modo Admin)
router.post("/crear-club", adminController.crearClubConUsuario);

// 🚻 DESGLOSE DE EQUIPOS POR DISCIPLINA SEPARADOS POR RAMA (F/M)
router.get(
  "/equipos-por-rama/:idDisciplina",
  verificarRol(["ADMIN", "MUNICIPIO"]),
  adminController.obtenerEquiposPorDisciplinaYRama,
);

// 📚 CATÁLOGO COMPLETO DE DISCIPLINAS
router.get("/disciplinas", adminController.obtenerCatalogoDisciplinas);

// 🚀 NUEVO: FLUJO ADMIN CARGA ATLETAS A UN EQUIPO
// El admin puede cargar atletas a cualquier delegación. El endpoint
// exige rol ADMIN y aplica las mismas validaciones que el flujo
// del representante (peso, género, edad, cupo, etc.).
router.get(
  "/equipos-disponibles",
  verificarRol(["ADMIN"]),
  adminAtletaController.listarEquiposDisponibles,
);
router.get(
  "/pruebas-por-disciplina/:idDisciplina",
  verificarRol(["ADMIN"]),
  adminAtletaController.obtenerPruebasPorDisciplina,
);
router.post(
  "/agregar-atleta/:idEquipo",
  verificarRol(["ADMIN"]),
  subirDocumentacionAtleta,
  adminAtletaController.agregarAtletaAEquipo,
);

module.exports = router;
