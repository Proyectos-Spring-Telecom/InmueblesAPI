USE `Inmuebles`;

ALTER TABLE `ContratoArrendatarios`
  ADD COLUMN `IdLocal` BIGINT NULL AFTER `Estatus`,
  ADD INDEX `FK_Contrato_Locales_idx` (`IdLocal` ASC);

ALTER TABLE `ContratoArrendatarios`
  ADD CONSTRAINT `FK_Contrato_Locales`
    FOREIGN KEY (`IdLocal`)
    REFERENCES `LocalesZonaInmueble` (`Id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION;
