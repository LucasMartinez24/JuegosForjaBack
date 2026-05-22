// src/routes/authRoutes.js
const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");

// Ruta de Login existente
router.post("/login", authController.login);

// Nueva Ruta de Registro Público
router.post("/register", authController.register);

module.exports = router;
