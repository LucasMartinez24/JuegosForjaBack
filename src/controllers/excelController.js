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
        pruebasAdicionales: {
          include: {
            prueba: true,
          },
        },
      },
    });

    // Agrupar por "deporteAsignado"
    const gruposPorDeporte = {};
    datos.forEach((d) => {
      const deporte = d.deporteAsignado || "Sin Deporte";
      if (!gruposPorDeporte[deporte]) {
        gruposPorDeporte[deporte] = [];
      }
      gruposPorDeporte[deporte].push(d);
    });

    // Funciones auxiliares
    const calcularEdad = (fechaNacimiento) => {
      if (!fechaNacimiento) return "N/A";
      const hoy = new Date();
      const nac = new Date(fechaNacimiento);
      let edad = hoy.getFullYear() - nac.getFullYear();
      const m = hoy.getMonth() - nac.getMonth();
      if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) {
        edad--;
      }
      return edad;
    };

    const formatearFecha = (fecha) => {
      if (!fecha) return "N/A";
      const f = new Date(fecha);
      const dia = String(f.getDate()).padStart(2, "0");
      const mes = String(f.getMonth() + 1).padStart(2, "0");
      const anio = f.getFullYear();
      return `${dia}/${mes}/${anio}`;
    };

    const obtenerPruebas = (d) => {
      let pruebas = [];
      if (d.prueba && d.prueba.nombrePrueba) {
        pruebas.push(d.prueba.nombrePrueba);
      }
      if (d.pruebasAdicionales && d.pruebasAdicionales.length > 0) {
        d.pruebasAdicionales.forEach((pa) => {
          if (pa.prueba && pa.prueba.nombrePrueba) {
            pruebas.push(pa.prueba.nombrePrueba);
          }
        });
      }
      return pruebas.join(", ");
    };

    // Paso 3: Generar Excel
    const workbook = new ExcelJS.Workbook();

    Object.keys(gruposPorDeporte).forEach((deporte) => {
      // Limpiar nombre de hoja para que sea válido en Excel (max 31 chars y sin caracteres especiales)
      let safeSheetName = deporte.substring(0, 31).replace(/[\\*?:/\[\]]/g, "");
      if (!safeSheetName) safeSheetName = "Deporte";

      const worksheet = workbook.addWorksheet(safeSheetName);

      worksheet.columns = [
        { header: "Apellido", key: "apellido", width: 20 },
        { header: "Nombre", key: "nombre", width: 20 },
        { header: "DNI", key: "dni", width: 15 },
        { header: "Fecha de Nac.", key: "fechaNacimiento", width: 15 },
        { header: "Edad", key: "edad", width: 10 },
        { header: "Género", key: "genero", width: 15 },
        { header: "Altura (cm)", key: "altura", width: 15 },
        { header: "Peso (kg)", key: "peso", width: 15 },
        { header: "Pruebas Asignadas", key: "pruebas", width: 45 },
        { header: "Municipio", key: "municipio", width: 25 },
        { header: "Equipo", key: "equipo", width: 30 },
        { header: "Estado", key: "estado", width: 15 },
      ];

      worksheet.getRow(1).font = { bold: true };

      // Ordenamos los atletas dentro de cada hoja (por municipio y luego por apellido)
      const datosDeporte = gruposPorDeporte[deporte];
      datosDeporte.sort((a, b) => {
        const munA = a.equipo ? a.equipo.municipio.toUpperCase() : "Z_SIN";
        const munB = b.equipo ? b.equipo.municipio.toUpperCase() : "Z_SIN";
        if (munA < munB) return -1;
        if (munA > munB) return 1;

        const apeA = a.apellido ? a.apellido.toUpperCase() : "Z";
        const apeB = b.apellido ? b.apellido.toUpperCase() : "Z";
        if (apeA < apeB) return -1;
        if (apeA > apeB) return 1;
        return 0;
      });

      datosDeporte.forEach((d) => {
        worksheet.addRow({
          apellido: d.apellido,
          nombre: d.nombre,
          dni: d.dni,
          fechaNacimiento: formatearFecha(d.fechaNacimiento),
          edad: calcularEdad(d.fechaNacimiento),
          genero: d.genero || "N/A",
          altura: d.alturaCm !== null ? d.alturaCm : "N/A",
          peso: d.pesoKg !== null ? d.pesoKg : "N/A",
          pruebas: obtenerPruebas(d),
          municipio: d.equipo ? d.equipo.municipio : "N/A",
          equipo: d.equipo ? d.equipo.nombre : "Sin Equipo",
          estado: d.estado,
        });
      });
    });

    // Manejo de caso sin datos
    if (Object.keys(gruposPorDeporte).length === 0) {
      const worksheet = workbook.addWorksheet("Sin Datos");
      worksheet.addRow(["No se encontraron atletas para el reporte."]);
    }

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
