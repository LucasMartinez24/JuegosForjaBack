// src/controllers/auditoriaController.js
const prisma = require("../config/db");
const fs = require("fs");
const path = require("path");

// 1. Obtener las disciplinas que tienen inscripciones en el municipio del auditor
exports.obtenerDisciplinasConInscripciones = async (req, res) => {
  try {
    const { municipio, rol } = req.usuario;

    // Filtro base: Si es MUNICIPIO, solo ve lo suyo. Si es ADMIN, ve todo.
    const filtroMunicipio = rol === "MUNICIPIO" ? { municipio } : {};

    const disciplinas = await prisma.disciplina.findMany({
      where: {
        equipos: {
          some: filtroMunicipio,
        },
      },
      include: {
        _count: {
          select: {
            equipos: { where: { ...filtroMunicipio, estado: "PENDIENTE" } },
          },
        },
      },
    });

    // Formatear la respuesta para que Angular sepa cuántos pendientes hay
    const resultado = disciplinas.map((d) => ({
      id: d.id,
      nombre: d.nombre,
      tipo: d.tipo,
      pendientes: d._count.equipos,
    }));

    res.json(resultado);
  } catch (error) {
    res
      .status(500)
      .json({
        error: "Error al obtener las disciplinas.",
        detalle: error.message,
      });
  }
};

// 2. Listar los equipos de una disciplina específica para el municipio
exports.obtenerEquiposPorDisciplina = async (req, res) => {
  try {
    const idDisciplina = parseInt(req.params.idDisciplina);
    const { municipio, rol } = req.usuario;

    const filtro = {
      idDisciplina,
      ...(rol === "MUNICIPIO" ? { municipio } : {}),
    };

    const equipos = await prisma.equipo.findMany({
      where: filtro,
      include: {
        deportistas: true,
        representante: { select: { email: true } },
      },
      orderBy: { fechaRegistro: "desc" },
    });

    res.json(equipos);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Error al obtener los equipos.", detalle: error.message });
  }
};

// 3. Cambiar el estado del equipo (Aprobar o Rechazar)
exports.cambiarEstadoEquipo = async (req, res) => {
  try {
    const idEquipo = parseInt(req.params.idEquipo);
    const { nuevoEstado } = req.body; // 'APROBADO' o 'RECHAZADO'
    const { municipio, rol } = req.usuario;

    if (!["APROBADO", "RECHAZADO", "PENDIENTE"].includes(nuevoEstado)) {
      return res.status(400).json({ error: "Estado no válido." });
    }

    // Validar que el equipo exista y que pertenezca al municipio del auditor
    const equipo = await prisma.equipo.findUnique({ where: { id: idEquipo } });
    if (!equipo) {
      return res.status(404).json({ error: "Equipo no encontrado." });
    }

    if (rol === "MUNICIPIO" && equipo.municipio !== municipio) {
      return res
        .status(403)
        .json({ error: "No tienes permisos para auditar este equipo." });
    }

    // Si es rechazado, guardamos la fecha actual para el proceso de purga.
    // Además, liberamos espacio de forma inmediata borrando los archivos pesados (multimedia)
    let fechaRechazo = null;
    if (nuevoEstado === "RECHAZADO") {
      fechaRechazo = new Date();

      // Buscamos los deportistas de ese equipo para destruir sus imágenes/PDFs físicos
      const deportistas = await prisma.deportista.findMany({
        where: { idEquipo },
      });
      const dirUploads = path.join(__dirname, "../../uploads");

      deportistas.forEach((atleta) => {
        const archivos = [
          atleta.urlDniFrente,
          atleta.urlDniDorso,
          atleta.urlFichaMedica,
          atleta.urlCud,
        ];
        archivos.forEach((archivo) => {
          if (archivo) {
            const rutaCompleta = path.join(dirUploads, archivo);
            if (fs.existsSync(rutaCompleta)) {
              fs.unlinkSync(rutaCompleta); // Borrado físico del archivo en el VPS
            }
          }
        });
      });
    }

    const equipoActualizado = await prisma.equipo.update({
      where: { id: idEquipo },
      data: {
        estado: nuevoEstado,
        fechaRechazo,
      },
    });

    res.json({
      mensaje: `El equipo ha sido marcado como ${nuevoEstado} exitosamente. Archivos multimedia liberados si aplica.`,
      equipo: equipoActualizado,
    });
  } catch (error) {
    res
      .status(500)
      .json({
        error: "Error al cambiar el estado del equipo.",
        detalle: error.message,
      });
  }
};
