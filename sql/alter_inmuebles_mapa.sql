USE `Inmuebles`;

ALTER TABLE `Inmuebles`
  ADD COLUMN `MapaInmueble` JSON NULL AFTER `Lng`;
