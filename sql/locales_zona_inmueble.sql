USE `Inmuebles`;

CREATE TABLE IF NOT EXISTS `LocalesZonaInmueble` (
  `Id` bigint NOT NULL AUTO_INCREMENT,
  `Nombre` varchar(250) DEFAULT NULL,
  `AreaM2` decimal(10,2) DEFAULT NULL,
  `Estatus` tinyint DEFAULT NULL COMMENT '0 Baja\n1 Disponible\n2 Ocupado \n3 Apartado',
  `Mensualidad` decimal(10,2) DEFAULT NULL,
  `Giro` varchar(100) DEFAULT NULL,
  `IdZona` bigint DEFAULT NULL,
  `FHRegistro` datetime DEFAULT CURRENT_TIMESTAMP,
  `FachadaUrl` varchar(500) DEFAULT NULL,
  PRIMARY KEY (`Id`),
  KEY `FK_Zona_Locales_idx` (`IdZona`),
  CONSTRAINT `FK_Zona_Locales`
    FOREIGN KEY (`IdZona`)
    REFERENCES `ZonasInmuebles` (`Id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
