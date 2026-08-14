// src/middlewares/uploadMiddleware.js
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const uploadDir = path.join(__dirname, "../../uploads/documentos");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const dni = (req.body && req.body.dni) || "sin_dni";
    const unicitad = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `${dni}-${file.fieldname}-${unicitad}${ext}`);
  },
});

// Whitelist estricta de extensiones y mimetypes válidos para documentación
// oficial de atletas (DNI frente/dorso, ficha médica, CUD).
const EXTENSIONES_PERMITIDAS = new Set([".jpg", ".jpeg", ".png", ".pdf"]);
const MIMETYPES_PERMITIDOS = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "application/pdf",
]);

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const mime = (file.mimetype || "").toLowerCase();

  if (EXTENSIONES_PERMITIDAS.has(ext) && MIMETYPES_PERMITIDOS.has(mime)) {
    return cb(null, true);
  }

  const err = new Error(
    `Archivo rechazado (${file.fieldname}): solo se permiten JPG, PNG o PDF.`,
  );
  err.code = "TIPO_ARCHIVO_INVALIDO";
  err.statusCode = 400;
  return cb(err);
};

const uploadConfig = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024, files: 4 },
});

// Configuración expandida con soporte para Deporte Adaptado (cud).
const subirDocumentacionAtleta = uploadConfig.fields([
  { name: "dniFrente", maxCount: 1 },
  { name: "dniDorso", maxCount: 1 },
  { name: "fichaMedica", maxCount: 1 },
  { name: "cud", maxCount: 1 },
]);

module.exports = {
  subirDocumentacionAtleta,
};