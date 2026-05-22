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
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.usuario = decoded; // Inyecta id, email, rol y municipio en la petición

      // Verificar si el rol extraído del JWT tiene autorización
      if (!rolesPermitidos.includes(req.usuario.rol)) {
        return res
          .status(403)
          .json({
            error: "Acceso prohibido. Permisos insuficientes para este rol.",
          });
      }

      next();
    } catch (error) {
      return res.status(401).json({ error: "Token inválido o expirado." });
    }
  };
};

module.exports = { verificarRol };
