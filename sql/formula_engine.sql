-- 1. Agregar columnas a tabla Formulas existente
ALTER TABLE `Formulas`
  ADD COLUMN `Descripcion` VARCHAR(500) NULL AFTER `Formula`,
  ADD COLUMN `TipoResultado` ENUM('MONTO','PORCENTAJE') NOT NULL DEFAULT 'MONTO' AFTER `Descripcion`,
  ADD COLUMN `FHActualizacion` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER `FHRegistro`;

-- 2. Tabla de auditoría de evaluaciones
CREATE TABLE IF NOT EXISTS `FormulaEvaluaciones` (
  `Id`              BIGINT NOT NULL AUTO_INCREMENT,
  `IdFormula`       BIGINT NOT NULL,
  `IdContrato`      BIGINT NULL,
  `IdArrendatario`  BIGINT NULL,
  `VariablesUsadas` JSON NOT NULL COMMENT 'Snapshot de variables y valores al evaluar',
  `ExpresionFinal`  VARCHAR(500) NULL COMMENT 'Expresión con valores sustituidos',
  `Resultado`       DECIMAL(14,4) NOT NULL,
  `MesAplicacion`   DATETIME NULL,
  `FHRegistro`      DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`Id`),
  KEY `FK_FormulaEval_Formula_idx` (`IdFormula`),
  CONSTRAINT `FK_FormulaEval_Formula` FOREIGN KEY (`IdFormula`) REFERENCES `Formulas` (`Id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 3. Seed de fórmulas INPC
INSERT INTO `Formulas` (`Nombre`, `Formula`, `Descripcion`, `TipoResultado`) VALUES
('Actualización de Renta por INPC',
 'RENTA_ACTUAL * (INPC_ACTUAL / INPC_BASE)',
 'Nueva renta = renta actual × (INPC actual / INPC base)',
 'MONTO'),
('Inflación Anual',
 '((INPC_ACTUAL - INPC_ANIO_ANTERIOR) / INPC_ANIO_ANTERIOR) * 100',
 'Porcentaje de inflación interanual',
 'PORCENTAJE'),
('Inflación Acumulada Anual',
 '((INPC_ACTUAL - INPC_DIC_ANTERIOR) / INPC_DIC_ANTERIOR) * 100',
 'Inflación acumulada desde diciembre del año anterior',
 'PORCENTAJE');

-- 4. Seed de factores de ejemplo
INSERT INTO `Factores` (`Variable`, `Valor`, `Descripcion`) VALUES
('RENTA_ACTUAL', '10000', 'Renta mensual vigente'),
('INPC_ACTUAL', '140.0000', 'INPC del mes actual'),
('INPC_BASE', '134.0000', 'INPC base del contrato'),
('INPC_ANIO_ANTERIOR', '134.0000', 'INPC del mismo mes del año anterior'),
('INPC_DIC_ANTERIOR', '136.5000', 'INPC de diciembre del año anterior'),
('IVA', '16', 'Porcentaje de IVA vigente');
