// src/routes/municipioRoutes.js
const express = require("express");
const router = express.Router();

const municipioController = require("../controllers/municipioController");
const { verificarRol } = require("../middlewares/auth");

// Forzar validación de rol para todos los sub-endpoints de este archivo
router.use(verificarRol(["MUNICIPIO"]));

// Rutas limpias relativas al prefijo macro
router.get("/arbol", municipioController.obtenerArbolMunicipio);
router.get("/tokens", municipioController.obtenerTokensPropios);
router.post("/tokens/generar", municipioController.generarTokenLocal);
router.patch(
  "/dictamen/:id",
  verificarRol(["MUNICIPIO"]),
  municipioController.dictaminarAtletaLocal,
);

module.exports = router;
