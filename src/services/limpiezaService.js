// src/services/limpiezaService.js
const cron = require("node-cron");
const prisma = require("../config/db");

// Configuración para que corra automáticamente todas las noches a las 00:00 AM
cron.schedule("0 0 * * *", async () => {
  console.log(
    "Iniciando tarea programada: Purga de equipos rechazados antiguos...",
  );

  try {
    const DIAS_DE_GRACIA = 15;
    const fechaLimite = new Date();
    fechaLimite.setDate(fechaLimite.getDate() - DIAS_DE_GRACIA);

    // Debido al onDelete: Cascade del esquema de Prisma, borrar el equipo
    // eliminará en cascada todos sus deportistas asociados de la BD automáticamente.
    const eliminados = await prisma.equipo.deleteMany({
      where: {
        estado: "RECHAZADO",
        fechaRechazo: {
          lte: fechaLimite, // Menor o igual a la fecha límite (hace más de 15 días)
        },
      },
    });

    if (eliminados.count > 0) {
      console.log(
        `Purga completada con éxito. Se eliminaron ${eliminados.count} equipos obsoletos.`,
      );
    } else {
      console.log(
        "No se encontraron registros rechazados antiguos para eliminar.",
      );
    }
  } catch (error) {
    console.error(
      "Error durante la ejecución del servicio de limpieza:",
      error.message,
    );
  }
});
