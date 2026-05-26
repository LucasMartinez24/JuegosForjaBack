// src/app.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path"); // 🚀 Importación nativa necesaria para resolver rutas de archivos

const authRoutes = require("./routes/authRoutes");
const equipoRoutes = require("./routes/equipoRoutes");
const auditoriaRoutes = require("./routes/auditoriaRoutes");
const excelRoutes = require("./routes/excelRoutes");
const adminRoutes = require("./routes/adminRoutes");

const app = express();

// Middlewares globales
app.use(express.json());
app.use(
  cors({
    origin: "http://localhost:4200", // El puerto nativo de tu Front
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"], // 🚀 Agregamos PATCH para el dictamen del Admin
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

// 📁 SERVIDOR ESTÁTICO DE ARCHIVOS DE AUDITORÍA
// Esto le permite al Admin visualizar los DNI y Fichas Médicas directamente en el Front-End
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// Servicios en segundo plano
require("./services/limpiezaService");

// =========================================================================
// REGISTRO DE RUTAS INSTITUCIONALES 🚀
// =========================================================================
app.use("/api/auth", authRoutes);
app.use("/api/delegacion", equipoRoutes);
app.use("/api/auditoria", auditoriaRoutes);

// ELIMINASTE EL "const" DE AQUÍ ABAJO PARA NO DUPLICAR
app.use("/api/reportes", excelRoutes);

app.use("/api/admin", adminRoutes); // Enlazado con obtenerArbolDelegaciones y dictaminarAtleta

// Ruta de prueba protegida por rol para verificar que todo funcione
const { verificarRol } = require("./middlewares/auth");
app.get("/api/prueba-admin", verificarRol(["ADMIN"]), (req, res) => {
  res.json({
    mensaje: "Si ves esto, eres ADMIN y tu JWT funciona correctamente.",
  });
});
// ... Todo tu código inicial de app.js se mantiene idéntico

// 🚀 REGISTRO DEL NUEVO MÓDULO DE MUNICIPIO (AGREGAR ESTE BLOQUE):
const municipioRoutes = require("./routes/municipioRoutes");
app.use("/api/municipio", municipioRoutes);

// ... El resto del código de app.js (Ruta de prueba, PORT, app.listen) se queda igual
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`◈===========================================================◈`);
  console.log(`🚀 JUEGOS FORJA 2026 - Servidor Online en Puerto ${PORT}`);
  console.log(`📁 Repositorio de Documentación Médica en: /uploads/documentos`);
  console.log(`◈===========================================================◈`);
});
