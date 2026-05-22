// src/config/multer.js
const m = require("multer");
const p = require("path");
const fs = require("fs");

// Asegurar que la carpeta 'uploads' exista en la raíz
const dirUploads = p.join(__dirname, "../../uploads");
if (!fs.existsSync(dirUploads)) {
  fs.mkdirSync(dirUploads, { recursive: true });
}

const almacenamiento = m.diskStorage({
  destination: (req, archivo, cb) => {
    cb(null, dirUploads);
  },
  filename: (req, archivo, cb) => {
    const sufijoUnico = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      `${archivo.fieldname}-${sufijoUnico}${p.extname(archivo.originalname)}`,
    );
  },
});

// Filtro para aceptar solo imágenes y PDFs
const filtroArchivos = (req, archivo, cb) => {
  const tiposPermitidos = /jpeg|jpg|png|pdf/;
  const ext = tiposPermitidos.test(
    p.extname(archivo.originalname).toLowerCase(),
  );
  const mime = tiposPermitidos.test(archivo.mimetype);

  if (ext && mime) {
    return cb(null, true);
  }
  cb(new Error("Solo se permiten archivos en formato JPG, PNG o PDF."));
};

const upload = m({
  storage: almacenamiento,
  fileFilter: filtroArchivos,
  limits: { fileSize: 5 * 1024 * 1024 }, // Límite de 5MB por archivo
});

module.exports = upload;
