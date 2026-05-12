# Módulo `pdf-ocr`

## Endpoint

- `POST /api/pdf-ocr/upload` (multipart **form-data**)
  - `file`: PDF en memoria (`memoryStorage`).
  - El **id de módulo para bitácora** es fijo en servidor (`16`); no se envía en el formulario ni aparece en Swagger.

Autenticación: header `Authorization: Bearer <JWT>` (esquema **access-token** en Swagger).

## Flujo híbrido

1. Se analizan las primeras 3 páginas con **pdfjs-dist**: si hay suficiente texto nativo (>50 caracteres no vacíos), se extrae texto de **todas** las páginas sin OCR.
2. Si no, se convierte el PDF a PNG (300 DPI) con **pdf2pic**, se preprocesa con **sharp** y se reconoce con **tesseract.js** (`spa` + `eng`).

## Requisitos de sistema

**pdf2pic** depende de **GraphicsMagick** (o ImageMagick) y **Ghostscript** instalados en el servidor.

- **Windows**: instaladores oficiales de GraphicsMagick y Ghostscript.
- **Linux**: `sudo apt-get install -y graphicsmagick ghostscript`
- **macOS**: `brew install graphicsmagick ghostscript`

## Variables de entorno

- `UPLOAD_MAX_SIZE` (opcional): tamaño máximo en bytes para la validación en servicio (mismo criterio que S3). Si no está definida o no es un número válido, el valor por defecto es **10 MB**. El interceptor de carga acepta hasta **25 MB**; conviene alinear `UPLOAD_MAX_SIZE` con la política deseada.

## Base de datos

Con `synchronize: false`, crear la tabla manualmente ejecutando el script:

`src/pdf-ocr/sql/create-table.sql`

(Ajustar esquema/base de datos según tu entorno MySQL si aplica.)

## Pendiente

- Integración con **BullMQ** (o similar) para procesamiento asíncrono de PDFs grandes y colas de trabajo.
