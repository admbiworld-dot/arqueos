import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { google } from 'googleapis';
import cors from 'cors';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import cookieParser from 'cookie-parser';
import { Readable } from 'stream';
import fs from 'fs';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'arqueopro-v2-secret-key-2026';
const CONFIG_FILE = path.join(process.cwd(), 'config.json');

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  app.use(cookieParser());
  app.use(cors({
    origin: true,
    credentials: true
  }));

  // Google Sheets Auth
  let credentials;
  if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    try {
      credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
    } catch (e) {
      console.error('Initial GOOGLE_SERVICE_ACCOUNT_KEY is not valid JSON, skipping direct Sheets API auth');
    }
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });
  
  function extractId(id: string) {
    if (!id) return '';
    if (id.includes('docs.google.com')) {
      const match = id.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
      return match ? match[1] : id;
    }
    return id.trim();
  }

  let SPREADSHEET_ID = extractId(process.env.GOOGLE_SHEETS_ID || '1LzvB0RjeOrCLmfGPdEtEXAVhviel_it8soYQlgjegyw');
  let WEB_APP_URL = (process.env.WEB_APP_URL || 'https://script.google.com/macros/s/AKfycbwUDLN3mjmnGAO25NKlX23DNU29IASOmy_AYYyKZx1gIlAgX_54Gs1GiaWw7m_tmYtp/exec').trim();
  let SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
  let SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';
  let DB_SOURCE = process.env.DB_SOURCE || 'Google Sheets';

  // Load persisted config if exists
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      const persistedConfig = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
      if (persistedConfig.spreadsheetId) SPREADSHEET_ID = extractId(persistedConfig.spreadsheetId);
      if (persistedConfig.webAppUrl) WEB_APP_URL = persistedConfig.webAppUrl.trim();
      if (persistedConfig.supabaseUrl) SUPABASE_URL = persistedConfig.supabaseUrl.trim();
      if (persistedConfig.supabaseAnonKey) SUPABASE_ANON_KEY = persistedConfig.supabaseAnonKey.trim();
      if (persistedConfig.dbSource) DB_SOURCE = persistedConfig.dbSource.trim();
      console.log('Persisted config loaded:', { SPREADSHEET_ID, WEB_APP_URL, SUPABASE_URL, DB_SOURCE });
    } catch (e) {
      console.error('Error loading persisted config:', e);
    }
  }

  const REQUIRED_SHEETS = {
    'USUARIO': ['ID', 'CORREO', 'CLAVE', 'USUARIO', 'ROL', 'TIENDAS_ASIGNADA', 'ACTIVO', 'CREATED_AT'],
    'ZELLE': ['ID', 'TIENDA', 'USUARIO', 'FECHA', 'TIENDA', 'MONTO', 'TITULAR', 'EMISOR', 'RECEPTOR', 'MOTIVO', 'VALIDADO', 'FECHA HORA'],
    'PAGO MOVIL': ['ID', 'ARQUEO_ID', 'USER_ID', 'FECHA', 'TIENDA_ID', 'MONTO_BS', 'REFERENCIA', 'BANCO', 'TITULAR', 'VERIFICADO', 'TIMESTAMP'],
    'GASTO': ['ID', 'ARQUEO_ID', 'USER_ID', 'FECHA', 'TIENDA_ID', 'MONTO', 'DESCRIPCION', 'TIPO', 'AUTORIZADO_POR', 'TIMESTAMP'],
    'LOTES POSS': ['ID', 'ARQUEO_ID', 'USER_ID', 'FECHA', 'TIENDA_ID', 'LOTE', 'BANCO', 'MONTO_BS', 'MONTO_$', 'TASA', 'TIMESTAMP']
  };

  // Auth Middleware
  const authenticateToken = (req: any, res: any, next: any) => {
    console.log('--- Auth Middleware ---');
    console.log('Headers:', req.headers);
    console.log('Cookies:', req.cookies);
    
    const authHeader = req.headers['authorization'];
    let token = req.cookies.token || (authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : authHeader);
    
    if (token === 'null' || token === 'undefined') {
      token = null;
    }
    
    if (!token) {
      console.log('Auth failed: No token provided.');
      return res.status(401).json({ error: 'Acceso denegado. Token no proporcionado.' });
    }

    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
      if (err) {
        console.log('Auth failed: Invalid or expired token.', err.message);
        return res.status(401).json({ error: 'Token inválido o expirado.' });
      }
      req.user = user;
      next();
    });
  };

  const authorizeRole = (roles: string[]) => {
    return (req: any, res: any, next: any) => {
      const userRole = req.user.role.toLowerCase();
      const allowedRoles = roles.map(r => r.toLowerCase());
      if (!allowedRoles.includes(userRole)) {
        return res.status(403).json({ error: 'No tienes permiso para realizar esta acción.' });
      }
      next();
    };
  };

  // API Routes

  // Config endpoint
  app.get('/api/config', authenticateToken, (req, res) => {
    res.json({ 
      spreadsheetId: SPREADSHEET_ID, 
      webAppUrl: WEB_APP_URL,
      supabaseUrl: SUPABASE_URL,
      supabaseAnonKey: SUPABASE_ANON_KEY,
      dbSource: DB_SOURCE,
      isDefaultUrl: WEB_APP_URL.includes('AKfycbwUDLN3mjmnGAO25NKlX23DNU29IASOmy_AYYyKZx1gIlAgX_54Gs1GiaWw7m_tmYtp')
    });
  });

  app.post('/api/config', async (req, res) => {
    const { spreadsheetId, serviceAccount, webAppUrl, supabaseUrl, supabaseAnonKey, dbSource } = req.body;
    try {
      if (spreadsheetId) SPREADSHEET_ID = extractId(spreadsheetId);
      
      if (webAppUrl && webAppUrl.trim()) {
        WEB_APP_URL = webAppUrl.trim();
      } else if (serviceAccount && serviceAccount.startsWith('http')) {
        WEB_APP_URL = serviceAccount.trim();
      }

      if (supabaseUrl !== undefined) SUPABASE_URL = supabaseUrl.trim();
      if (supabaseAnonKey !== undefined) SUPABASE_ANON_KEY = supabaseAnonKey.trim();
      if (dbSource !== undefined) DB_SOURCE = dbSource.trim();
      
      if (serviceAccount && !serviceAccount.startsWith('http')) {
        try {
          const credentials = JSON.parse(serviceAccount);
          const newAuth = new google.auth.GoogleAuth({
            credentials,
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
          });
          (sheets as any).context.google.auth = newAuth;
        } catch (e) {
          console.error('Invalid service account JSON:', e);
        }
      }
      
      // Persist config
      try {
        fs.writeFileSync(CONFIG_FILE, JSON.stringify({
          spreadsheetId: SPREADSHEET_ID,
          webAppUrl: WEB_APP_URL,
          supabaseUrl: SUPABASE_URL,
          supabaseAnonKey: SUPABASE_ANON_KEY,
          dbSource: DB_SOURCE
        }, null, 2));
      } catch (e) {
        console.error('Error persisting config:', e);
      }
      
      res.json({ 
        success: true, 
        spreadsheetId: SPREADSHEET_ID, 
        webAppUrl: WEB_APP_URL,
        supabaseUrl: SUPABASE_URL,
        supabaseAnonKey: SUPABASE_ANON_KEY,
        dbSource: DB_SOURCE
      });
    } catch (error) {
      console.error('Error updating config:', error);
      res.status(500).json({ error: 'Failed to update configuration' });
    }
  });

  // Test GAS Connection endpoint
  app.get('/api/test-gas', authenticateToken, async (req, res) => {
    try {
      const result = await callGAS('test');
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Error al probar la conexión' });
    }
  });  // Helper to call GAS Web App
  async function callGAS(action: string, params: any = {}) {
    if (!WEB_APP_URL) throw new Error('Web App URL no configurada. Vaya a Configuración.');
    
    const cleanUrl = WEB_APP_URL.trim();
    if (!cleanUrl.startsWith('http')) {
      throw new Error('La URL de la Web App no es válida. Debe comenzar con http:// o https://');
    }
    
    if (cleanUrl.includes('script.google.com') && !cleanUrl.includes('/macros/s/')) {
      throw new Error('La URL de Google Apps Script parece incompleta. Debe contener "/macros/s/".');
    }
    
    console.log(`Calling GAS (${action}) at: ${cleanUrl}`);
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

      const response = await fetch(cleanUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ action, spreadsheetId: SPREADSHEET_ID, ...params }),
        redirect: 'follow',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      const text = await response.text();
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`URL no encontrada (404) en: ${cleanUrl}. ID de Hoja: ${SPREADSHEET_ID}. Esto suele significar que la URL de la Web App es incorrecta o que la implementación fue eliminada en Google Apps Script.`);
        }
        throw new Error(`Google devolvió error ${response.status}: ${text.substring(0, 100)}`);
      }

      try {
        const data = JSON.parse(text);
        if (data && typeof data === 'object' && data.success === false) {
          // If it's a valid JSON with success: false, throw that error directly
          // and don't let it be caught by the "non-JSON" diagnosis logic
          const gasError = new Error(`${data.error || `Error en operación ${action}`} (ID de Hoja: ${SPREADSHEET_ID})`);
          (gasError as any).isGasError = true;
          throw gasError;
        }
        return data;
      } catch (e: any) {
        if (e.isGasError) throw e;
        
        console.error(`GAS returned non-JSON response (${action}):`, text.substring(0, 500));
        
        let diag = `La URL devolvió HTML en lugar de JSON. URL consultada: ${cleanUrl}`;
        const lowerText = text.toLowerCase();
        
        if (text.includes('script.google.com/macros/s/')) {
          diag = `URL de "Desarrollo" detectada. Use la URL de "Ejecución" (/exec). URL: ${cleanUrl}`;
        } else if (text.includes('404') || lowerText.includes('not found')) {
          diag = `URL no encontrada (404). Verifique que la URL sea exactamente la que copió de Google. URL: ${cleanUrl}`;
        } else if (lowerText.includes('sign in') || lowerText.includes('accounts') || lowerText.includes('iniciar sesión') || lowerText.includes('cuentas')) {
          diag = `Error de Autenticación. Asegúrese de que la Web App esté publicada con acceso para "Cualquiera" (Anyone). URL: ${cleanUrl}`;
        } else if (lowerText.includes('script error') || lowerText.includes('error de script') || lowerText.includes('error en el script')) {
          diag = `Error interno en el script de Google. Abra el editor de Apps Script, haga clic en "Ejecutar" para autorizar permisos y revise los logs de ejecuciones. URL: ${cleanUrl}`;
        } else if (lowerText.includes('authorization required') || lowerText.includes('autorización necesaria')) {
          diag = `Se requiere autorización del script. Abra el editor de Apps Script y haga clic en el botón "Ejecutar" (triángulo) para otorgar permisos. URL: ${cleanUrl}`;
        } else if (lowerText.includes('permiso') || lowerText.includes('permission') || lowerText.includes('no se pudo acceder')) {
          diag = `Error de permisos en la Hoja de Cálculo. Verifique que el ID de la hoja (${SPREADSHEET_ID}) sea correcto y que la cuenta que desplegó el script tenga acceso de edición a la hoja. URL: ${cleanUrl}`;
        } else if (text.includes('Google Apps Script') && text.includes('Error')) {
          diag = `Error general de Google Apps Script. Verifique que el script esté publicado correctamente y que haya otorgado los permisos necesarios. URL: ${cleanUrl}`;
        }
        
        throw new Error(`Error de Google Apps Script: ${diag}\n\nDetalle: ${text.substring(0, 100)}...`);
      }
    } catch (error: any) {
      if (error.name === 'AbortError') throw new Error('La conexión con Google tardó demasiado (Timeout).');
      console.error(`Error calling GAS (${action}):`, error);
      throw error;
    }
  }

  // Verify and Create Tabs endpoint
  app.post('/api/verify-sheets', async (req, res) => {
    try {
      if (WEB_APP_URL) {
        const result = await callGAS('verify');
        return res.json(result);
      }

      if (!SPREADSHEET_ID) {
        return res.status(400).json({ error: 'ID de Hoja no configurado' });
      }

      const spreadsheet = await sheets.spreadsheets.get({
        spreadsheetId: SPREADSHEET_ID,
      });

      const existingSheets = spreadsheet.data.sheets?.map(s => s.properties?.title) || [];
      
      for (const [sheetName, headers] of Object.entries(REQUIRED_SHEETS)) {
        if (!existingSheets.includes(sheetName)) {
          // Create sheet
          await sheets.spreadsheets.batchUpdate({
            spreadsheetId: SPREADSHEET_ID,
            requestBody: {
              requests: [{
                addSheet: {
                  properties: { title: sheetName }
                }
              }]
            }
          });
          
          // Add headers
          await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `${sheetName}!A1`,
            valueInputOption: 'RAW',
            requestBody: { values: [headers] }
          });
        } else {
          // Check headers and update if missing columns
          const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `${sheetName}!A1:Z1`,
          });
          
          const currentHeaders = response.data.values?.[0] || [];
          if (currentHeaders.length < headers.length) {
            // Overwrite headers to ensure all columns are present
            await sheets.spreadsheets.values.update({
              spreadsheetId: SPREADSHEET_ID,
              range: `${sheetName}!A1`,
              valueInputOption: 'RAW',
              requestBody: { values: [headers] }
            });
          }
        }
      }

      res.json({ success: true, message: 'Hojas verificadas y creadas con éxito' });
    } catch (error: any) {
      console.error('Error verifying sheets:', error);
      res.status(500).json({ error: error.message || 'Error al verificar las hojas.' });
    }
  });

  // Test GAS connection endpoint
  app.post('/api/test-gas', async (req, res) => {
    try {
      if (!WEB_APP_URL) {
        return res.status(400).json({ error: 'URL de Web App no configurada' });
      }
      const result = await callGAS('test');
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Fallo en la conexión con GAS' });
    }
  });

  // Get stores endpoint
  app.get('/api/stores', authenticateToken, async (req: any, res) => {
    try {
      let rows: any[][] = [];
      if (WEB_APP_URL) {
        rows = await callGAS('read', { sheet: 'SUCURSAL' });
      } else if (SPREADSHEET_ID) {
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: 'SUCURSAL!A:G',
        });
        rows = response.data.values || [];
      } else {
        return res.json([]);
      }

      if (rows.length < 2) return res.json([]);
      const headers = rows[0];
      let stores = rows.slice(1).map(row => {
        const obj: any = {};
        headers.forEach((header, index) => {
          obj[header] = row[index];
        });
        return {
          id: obj.ID_SUCURSAL,
          name: obj.SUCURSAL,
          longitude: obj.LONGITUD,
          latitude: obj.LATITUD,
          category: obj.CATEGORIA,
          company: obj.EMPRESA,
          gerenteAsignado: obj.GERENTE_ASIGNADO
        };
      });

      // RBAC Filtering for stores
      if (req.user.role === 'Gerente de Tienda') {
        stores = stores.filter(s => s.id === req.user.sucursalId);
      }

      res.json(stores);
    } catch (error: any) {
      console.error('Error reading SUCURSAL sheet:', error);
      res.json([]);
    }
  });

  app.post('/api/arqueos', authenticateToken, async (req: any, res) => {
    try {
      const data = req.body;
      
      // RBAC Check: Gerente can only create for their assigned store
      if (req.user.role === 'Gerente de Tienda' && data.tiendaId !== req.user.sucursalId) {
        return res.status(403).json({ error: 'No tienes permiso para registrar arqueos en esta sucursal.' });
      }

      const values = [
        Date.now().toString(),
        req.user.id,
        data.tiendaId,
        data.date,
        data.turno,
        data.tasaBcv,
        data.ventaTotal,
        data.transacciones,
        data.fondoBs,
        data.fondoUsd,
        data.efectivo.bs,
        data.efectivo.usd,
        data.pagoMovil.bs,
        data.pagoMovil.usd,
        data.zelle,
        data.puntosVenta.venezuela.lotes.reduce((s: number, l: any) => s + (l.bs || 0), 0),
        data.puntosVenta.banplus.lotes.reduce((s: number, l: any) => s + (l.bs || 0), 0),
        data.puntosVenta.mercantil.lotes.reduce((s: number, l: any) => s + (l.bs || 0), 0),
        `${data.puntosVenta.venezuela.lotes.map((l: any) => `L${l.numero}: ${l.bs}`).join('; ')} | ${data.puntosVenta.banplus.lotes.map((l: any) => `L${l.numero}: ${l.bs}`).join('; ')} | ${data.puntosVenta.mercantil.lotes.map((l: any) => `L${l.numero}: ${l.bs}`).join('; ')}`,
        data.apps.pedidosYa,
        data.apps.yummy,
        data.apps.zupper,
        data.gastos,
        data.encargado,
        data.cajera,
        new Date().toISOString()
      ];

      if (WEB_APP_URL) {
        await callGAS('append', { sheet: 'ARQUEOS', values });
      } else if (SPREADSHEET_ID) {
        await sheets.spreadsheets.values.append({
          spreadsheetId: SPREADSHEET_ID,
          range: 'ARQUEOS!A:Z',
          valueInputOption: 'RAW',
          requestBody: { values: [values] },
        });
      }

      res.json({ success: true });
    } catch (error) {
      console.error('Error writing to Google Sheets:', error);
      res.status(500).json({ error: 'Failed to write to Google Sheets' });
    }
  });

  // Test GAS connection
  app.post('/api/test-gas', authenticateToken, async (req: any, res) => {
    try {
      const { webAppUrl, spreadsheetId } = req.body;
      
      if (!webAppUrl) return res.status(400).json({ error: 'URL de Web App requerida' });
      
      const cleanUrl = webAppUrl.trim();
      const response = await fetch(cleanUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test', spreadsheetId }),
        redirect: 'follow'
      });
      
      const text = await response.text();
      if (!response.ok) {
        return res.status(response.status).json({ error: `Google devolvió error ${response.status}: ${text.substring(0, 100)}` });
      }
      
      try {
        const data = JSON.parse(text);
        res.json(data);
      } catch (e) {
        res.status(500).json({ error: 'La respuesta de Google no fue un JSON válido.', detail: text.substring(0, 200) });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Error al probar conexión' });
    }
  });

  // Zelle endpoints
  app.get('/api/zelle', authenticateToken, async (req: any, res) => {
    try {
      let rows: any[][] = [];
      if (WEB_APP_URL) {
        rows = await callGAS('read', { sheet: 'ZELLE' });
      } else if (SPREADSHEET_ID) {
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: 'ZELLE!A:K',
        });
        rows = response.data.values || [];
      } else {
        return res.json([]);
      }

      if (rows.length < 2) return res.json([]);
      const headers = rows[0];
      let data = rows.slice(1).map(row => {
        const obj: any = {};
        headers.forEach((h: string, i: number) => {
          if (h === 'TITULAR') obj.titular = row[i];
          else if (h === 'RECEPTOR') obj.receptor = row[i];
          else if (h === 'MOTIVO') obj.motivo = row[i];
          else if (h === 'FECHA') obj.date = row[i];
          else if (h === 'TIENDA') obj.tiendaId = row[i];
          else if (h === 'MONTO') obj.monto = parseFloat(row[i]) || 0;
          else if (h === 'VALIDADO') obj.verificado = row[i] === 'TRUE';
          else if (h === 'USUARIO') obj.userId = row[i];
          else if (h === 'FECHA HORA') obj.timestamp = row[i];
          else if (h === 'ID') obj.id = row[i];
          else obj[h] = row[i];
        });
        return obj;
      });

      // RBAC Filtering
      if (req.user.role !== 'Superadmin' && req.user.role !== 'Verificador Zelle y Pago Movil') {
        data = data.filter(d => d.userId === req.user.id);
      }

      res.json(data);
    } catch (error: any) {
      console.error('Error reading ZELLE:', error);
      res.status(500).json({ error: error.message || 'Error reading ZELLE' });
    }
  });

  app.post('/api/zelle', authenticateToken, async (req: any, res) => {
    try {
      const { date, tiendaId, monto, titular, receptor, motivo } = req.body;

      const values = [
        Date.now().toString(),
        '', // ARQUEO_ID
        req.user.id,
        date,
        tiendaId,
        monto,
        titular,
        receptor,
        motivo,
        'FALSE',
        new Date().toISOString()
      ];
      
      if (WEB_APP_URL) {
        await callGAS('append', { sheet: 'ZELLE', values });
      } else if (SPREADSHEET_ID) {
        await sheets.spreadsheets.values.append({
          spreadsheetId: SPREADSHEET_ID,
          range: 'ZELLE!A:K',
          valueInputOption: 'RAW',
          requestBody: { values: [values] },
        });
      }
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error writing ZELLE:', error);
      res.status(500).json({ error: error.message || 'Error writing ZELLE' });
    }
  });

  app.post('/api/verificar-zelle', authenticateToken, async (req: any, res) => {
    try {
      const { id, verificado } = req.body;
      
      let rows: any[][] = [];
      if (WEB_APP_URL) {
        rows = await callGAS('read', { sheet: 'ZELLE' });
      } else if (SPREADSHEET_ID) {
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: 'ZELLE!A:K',
        });
        rows = response.data.values || [];
      } else {
        return res.json({ success: true });
      }
      
      const headers = rows[0];
      const idIndex = headers.indexOf('ID');
      const verIndex = headers.indexOf('VERIFICADO');
      if (verIndex === -1) {
        return res.status(500).json({ error: 'Columna VERIFICADO no encontrada en la hoja ZELLE' });
      }
      const userIndex = headers.indexOf('USER_ID');
      
      const rowIndex = rows.findIndex(r => String(r[idIndex]) === String(id));
      
      if (rowIndex !== -1) {
        // RBAC Check: Only owner, Superadmin or Verificador Zelle can verify
        if (req.user.role !== 'Superadmin' && req.user.role !== 'Verificador Zelle y Pago Movil' && rows[rowIndex][userIndex] !== req.user.id) {
          return res.status(403).json({ error: 'No tienes permiso para verificar este Zelle.' });
        }

        const newValue = verificado ? 'TRUE' : 'FALSE';
        const colLetter = String.fromCharCode(65 + verIndex);
        
        if (WEB_APP_URL) {
          await callGAS('update', { 
            sheet: 'ZELLE', 
            range: `${colLetter}${rowIndex + 1}`, 
            values: [[newValue]] 
          });
        } else {
          await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `ZELLE!${colLetter}${rowIndex + 1}`,
            valueInputOption: 'RAW',
            requestBody: { values: [[newValue]] }
          });
        }
        res.json({ success: true });
      } else {
        res.status(404).json({ error: 'Zelle no encontrado' });
      }
    } catch (error) {
      res.status(500).json({ error: 'Error al verificar el Zelle' });
    }
  });

  app.get('/api/arqueos', authenticateToken, async (req: any, res) => {
    try {
      let rows: any[][] = [];
      if (WEB_APP_URL) {
        rows = await callGAS('read', { sheet: 'ARQUEOS' });
      } else if (SPREADSHEET_ID) {
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: 'ARQUEOS!A:Z',
        });
        rows = response.data.values || [];
      } else {
        return res.json([]);
      }

      if (rows.length < 2) return res.json([]);
      const headers = rows[0];
      let data = rows.slice(1).map(row => {
        const obj: any = {};
        headers.forEach((header, index) => {
          obj[header] = row[index];
        });
        return obj;
      });

      // RBAC Filtering
      if (req.user.role !== 'Superadmin') {
        data = data.filter(d => d.USER_ID === req.user.id);
      }

      res.json(data);
    } catch (error: any) {
      console.error('Error reading from Google Sheets:', error);
      res.status(500).json({ error: error.message || 'Failed to read from Google Sheets' });
    }
  });

  // Gastos endpoints
  app.get('/api/gastos', authenticateToken, async (req: any, res) => {
    try {
      let rows: any[][] = [];
      if (WEB_APP_URL) {
        rows = await callGAS('read', { sheet: 'GASTO' });
      } else if (SPREADSHEET_ID) {
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: 'GASTO!A:J',
        });
        rows = response.data.values || [];
      } else {
        return res.json([]);
      }

      if (rows.length < 2) return res.json([]);
      const headers = rows[0];
      let data = rows.slice(1).map(row => {
        const obj: any = {};
        headers.forEach((h, i) => {
          if (h === 'AUTORIZADO_POR') obj.autorizadoPor = row[i];
          else if (h === 'FECHA') obj.date = row[i];
          else if (h === 'TIENDA_ID') obj.tiendaId = row[i];
          else if (h === 'MONTO') obj.monto = row[i];
          else if (h === 'DESCRIPCION') obj.descripcion = row[i];
          else if (h === 'TIPO') obj.tipo = row[i];
          else if (h === 'USER_ID') obj.userId = row[i];
          else if (h === 'TIMESTAMP') obj.timestamp = row[i];
          else obj[h] = row[i];
        });
        return obj;
      });

      // RBAC Filtering
      if (req.user.role !== 'Superadmin') {
        data = data.filter(d => d.userId === req.user.id);
      }

      res.json(data);
    } catch (error: any) {
      console.error('Error reading GASTO:', error);
      res.status(500).json({ error: error.message || 'Error reading GASTO' });
    }
  });

  app.post('/api/gastos', authenticateToken, async (req: any, res) => {
    try {
      const { date, tiendaId, monto, descripcion, tipo, autorizadoPor } = req.body;
      const values = [
        Date.now().toString(), 
        '', // ARQUEO_ID
        req.user.id, 
        date, 
        tiendaId, 
        monto, 
        descripcion, 
        tipo, 
        autorizadoPor, 
        new Date().toISOString()
      ];
      
      if (WEB_APP_URL) {
        await callGAS('append', { sheet: 'GASTO', values });
      } else if (SPREADSHEET_ID) {
        await sheets.spreadsheets.values.append({
          spreadsheetId: SPREADSHEET_ID,
          range: 'GASTO!A:J',
          valueInputOption: 'RAW',
          requestBody: { values: [values] },
        });
      }
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error writing GASTO:', error);
      res.status(500).json({ error: error.message || 'Error writing GASTO' });
    }
  });

  // Pagos Movil endpoints
  app.get('/api/pagos-movil', authenticateToken, async (req: any, res) => {
    try {
      let rows: any[][] = [];
      if (WEB_APP_URL) {
        rows = await callGAS('read', { sheet: 'PAGO MOVIL' });
      } else if (SPREADSHEET_ID) {
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: 'PAGO MOVIL!A:K',
        });
        rows = response.data.values || [];
      } else {
        return res.json([]);
      }

      if (rows.length < 2) return res.json([]);
      const headers = rows[0];
      let data = rows.slice(1).map(row => {
        const obj: any = {};
        headers.forEach((h, i) => {
          if (h === 'TITULAR') obj.titular = row[i];
          else if (h === 'FECHA') obj.date = row[i];
          else if (h === 'TIENDA_ID') obj.tiendaId = row[i];
          else if (h === 'MONTO_BS') obj.montoBs = row[i];
          else if (h === 'REFERENCIA') obj.referencia = row[i];
          else if (h === 'BANCO') obj.banco = row[i];
          else if (h === 'VERIFICADO') obj.verificado = row[i] === 'TRUE';
          else if (h === 'USER_ID') obj.userId = row[i];
          else if (h === 'TIMESTAMP') obj.timestamp = row[i];
          else obj[h] = row[i];
        });
        return obj;
      });

      // RBAC Filtering
      if (req.user.role !== 'Superadmin' && req.user.role !== 'Verificador Zelle y Pago Movil' && req.user.role !== 'Verificador de Pagos') {
        data = data.filter(d => d.userId === req.user.id);
      }

      res.json(data);
    } catch (error: any) {
      console.error('Error reading PAGO MOVIL:', error);
      res.status(500).json({ error: error.message || 'Error reading PAGO MOVIL' });
    }
  });

  app.post('/api/pagos-movil', authenticateToken, async (req: any, res) => {
    try {
      const { date, tiendaId, montoBs, referencia, banco, titular } = req.body;

      // Duplicate check
      let refs: any[] = [];
      if (WEB_APP_URL) {
        const rows = await callGAS('read', { sheet: 'PAGO MOVIL' });
        const headers = rows[0];
        const refIndex = headers.indexOf('REFERENCIA');
        refs = rows.slice(1).map((r: any) => r[refIndex]);
      } else if (SPREADSHEET_ID) {
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: 'PAGO MOVIL!G:G',
        });
        refs = response.data.values?.flat() || [];
      }

      if (refs.some(r => String(r) === String(referencia))) {
        return res.status(400).json({ error: 'El número de referencia ya existe' });
      }

      const values = [
        Date.now().toString(),
        '', // ARQUEO_ID
        req.user.id,
        date,
        tiendaId,
        montoBs,
        referencia,
        banco,
        titular,
        'FALSE',
        new Date().toISOString()
      ];
      
      if (WEB_APP_URL) {
        await callGAS('append', { sheet: 'PAGO MOVIL', values });
      } else if (SPREADSHEET_ID) {
        await sheets.spreadsheets.values.append({
          spreadsheetId: SPREADSHEET_ID,
          range: 'PAGO MOVIL!A:K',
          valueInputOption: 'RAW',
          requestBody: { values: [values] },
        });
      }
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error writing PAGO MOVIL:', error);
      res.status(500).json({ error: error.message || 'Error writing PAGO MOVIL' });
    }
  });

  app.post('/api/verificar-pago', authenticateToken, async (req: any, res) => {
    try {
      const { referencia, verificado } = req.body;
      
      let rows: any[][] = [];
      if (WEB_APP_URL) {
        rows = await callGAS('read', { sheet: 'PAGO MOVIL' });
      } else if (SPREADSHEET_ID) {
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: 'PAGO MOVIL!A:K',
        });
        rows = response.data.values || [];
      } else {
        return res.json({ success: true });
      }
      
      const headers = rows[0];
      const refIndex = headers.indexOf('REFERENCIA');
      const verIndex = headers.indexOf('VERIFICADO');
      if (verIndex === -1) {
        return res.status(500).json({ error: 'Columna VERIFICADO no encontrada en la hoja PAGO MOVIL' });
      }
      const userIndex = headers.indexOf('USER_ID');
      
      const rowIndex = rows.findIndex(row => String(row[refIndex]) === String(referencia));
      
      if (rowIndex !== -1) {
        // RBAC Check: Only owner or Superadmin can verify
        if (req.user.role !== 'Superadmin' && req.user.role !== 'Verificador Zelle y Pago Movil' && req.user.role !== 'Verificador de Pagos' && rows[rowIndex][userIndex] !== req.user.id) {
          return res.status(403).json({ error: 'No tienes permiso para verificar este pago.' });
        }

        const newValue = verificado ? 'TRUE' : 'FALSE';
        const colLetter = String.fromCharCode(65 + verIndex);
        
        if (WEB_APP_URL) {
          await callGAS('update', { 
            sheet: 'PAGO MOVIL', 
            range: `${colLetter}${rowIndex + 1}`, 
            values: [[newValue]] 
          });
        } else {
          await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `PAGO MOVIL!${colLetter}${rowIndex + 1}`,
            valueInputOption: 'RAW',
            requestBody: { values: [[newValue]] }
          });
        }
        res.json({ success: true });
      } else {
        res.status(404).json({ error: 'Pago no encontrado' });
      }
    } catch (error) {
      res.status(500).json({ error: 'Error al verificar el pago' });
    }
  });

  // User Management Endpoints
  app.get('/api/users', authenticateToken, authorizeRole(['Superadmin']), async (req: any, res) => {
    try {
      let rows: any[][] = [];
      if (WEB_APP_URL) {
        rows = await callGAS('read', { sheet: 'USUARIO' });
      } else if (SPREADSHEET_ID) {
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: 'USUARIO!A:H',
        });
        rows = response.data.values || [];
      }

      if (rows.length < 2) return res.json([]);
      const headers = rows[0].map(h => h.trim().toUpperCase());
      const users = rows.slice(1).map(row => {
        const obj: any = {};
        headers.forEach((header, index) => {
          obj[header] = row[index];
        });
        return {
          id: obj.ID,
          email: obj.CORREO,
          nombre: obj.USUARIO,
          role: obj.ROL,
          sucursalId: obj.TIENDAS_ASIGNADA,
          activo: obj.ACTIVO === 'TRUE',
          createdAt: obj.CREATED_AT
        };
      });

      res.json(users);
    } catch (error: any) {
      console.error('Error reading users:', error);
      res.status(500).json({ error: error.message || 'Error al leer usuarios' });
    }
  });

  app.post('/api/users', authenticateToken, authorizeRole(['Superadmin']), async (req: any, res) => {
    try {
      const { email, password, nombre, role, sucursalId } = req.body;
      const passwordHash = await bcrypt.hash(password, 10);
      const values = [
        Date.now().toString(),
        email,
        passwordHash,
        nombre,
        role,
        sucursalId || '*',
        'TRUE',
        new Date().toISOString()
      ];

      if (WEB_APP_URL) {
        await callGAS('append', { sheet: 'USUARIO', values });
      } else if (SPREADSHEET_ID) {
        await sheets.spreadsheets.values.append({
          spreadsheetId: SPREADSHEET_ID,
          range: 'USUARIO!A:H',
          valueInputOption: 'RAW',
          requestBody: { values: [values] },
        });
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error('Error creating user:', error);
      res.status(500).json({ error: error.message || 'Error al crear usuario' });
    }
  });

  // Google Drive Auth (using the same service account)
  const drive = google.drive({ version: 'v3', auth });

  // Upload photo to Google Drive
  app.post('/api/upload-photo', authenticateToken, async (req: any, res) => {
    try {
      const { fileName, base64Data, folderId } = req.body;
      if (!base64Data) return res.status(400).json({ error: 'No image data provided' });

      // Convert base64 to buffer
      const buffer = Buffer.from(base64Data.split(',')[1], 'base64');
      const stream = new Readable();
      stream.push(buffer);
      stream.push(null);

      const fileMetadata = {
        name: fileName || `visita_${Date.now()}.jpg`,
        parents: folderId ? [folderId] : []
      };

      const media = {
        mimeType: 'image/jpeg',
        body: stream
      };

      const file = await drive.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: 'id, webViewLink'
      });

      // Make file public (optional, but requested "enlace público")
      await drive.permissions.create({
        fileId: file.data.id!,
        requestBody: {
          role: 'reader',
          type: 'anyone'
        }
      });

      // Get the direct link
      const result = await drive.files.get({
        fileId: file.data.id!,
        fields: 'webViewLink'
      });

      res.json({ success: true, url: result.data.webViewLink });
    } catch (error: any) {
      console.error('Error uploading to Drive:', error);
      res.status(500).json({ error: error.message || 'Error uploading to Google Drive' });
    }
  });

  // Sync Sheets to Supabase endpoint
  app.post('/api/sync-to-supabase', authenticateToken, authorizeRole(['Superadmin']), async (req, res) => {
    try {
      const { sheetName } = req.body;
      if (!sheetName) return res.status(400).json({ error: 'Sheet name required' });

      let rows: any[][] = [];
      if (WEB_APP_URL) {
        rows = await callGAS('read', { sheet: sheetName });
      } else if (SPREADSHEET_ID) {
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: `${sheetName}!A:Z`,
        });
        rows = response.data.values || [];
      }

      if (rows.length < 2) return res.json({ success: true, message: 'No data to sync' });

      const headers = rows[0];
      const data = rows.slice(1).map(row => {
        const obj: any = {};
        headers.forEach((h, i) => obj[h] = row[i]);
        return obj;
      });

      // Here we would push to Supabase. This endpoint acts as a proxy.
      // The actual Supabase push will be handled by the client-side DataManager 
      // or we can do it here if we have the Supabase key.
      
      res.json({ success: true, data });
    } catch (error: any) {
      console.error('Sync error:', error);
      res.status(500).json({ error: error.message || 'Sync failed' });
    }
  });

  app.delete('/api/users/:id', authenticateToken, authorizeRole(['Superadmin']), async (req: any, res) => {
    try {
      const { id } = req.params;
      let rows: any[][] = [];
      if (WEB_APP_URL) {
        rows = await callGAS('read', { sheet: 'USUARIO' });
      } else if (SPREADSHEET_ID) {
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: 'USUARIO!A:H',
        });
        rows = response.data.values || [];
      }

      const headers = rows[0].map(h => h.trim().toUpperCase());
      const idIndex = headers.indexOf('ID');
      const rowIndex = rows.findIndex(row => row[idIndex] === id);

      if (rowIndex !== -1) {
        if (WEB_APP_URL) {
          const activoIndex = headers.indexOf('ACTIVO');
          if (activoIndex === -1) {
            return res.status(500).json({ error: 'Columna ACTIVO no encontrada en la hoja USUARIO' });
          }
          const colLetter = String.fromCharCode(65 + activoIndex);
          await callGAS('update', { 
            sheet: 'USUARIO', 
            range: `${colLetter}${rowIndex + 1}`, 
            values: [['FALSE']] 
          });
        } else {
          // For Sheets API, we can also just mark as inactive
          const activoIndex = headers.indexOf('ACTIVO');
          if (activoIndex === -1) {
            return res.status(500).json({ error: 'Columna ACTIVO no encontrada en la hoja USUARIO' });
          }
          const colLetter = String.fromCharCode(65 + activoIndex);
          await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `USUARIO!${colLetter}${rowIndex + 1}`,
            valueInputOption: 'RAW',
            requestBody: { values: [['FALSE']] }
          });
        }
        res.json({ success: true });
      } else {
        res.status(404).json({ error: 'Usuario no encontrado' });
      }
    } catch (error: any) {
      console.error('Error deleting user:', error);
      res.status(500).json({ error: error.message || 'Error al eliminar usuario' });
    }
  });

  // Login endpoint
  app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    
    // Default Superadmin (Bootstrapped)
    if (email === 'admbiworld@gmail.com' && password === 'admin123') {
      const user = {
        id: 'admin-0',
        email: 'admbiworld@gmail.com',
        role: 'Superadmin',
        nombre: 'Administrador Sistema',
        sucursalId: '*'
      };
      const token = jwt.sign(user, JWT_SECRET, { expiresIn: '8h' });
      res.cookie('token', token, { 
        httpOnly: true, 
        secure: true, 
        sameSite: 'none' 
      });
      return res.json({ success: true, user, token });
    }

    try {
      let rows: any[][] = [];
      if (WEB_APP_URL) {
        rows = await callGAS('read', { sheet: 'USUARIO' });
      } else if (SPREADSHEET_ID) {
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: 'USUARIO!A:H',
        });
        rows = response.data.values || [];
      }

      if (rows.length < 2) {
        return res.status(401).json({ success: false, error: 'Usuario no encontrado' });
      }

      const headers = rows[0].map(h => h.trim().toUpperCase());
      const users = rows.slice(1).map(row => {
        const obj: any = {};
        headers.forEach((header, index) => {
          obj[header] = row[index];
        });
        return obj;
      });

      const foundUser = users.find(u => u.CORREO === email);

      if (foundUser) {
        // In a real app, we use bcrypt.compare
        // For this demo, we'll check plain text if it's not hashed, or bcrypt if it is
        let isMatch = false;
        const passwordField = foundUser.PASSWORD_HASH || foundUser.PASSWORD || foundUser.CLAVE;
        if (passwordField && passwordField.startsWith('$2')) {
          isMatch = await bcrypt.compare(password, passwordField);
        } else {
          isMatch = password === passwordField;
        }

        if (isMatch) {
          const user = {
            id: foundUser.ID,
            email: foundUser.CORREO,
            role: foundUser.ROL,
            nombre: foundUser.USUARIO,
            sucursalId: foundUser.TIENDAS_ASIGNADA
          };
          const token = jwt.sign(user, JWT_SECRET, { expiresIn: '8h' });
          res.cookie('token', token, { 
            httpOnly: true, 
            secure: true, 
            sameSite: 'none' 
          });
          
          // Log audit
          if (WEB_APP_URL) {
            await callGAS('append', { 
              sheet: 'AUDITORIA', 
              values: [Date.now().toString(), user.id, 'LOGIN', 'Inicio de sesión exitoso', new Date().toISOString()] 
            });
          } else if (SPREADSHEET_ID) {
            await sheets.spreadsheets.values.append({
              spreadsheetId: SPREADSHEET_ID,
              range: 'AUDITORIA!A:E',
              valueInputOption: 'RAW',
              requestBody: { values: [[Date.now().toString(), user.id, 'LOGIN', 'Inicio de sesión exitoso', new Date().toISOString()]] },
            });
          }

          return res.json({ success: true, user, token });
        }
      }
      
      res.status(401).json({ success: false, error: 'Credenciales incorrectas' });
    } catch (error) {
      console.error('Error in login:', error);
      res.status(500).json({ error: 'Error en el servidor durante el inicio de sesión' });
    }
  });

  app.post('/api/logout', (req, res) => {
    res.clearCookie('token', { 
      httpOnly: true, 
      secure: true, 
      sameSite: 'none' 
    });
    res.json({ success: true });
  });

  app.get('/api/me', authenticateToken, (req: any, res) => {
    res.json({ user: req.user });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
