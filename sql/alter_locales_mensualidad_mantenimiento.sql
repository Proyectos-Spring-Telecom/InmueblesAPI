USE `Inmuebles`;

ALTER TABLE `LocalesZonaInmueble`
  ADD COLUMN `MensualidadIVA` DECIMAL(10,2) NULL AFTER `FachadaUrl`,
  ADD COLUMN `Mantenimiento` DECIMAL(10,2) NULL AFTER `MensualidadIVA`,
  ADD COLUMN `MantenimientoIVA` DECIMAL(10,2) NULL AFTER `Mantenimiento`;
