// src/config/db.js
const { PrismaClient } = require("@prisma/client");
const { PrismaMariaDb } = require("@prisma/adapter-mariadb");

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL no está definida en las variables de entorno.");
}

// Desglosamos la URL de conexión de forma segura
const parsedUrl = new URL(databaseUrl);

// Inicializamos el Driver Adapter nativo para evitar el error de engine client
const adapter = new PrismaMariaDb({
  host: parsedUrl.hostname,
  port: parsedUrl.port ? Number(parsedUrl.port) : 3306,
  user: decodeURIComponent(parsedUrl.username),
  password: decodeURIComponent(parsedUrl.password),
  database: parsedUrl.pathname.replace(/^\//, ""),
});

// Inyectamos el adaptador en el constructor tal como te lo pide Prisma
const prisma = new PrismaClient({ adapter });

module.exports = prisma;
