// src/app.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");

const authRoutes = require("./routes/authRoutes");
const equipoRoutes = require("./routes/equipoRoutes");
const auditoriaRoutes = require("./routes/auditoriaRoutes");
const excelRoutes = require("./routes/excelRoutes");
const adminRoutes = require("./routes/adminRoutes");

const app = express();

// =========================================================================
// MIDDLEWARES GLOBALES 🚀
// =========================================================================

// 1. CORS configurado con el dominio real de Juegos Forja
app.use(
  cors({
    origin: [
      "https://juegosforja.online",
      "https://www.juegosforja.online", // 🔥 Agregamos la variante con WWW
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept",
    ],
    credentials: true, // Habilitado para manejo seguro de tokens/headers
  }),
);

app.use(express.json());
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ limit: "15mb", extended: true }));

// 2. 🔥 EL MIDDLEWARE MÁGICO PARA LAS FOTOS Y DOCUMENTOS
// Parchea los JSON en el aire para que Angular reciba URLs absolutas automáticas
app.use((req, res, next) => {
  const originalJson = res.json;
  res.json = function (data) {
    let jsonString = JSON.stringify(data);

    if (jsonString && jsonString.includes("/uploads/")) {
      // Usa la variable APP_URL de tu .env (https://api.juegosforja.online)
      const apiUrL = process.env.APP_URL || "https://api.juegosforja.online";

      // Evita duplicar si por alguna razón ya viene con la URL armada
      jsonString = jsonString.replace(
        /(?!"https:\/\/api.juegosforja.online")\/uploads\//g,
        `${apiUrL}/uploads/`,
      );
    }

    return originalJson.call(this, JSON.parse(jsonString));
  };
  next();
});

// 📁 SERVIDOR ESTÁTICO DE ARCHIVOS DE AUDITORÍA
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// Servicios en segundo plano
require("./services/limpiezaService");

// =========================================================================
// REGISTRO DE RUTAS INSTITUCIONALES (El resto queda exactamente igual)
// =========================================================================
app.use("/api/auth", authRoutes);
app.use("/api/delegacion", equipoRoutes);
app.use("/api/auditoria", auditoriaRoutes);
app.use("/api/reportes", excelRoutes);
app.use("/api/admin", adminRoutes);

const { verificarRol } = require("./middlewares/auth");
app.get("/api/prueba-admin", verificarRol(["ADMIN"]), (req, res) => {
  res.json({
    mensaje: "Si ves esto, eres ADMIN y tu JWT funciona correctamente.",
  });
});

const municipioRoutes = require("./routes/municipioRoutes");
app.use("/api/municipio", municipioRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`◈===========================================================◈`);
  console.log(`🚀 JUEGOS FORJA 2026 - Servidor Online en Puerto ${PORT}`);
  console.log(`📁 Repositorio de Documentación Médica en: /uploads/documentos`);
  console.log(`◈===========================================================◈`);
});
