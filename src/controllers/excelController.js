// src/controllers/excelController.js
const prisma = require("../config/db");
const ExcelJS = require("exceljs");

exports.exportarInscripcionesPorDisciplina = async (req, res) => {
  try {
    const idDisciplina = parseInt(req.params.idDisciplina);
    const { municipio, rol } = req.usuario; // Obtenemos el contexto del JWT

    // 1. Buscar la disciplina con sus reglas y sus equipos aprobados
    // Si el rol es MUNICIPIO, solo exportará los equipos aprobados de su localidad.
    const disciplina = await prisma.disciplina.findUnique({
      where: { id: idDisciplina },
      include: {
        equipos: {
          where: {
            estado: "APROBADO",
            ...(rol === "MUNICIPIO" ? { municipio } : {}),
          },
          include: {
            deportistas: true,
          },
          orderBy: { nombreEquipo: "asc" },
        },
      },
    });

    if (!disciplina) {
      return res
        .status(404)
        .json({ error: "La disciplina especificada no existe." });
    }

    if (disciplina.equipos.length === 0) {
      return res
        .status(400)
        .json({
          error:
            "No existen equipos APROBADOS en esta disciplina para exportar.",
        });
    }

    // 2. Inicializar el libro de Excel
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Juegos FORJA - Jujuy";

    // Nombre de la pestaña corto y limpio
    const nombreHoja = disciplina.nombre
      .replace(/[/\\?*:[\]]/g, "")
      .substring(0, 31);
    const sheet = workbook.addWorksheet(nombreHoja);
    sheet.views = [{ showGridLines: true }];

    // 3. Encabezado Institucional Dinámico (Estilos Manual de Identidad)
    sheet.mergeCells("A1:H1");
    const titleCell = sheet.getCell("A1");
    titleCell.value = `JUEGOS FORJA - PLANILLA DE INSCRIPCIÓN: ${disciplina.nombre.toUpperCase()}`;
    titleCell.font = {
      name: "Arial",
      size: 14,
      bold: true,
      color: { argb: "FFFFFFFF" },
    };
    titleCell.alignment = { vertical: "middle", horizontal: "center" };
    titleCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF13304D" }, // Azul Negro (#13304D) [cite: 256]
    };
    sheet.getRow(1).height = 40;

    // Subtítulo con el alcance del reporte
    sheet.mergeCells("A2:H2");
    const subCell = sheet.getCell("A2");
    const alcanceTexto =
      rol === "MUNICIPIO"
        ? `Filtro Localidad: ${municipio}`
        : "Reporte Provincial General";
    subCell.value = `${alcanceTexto}  |  Categoría permitida: Año ${disciplina.anioNacimientoMin} a ${disciplina.anioNacimientoMax}`;
    subCell.font = {
      name: "Arial",
      size: 10,
      italic: true,
      color: { argb: "FF555555" },
    };
    subCell.alignment = { vertical: "middle", horizontal: "center" };
    sheet.getRow(2).height = 20;

    // 4. Encabezados de la Tabla de Datos
    const encabezados = [
      "Equipo / Club",
      "Municipio",
      "Apellido",
      "Nombre",
      "DNI",
      "Fecha Nacimiento",
      "Género",
      "Peso Configurado (Kg)",
    ];

    const headerRow = sheet.addRow(encabezados);
    headerRow.height = 26;

    headerRow.eachCell((cell) => {
      cell.font = {
        name: "Arial",
        size: 11,
        bold: true,
        color: { argb: "FFFFFFFF" },
      };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF85733" }, // Naranja Vibrante (#F85733) para resaltar la cabecera [cite: 259]
      };
      cell.alignment = { vertical: "middle", horizontal: "center" };
      cell.border = {
        top: { style: "thin", color: { argb: "FF000000" } },
        bottom: { style: "medium", color: { argb: "FF000000" } },
        left: { style: "thin", color: { argb: "FF000000" } },
        right: { style: "thin", color: { argb: "FF000000" } },
      };
    });

    // 5. Volcar los atletas agrupados por sus respectivos Equipos
    disciplina.equipos.forEach((equipo) => {
      equipo.deportistas.forEach((atleta) => {
        const filaData = [
          equipo.nombreEquipo,
          equipo.municipio,
          atleta.apellido,
          atleta.nombre,
          atleta.dni,
          new Date(atleta.fechaNacimiento).toLocaleDateString("es-AR"),
          atleta.genero,
          disciplina.requierePeso && atleta.pesoKg
            ? `${parseFloat(atleta.pesoKg)} kg`
            : "N/A",
        ];

        const dataRow = sheet.addRow(filaData);
        dataRow.height = 22;

        // Alineaciones prolijas
        dataRow.getCell(1).alignment = {
          vertical: "middle",
          horizontal: "left",
        };
        dataRow.getCell(2).alignment = {
          vertical: "middle",
          horizontal: "left",
        };
        dataRow.getCell(3).alignment = {
          vertical: "middle",
          horizontal: "left",
        };
        dataRow.getCell(4).alignment = {
          vertical: "middle",
          horizontal: "left",
        };
        dataRow.getCell(5).alignment = {
          vertical: "middle",
          horizontal: "center",
        };
        dataRow.getCell(6).alignment = {
          vertical: "middle",
          horizontal: "center",
        };
        dataRow.getCell(7).alignment = {
          vertical: "middle",
          horizontal: "center",
        };
        dataRow.getCell(8).alignment = {
          vertical: "middle",
          horizontal: "right",
        };

        // Aplicar bordes finos de separación de celdas
        dataRow.eachCell((cell) => {
          cell.font = { name: "Arial", size: 10 };
          cell.border = {
            top: { style: "thin", color: { argb: "FFD3D3D3" } },
            bottom: { style: "thin", color: { argb: "FFD3D3D3" } },
            left: { style: "thin", color: { argb: "FFD3D3D3" } },
            right: { style: "thin", color: { argb: "FFD3D3D3" } },
          };
        });
      });
    });

    // 6. Autoajuste dinámico de columnas
    sheet.columns.forEach((column) => {
      let maxLen = 14;
      column.eachCell({ includeEmpty: false }, (cell) => {
        if (cell.row <= 2) return; // Ignorar banners
        const valStr = cell.value ? cell.value.toString() : "";
        if (valStr.length > maxLen) maxLen = valStr.length;
      });
      column.width = maxLen + 4;
    });

    // 7. Preparar la descarga del archivo adjunto
    const nombreArchivoClean = disciplina.nombre
      .toLowerCase()
      .replace(/\s+/g, "_");
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=Inscripciones_${nombreArchivoClean}.xlsx`,
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    res
      .status(500)
      .json({
        error: "Error al procesar la exportación del Excel.",
        detalle: error.message,
      });
  }
};
