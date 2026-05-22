-- CreateTable
CREATE TABLE `usuarios` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(191) NOT NULL,
    `password_hash` VARCHAR(191) NOT NULL,
    `rol` ENUM('ADMIN', 'MUNICIPIO', 'EQUIPO') NOT NULL,
    `municipio_asignado` VARCHAR(191) NULL,

    UNIQUE INDEX `usuarios_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `disciplinas` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(191) NOT NULL,
    `tipo` ENUM('CONVENCIONAL', 'ADAPTADO') NOT NULL,
    `anio_nacimiento_min` INTEGER NOT NULL,
    `anio_nacimiento_max` INTEGER NOT NULL,
    `max_jugadores` INTEGER NOT NULL,
    `requiere_peso` BOOLEAN NOT NULL DEFAULT false,

    UNIQUE INDEX `disciplinas_nombre_key`(`nombre`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `equipos` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre_equipo` VARCHAR(191) NOT NULL,
    `municipio` VARCHAR(191) NOT NULL,
    `id_disciplina` INTEGER NOT NULL,
    `id_representante` INTEGER NOT NULL,
    `estado` ENUM('PENDIENTE', 'APROBADO', 'RECHAZADO') NOT NULL DEFAULT 'PENDIENTE',
    `fecha_registro` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `fecha_rechazo` DATETIME(3) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `deportistas` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `id_equipo` INTEGER NOT NULL,
    `nombre` VARCHAR(191) NOT NULL,
    `apellido` VARCHAR(191) NOT NULL,
    `dni` VARCHAR(191) NOT NULL,
    `fecha_nacimiento` DATETIME(3) NOT NULL,
    `genero` ENUM('MASCULINO', 'FEMENINO', 'MIXTO') NOT NULL,
    `peso_kg` DECIMAL(5, 2) NULL,
    `url_dni_frente` VARCHAR(191) NOT NULL,
    `url_dni_dorso` VARCHAR(191) NOT NULL,
    `url_ficha_medica` VARCHAR(191) NOT NULL,
    `url_cud` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `equipos` ADD CONSTRAINT `equipos_id_disciplina_fkey` FOREIGN KEY (`id_disciplina`) REFERENCES `disciplinas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `equipos` ADD CONSTRAINT `equipos_id_representante_fkey` FOREIGN KEY (`id_representante`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `deportistas` ADD CONSTRAINT `deportistas_id_equipo_fkey` FOREIGN KEY (`id_equipo`) REFERENCES `equipos`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
