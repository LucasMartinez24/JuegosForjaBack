// src/routes/auditoriaRoutes.js
const express = require("express");
const router = express.Router();
const auditoriaController = require("../controllers/auditoriaController");
const { verificarRol } = require("../middlewares/auth");

// Rutas protegidas para Municipio y Admin de la Secretaría
router.get(
  "/disciplinas",
  verificarRol(["MUNICIPIO", "ADMIN"]),
  auditoriaController.obtenerDisciplinasConInscripciones,
);

router.get(
  "/disciplinas/:idDisciplina/equipos",
  verificarRol(["MUNICIPIO", "ADMIN"]),
  auditoriaController.obtenerEquiposPorDisciplina,
);

router.patch(
  "/equipos/:idEquipo/estado",
  verificarRol(["MUNICIPIO", "ADMIN"]),
  auditoriaController.cambiarEstadoEquipo,
);

module.exports = router;
