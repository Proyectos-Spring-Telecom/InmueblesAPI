USE `Inmuebles`;

ALTER TABLE `LocalesZonaInmueble`
  ADD COLUMN `FachadaUrl` VARCHAR(500) NULL AFTER `FHRegistro`;
