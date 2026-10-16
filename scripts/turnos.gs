const SHEET_NAME = "Turnos";
const HEADERS = ["Fecha", "Hora", "Nombre", "Telefono", "Servicio", "Nota", "Creado"];

function doPost(e) {
  const body = JSON.parse(e.postData.contents);
  const secret = PropertiesService.getScriptProperties().getProperty("SECRET");
  if (!secret || body.secret !== secret) {
    return json({ ok: false, error: "No autorizado." });
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    if (body.action === "ocupados") return json({ ok: true, horas: ocupados(body.fecha) });
    if (body.action === "agendar") return json(agendar(body));
    return json({ ok: false, error: "Acción desconocida." });
  } finally {
    lock.releaseLock();
  }
}

function ocupados(fecha) {
  return filas()
    .filter((row) => row[0] === fecha)
    .map((row) => row[1]);
}

function agendar(body) {
  if (ocupados(body.fecha).indexOf(body.hora) !== -1) {
    return { ok: false, error: "Ese turno ya está reservado." };
  }
  hoja().appendRow([
    body.fecha,
    body.hora,
    body.nombre,
    body.telefono,
    body.servicio,
    body.nota || "",
    new Date(),
  ]);
  return { ok: true, fecha: body.fecha, hora: body.hora };
}

function hoja() {
  const book = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = book.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = book.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) sheet.appendRow(HEADERS);
  return sheet;
}

function filas() {
  const sheet = hoja();
  const values = sheet.getDataRange().getValues();
  return values.slice(1);
}

function json(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
    ContentService.MimeType.JSON,
  );
}
