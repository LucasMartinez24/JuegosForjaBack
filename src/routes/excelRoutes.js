const express = require("express");
const router = express.Router();
const { generarReporteExcel } = require("../controllers/excelController");
router.get("/generar", generarReporteExcel);
module.exports = router;
