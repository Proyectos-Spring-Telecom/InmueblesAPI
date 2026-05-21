USE `Inmuebles`;

CREATE TABLE IF NOT EXISTS `EntradasSalidasEstacionamiento` (
  `Id` BIGINT NOT NULL AUTO_INCREMENT,
  `Boleto` VARCHAR(45) NULL,
  `FechaEntrada` DATETIME NULL,
  `FechaSalida` DATETIME NULL,
  `Total` DECIMAL(10,2) NULL,
  `IdInmueble` BIGINT NULL,
  `FHRegistro` DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`Id`),
  KEY `FK_EntradasSalidas_Inmueble_idx` (`IdInmueble`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
COMMENT='Entradas y salidas de estacionamiento importadas desde Excel';
