// src/middlewares/auth.js
const jwt = require("jsonwebtoken");

const verificarRol = (rolesPermitidos) => {
  return (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res
        .status(401)
        .json({ error: "Acceso denegado. Token faltante o inválido." });
    }

    const token = authHeader.split(" ")[1];

    try {
      // 🚀 CORREGIDO: Agregamos el mismo string de respaldo que usas en el Login
      const claveSecreta = process.env.JWT_SECRET || "FORJA_SECRET_KEY_2026";

      const decoded = jwt.verify(token, claveSecreta);
      req.usuario = decoded;

      if (!rolesPermitidos.includes(req.usuario.rol)) {
        return res.status(403).json({
          error: "Acceso prohibido. Permisos insuficientes para este rol.",
        });
      }

      next();
    } catch (error) {
      // Si la firma no coincide, cae acá
      return res.status(401).json({ error: "Token inválido o expirado." });
    }
  };
};

module.exports = { verificarRol };
