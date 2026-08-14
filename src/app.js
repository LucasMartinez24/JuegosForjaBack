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
const municipioRoutes = require("./routes/municipioRoutes");

const app = express();

// =========================================================================
// MIDDLEWARES GLOBALES 🚀
// =========================================================================

// 1. CORS configurado con soporte multientorno para los Juegos Forja
app.use(
  cors({
    origin: [
      "https://juegosforja.online",
      "https://www.juegosforja.online",
      "http://localhost:4200",
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept",
    ],
    credentials: true, // Habilitado para manejo seguro de tokens/headers en cookies o auth-payloads
  }),
);

app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ limit: "15mb", extended: true }));

// 2. 🧠 MIDDLEWARE INTELIGENTE DE URLS ABSOLUTAS (LOCAL vs PRODUCCIÓN)
// Intercepta los JSON de salida y les pega dinámicamente el host que hace la petición
app.use((req, res, next) => {
  // Detecta de forma elástica si corre en HTTP local o HTTPS en la nube VPS
  const protocolo =
    req.secure || req.headers["x-forwarded-proto"] === "https"
      ? "https"
      : "http";
  const urlBaseDinamica = `${protocolo}://${req.get("host")}`;

  // Recorre la respuesta y reemplaza SOLO las rutas relativas que empiezan
  // con /uploads/. Si el valor ya tiene protocolo (absoluto), lo deja intacto.
  const esObjetoPlano = (valor) => {
    if (valor === null || typeof valor !== "object") return false;
    const proto = Object.getPrototypeOf(valor);
    return proto === Object.prototype || proto === null;
  };

  const prefijarRutas = (valor) => {
    if (typeof valor === "string") {
      if (valor.startsWith("/uploads/")) return `${urlBaseDinamica}${valor}`;
      return valor;
    }
    if (Array.isArray(valor)) return valor.map(prefijarRutas);
    if (esObjetoPlano(valor)) {
      const resultado = {};
      for (const clave of Object.keys(valor)) {
        resultado[clave] = prefijarRutas(valor[clave]);
      }
      return resultado;
    }
    return valor;
  };

  const originalJson = res.json;
  res.json = function (data) {
    return originalJson.call(this, prefijarRutas(data));
  };
  next();
});

// 📁 SERVIDOR ESTÁTICO DE ARCHIVOS DE AUDITORÍA Y COMPROBANTES DE DELEGADOS
// Headers seguros: forzamos descarga (no inline) y bloqueamos HTML
// para que ningún archivo subido pueda ejecutarse en el navegador.
app.use(
  "/uploads",
  express.static(path.join(__dirname, "../uploads"), {
    setHeaders: (res) => {
      res.setHeader("Content-Disposition", "attachment");
      res.setHeader("X-Content-Type-Options", "nosniff");
    },
  }),
);

// =========================================================================
// REGISTRO DE RUTAS INSTITUCIONALES 🛡️
// =========================================================================
app.use("/api/auth", authRoutes);
app.use("/api/delegacion", equipoRoutes);
app.use("/api/auditoria", auditoriaRoutes);
app.use("/api/reportes", excelRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/municipio", municipioRoutes);

// Endpoint opcional de verificación de estado y token para Administradores centrales
const { verificarRol } = require("./middlewares/auth");
app.get("/api/prueba-admin", verificarRol(["ADMIN"]), (req, res) => {
  res.json({
    mensaje: "Si ves esto, eres ADMIN y tu JWT funciona correctamente.",
  });
});

// =========================================================================
// APERTURA DEL PUERTO OPERATIVO
// =========================================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`◈===========================================================◈`);
  console.log(`🚀 JUEGOS FORJA 2026 - Servidor Online en Puerto ${PORT}`);
  console.log(`📁 Repositorio de Documentación Médica en: /uploads/documentos`);
  console.log(`◈===========================================================◈`);
});
