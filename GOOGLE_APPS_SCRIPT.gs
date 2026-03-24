/**
 * ArqueoPro - Backend para Google Apps Script
 * Versión 1.3 - Mejoras en Diagnóstico de Errores
 */

// SpreadsheetApp.openById(""); // Forzar el permiso de edición de hojas

function getSS(id) {
  if (!id || id === "null" || id === "undefined" || id.length < 5) {
    try {
      return SpreadsheetApp.getActiveSpreadsheet();
    } catch (e) {
      return null;
    }
  }
  try {
    return SpreadsheetApp.openById(id);
  } catch (e) {
    return null;
  }
}

function doGet(e) {
  return doPost(e);
}

function doPost(e) {
  var output = { success: false, error: "Unknown error" };
  try {
    var data;
    if (e && e.postData && e.postData.contents) {
      data = JSON.parse(e.postData.contents);
    } else if (e && e.parameter) {
      data = e.parameter;
    } else {
      output.error = "Cuerpo de petición vacío o parámetros faltantes. Asegúrese de enviar un POST con JSON.";
      return createJsonResponse(output);
    }

    var action = data.action;
    var sheetName = data.sheet;
    var spreadsheetId = data.spreadsheetId || data.id;
    
    Logger.log("Action: " + action + ", Sheet: " + sheetName + ", ID: " + spreadsheetId);

    if (action === 'test') {
      return createJsonResponse({ 
        success: true, 
        message: "Conexión exitosa con el script v1.3",
        timestamp: new Date().toISOString()
      });
    }

    var ss = getSS(spreadsheetId);
    if (!ss) {
      output.error = "No se pudo acceder a la hoja de cálculo. Verifique el ID (" + spreadsheetId + ") y que el script tenga permisos de edición.";
      return createJsonResponse(output);
    }
    
    if (action === 'read') {
      var sheet = ss.getSheetByName(sheetName);
      if (!sheet) {
        return createJsonResponse([]);
      }
      var range = sheet.getDataRange();
      if (range.isBlank()) {
        return createJsonResponse([]);
      }
      var values = range.getValues();
      return createJsonResponse(values);
    }
    
    if (action === 'verify') {
      verifySheets(ss);
      return createJsonResponse({ success: true });
    }
    
    if (action === 'append') {
      var sheet = ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);
      sheet.appendRow(data.values || []);
      return createJsonResponse({ success: true });
    }

    if (action === 'update') {
      var sheet = ss.getSheetByName(sheetName);
      if (!sheet) throw new Error("Hoja '" + sheetName + "' no encontrada");
      var range = sheet.getRange(data.range);
      range.setValues(data.values);
      return createJsonResponse({ success: true });
    }
    
    output.error = "Acción desconocida: " + action;
  } catch (err) {
    Logger.log("Error: " + err.toString());
    output.error = err.toString();
  }
  return createJsonResponse(output);
}

function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function verifySheets(ss) {
  var required = {
    'USUARIO': ['ID', 'EMAIL', 'PASSWORD_HASH', 'NOMBRE', 'ROL', 'SUCURSAL_ID', 'ACTIVO', 'CREATED_AT'],
    'SUCURSAL': ['ID_SUCURSAL', 'SUCURSAL', 'LONGITUD', 'LATITUD', 'CATEGORIA', 'EMPRESA', 'GERENTE_ASIGNADO'],
    'ARQUEOS': ['ID', 'USER_ID', 'SUCURSAL_ID', 'FECHA', 'TURNO', 'TASA_BCV', 'VENTA_TOTAL', 'TRANSACCIONES', 'FONDO_BS', 'FONDO_USD', 'EFECTIVO_BS', 'EFECTIVO_USD', 'PAGOMOVIL_BS', 'PAGOMOVIL_USD', 'ZELLE', 'POS_VENEZUELA', 'POS_BANPLUS', 'POS_MERCANTIL', 'POS_DETALLES', 'APPS_PEDIDOSYA', 'APPS_YUMMY', 'APPS_ZUPPER', 'GASTOS', 'ENCARGADO', 'CAJERA', 'TIMESTAMP'],
    'GASTOS': ['ID', 'ARQUEO_ID', 'USER_ID', 'FECHA', 'TIENDA_ID', 'MONTO', 'DESCRIPCION', 'TIPO', 'AUTORIZADO_POR', 'TIMESTAMP'],
    'PAGOS_MOVIL': ['ID', 'ARQUEO_ID', 'USER_ID', 'FECHA', 'TIENDA_ID', 'MONTO_BS', 'REFERENCIA', 'BANCO', 'TITULAR', 'VERIFICADO', 'TIMESTAMP'],
    'AUDITORIA': ['ID', 'USER_ID', 'ACCION', 'DETALLES', 'TIMESTAMP']
  };
  
  for (var name in required) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
      sheet.appendRow(required[name]);
    } else {
      var headers = sheet.getRange(1, 1, 1, required[name].length).getValues()[0];
      if (headers[0] === "") {
        sheet.getRange(1, 1, 1, required[name].length).setValues([required[name]]);
      }
    }
  }
}
