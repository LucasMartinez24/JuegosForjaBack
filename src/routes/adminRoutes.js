// src/routes/adminRoutes.js
const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");

// Endpoints para el control ministerial
router.get("/arbol-delegaciones", adminController.obtenerArbolDelegaciones);
router.patch("/dictaminar-atleta/:id", adminController.dictaminarAtleta);

module.exports = router;
