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
    const dni = req.body.dni || "sin_dni";
    const unicitad = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `${dni}-${file.fieldname}-${unicitad}${ext}`);
  },
});

// 🔥 DEJAMOS PASAR TODO SIN FILTROS ESTRICTOS
const fileFilter = (req, file, cb) => {
  cb(null, true); // ✅ Acepta cualquier formato de archivo y mimetype
};

const uploadConfig = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 }, // 🚀 Tus 50MB asignados están perfectos acá
});

// 👇 DEFINIMOS LA PROPIEDAD COMO UNA CONSTANTE LOCAL
const subirDocumentacionAtleta = uploadConfig.fields([
  { name: "dniFrente", maxCount: 1 },
  { name: "dniDorso", maxCount: 1 },
  { name: "fichaMedica", maxCount: 1 },
]);

// 🚀 EXPORTACIÓN LIMPIA Y COMPATIBLE DE LA PROPIEDAD
module.exports = {
  subirDocumentacionAtleta,
};
