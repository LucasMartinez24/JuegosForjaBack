const ExcelJS = require("exceljs");
const prisma = require("../config/db");

const generarReporteExcel = async (req, res) => {
  const { tipo, valor } = req.query;

  try {
    let filtro = {};

    if (tipo === "disciplina") {
      // Paso 1: Obtener los IDs de las pruebas de esa disciplina
      // Validar que venga un valor numérico
      const idDisciplina = parseInt(valor, 10);
      if (isNaN(idDisciplina)) {
        return res
          .status(400)
          .json({ error: "Parámetro 'valor' inválido para 'disciplina'" });
      }

      const pruebas = await prisma.pruebaEspecifica.findMany({
        where: { idDisciplina: idDisciplina },
        select: { id: true },
      });

      const idsPruebas = pruebas.map((p) => p.id);
      // Si no hay pruebas, asegurar que el filtro no falle (retornará vacío)
      filtro = idsPruebas.length
        ? { idPrueba: { in: idsPruebas } }
        : { idPrueba: { in: [] } };
    } else if (tipo === "municipio") {
      // Filtrar por equipo relacionado
      filtro = { equipo: { municipio: valor } };
    } else if (tipo === "equipo") {
      // Filtrar por equipo ID directamente
      filtro = { idEquipo: valor };
    } else if (tipo === "general") {
      // Sin filtro, traer todos
      filtro = {};
    }

    // Paso 2: Obtener los deportistas
    let datos = await prisma.deportista.findMany({
      where: filtro,
      include: {
        equipo: true,
        prueba: true,
      },
    });

    // Si es general, ordenamos por municipio para que queden divididos/agrupados
    if (tipo === "general") {
      datos.sort((a, b) => {
        const munA = a.equipo ? a.equipo.municipio.toUpperCase() : "Z_SIN_MUNICIPIO";
        const munB = b.equipo ? b.equipo.municipio.toUpperCase() : "Z_SIN_MUNICIPIO";
        if (munA < munB) return -1;
        if (munA > munB) return 1;
        return 0;
      });
    }

    // Paso 3: Generar Excel
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Reporte de Atletas");

    worksheet.columns = [
      { header: "Municipio", key: "municipio", width: 25 },
      { header: "Apellido", key: "apellido", width: 20 },
      { header: "Nombre", key: "nombre", width: 20 },
      { header: "DNI", key: "dni", width: 15 },
      { header: "Equipo", key: "equipo", width: 25 },
      { header: "Prueba", key: "prueba", width: 30 },
      { header: "Estado", key: "estado", width: 15 },
    ];

    worksheet.getRow(1).font = { bold: true };

    datos.forEach((d) => {
      worksheet.addRow({
        municipio: d.equipo ? d.equipo.municipio : "N/A",
        apellido: d.apellido,
        nombre: d.nombre,
        dni: d.dni,
        equipo: d.equipo ? d.equipo.nombre : "Sin Equipo",
        prueba: d.prueba ? d.prueba.nombrePrueba : "N/A",
        estado: d.estado,
      });
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=Reporte_Juegos_Forja.xlsx",
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Error crítico en Excel Controller:", error);
    res.status(500).json({
      error: "Error interno al generar el reporte",
      detalle: error.message,
    });
  }
};

module.exports = { generarReporteExcel };
