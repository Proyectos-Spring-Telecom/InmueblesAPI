USE `Inmuebles`;

CREATE TABLE IF NOT EXISTS `PagosArrendatarios` (
  `Id` BIGINT NOT NULL AUTO_INCREMENT,
  `IdArrendatario` BIGINT NULL,
  `IdServicioArrendatario` BIGINT NULL,
  `Concepto` VARCHAR(100) NULL,
  `FechaPago` DATETIME NULL,
  `Monto` DECIMAL(10,2) NULL,
  `IdMetodoPago` BIGINT NULL,
  `Estatus` TINYINT NULL COMMENT 'Pendiente = 2\nPagado = 1\nCancelado = 0',
  `FHRegistro` DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
  `ComprobantePago` VARCHAR(500) NULL,
  PRIMARY KEY (`Id`),
  KEY `FK_Arrendatario_PagoArrendatario_idx` (`IdArrendatario`),
  KEY `FK_Servicio_Arrendatario_Pago_idx` (`IdServicioArrendatario`),
  KEY `FK_Metodo_PagoArrendatario_idx` (`IdMetodoPago`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
