USE `Inmuebles`;

CREATE TABLE IF NOT EXISTS `Estacionamientos` (
  `Id` BIGINT NOT NULL AUTO_INCREMENT,
  `IdInmueble` BIGINT NULL,
  `NombrePensionado` VARCHAR(200) NULL,
  `NumeroTarjeta` VARCHAR(50) NULL,
  `IdArrendatario` BIGINT NULL,
  `FHRegistro` DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
  `Estatus` TINYINT NULL DEFAULT 1,
  PRIMARY KEY (`Id`),
  KEY `FK_Estacionamiento_Inmueble_idx` (`IdInmueble`),
  KEY `FK_Estacionamiento_Arrendatario_idx` (`IdArrendatario`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
