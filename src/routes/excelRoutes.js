// src/routes/excelRoutes.js
const express = require("express");
const router = express.Router();
const excelController = require("../controllers/excelController");
const { verificarRol } = require("../middlewares/auth");

// Exportación dirigida por disciplina. Accesible para los revisores institucionales.
router.get(
  "/exportar/disciplina/:idDisciplina",
  verificarRol(["ADMIN", "MUNICIPIO"]),
  excelController.exportarInscripcionesPorDisciplina,
);

module.exports = router;
