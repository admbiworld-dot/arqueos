import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { google } from 'googleapis';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  app.use(cors());

  // Google Sheets Auth
  // Note: For real use, the user needs to provide GOOGLE_SHEETS_ID and GOOGLE_SERVICE_ACCOUNT_KEY
  const auth = new google.auth.GoogleAuth({
    credentials: process.env.GOOGLE_SERVICE_ACCOUNT_KEY ? JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY) : undefined,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });
  let SPREADSHEET_ID = process.env.GOOGLE_SHEETS_ID || '11Iml7CA3u8W1rYB-2TXGwlDx49SbOLx1x4OHkOoQDKk';
  let WEB_APP_URL = process.env.WEB_APP_URL || 'https://script.google.com/macros/s/AKfycbwbzMKGpeYmiRgciVU-5fOj1VpPpY55pthPKY4SV0z4BbrPYYmabR5ZL8nZb5Ce-h1_/exec';

  const REQUIRED_SHEETS = {
    'USUARIO': ['ID_USUARIO', 'USUARIO', 'CORREO', 'CLAVE', 'TIENDAS_ASIGNADA', 'ROL'],
    'SUCURSAL': ['ID_SUCURSAL', 'SUCURSAL', 'LONGITUD', 'LATITUD', 'CATEGORIA', 'EMPRESA'],
    'ARQUEOS': ['FECHA', 'TIENDA_ID', 'TURNO', 'TASA_BCV', 'VENTA_TOTAL', 'TRANSACCIONES', 'FONDO_BS', 'FONDO_USD', 'EFECTIVO_BS', 'EFECTIVO_USD', 'PAGOMOVIL_BS', 'PAGOMOVIL_USD', 'ZELLE', 'POS_VENEZUELA', 'POS_BANPLUS', 'POS_MERCANTIL', 'POS_DETALLES', 'APPS_PEDIDOSYA', 'APPS_YUMMY', 'APPS_ZUPPER', 'GASTOS', 'ENCARGADO', 'CAJERA', 'USUARIO_EMAIL', 'TIMESTAMP'],
    'GASTOS': ['FECHA', 'TIENDA_ID', 'MONTO', 'DESCRIPCION', 'TIPO', 'AUTORIZADO_POR', 'USUARIO', 'TIMESTAMP'],
    'PAGOS_MOVIL': ['FECHA', 'TIENDA_ID', 'MONTO_BS', 'REFERENCIA', 'BANCO', 'TITULAR', 'VERIFICADO', 'USUARIO', 'TIMESTAMP']
  };

  // API Routes

  // Config endpoint
  app.post('/api/config', async (req, res) => {
    const { spreadsheetId, serviceAccount, webAppUrl } = req.body;
    try {
      if (spreadsheetId) SPREADSHEET_ID = spreadsheetId;
      
      // Heuristic: if serviceAccount looks like a URL, it's likely the webAppUrl
      if (serviceAccount && serviceAccount.startsWith('http')) {
        WEB_APP_URL = serviceAccount;
      } else if (webAppUrl) {
        WEB_APP_URL = webAppUrl;
      }
      
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
      
      res.json({ success: true, spreadsheetId: SPREADSHEET_ID, webAppUrl: WEB_APP_URL });
    } catch (error) {
      console.error('Error updating config:', error);
      res.status(500).json({ error: 'Failed to update configuration' });
    }
  });

  // Helper to call GAS Web App
  async function callGAS(action: string, params: any = {}) {
    if (!WEB_APP_URL) throw new Error('Web App URL not configured');
    
    try {
      // For GET requests (read)
      if (action === 'read') {
        const url = new URL(WEB_APP_URL);
        url.searchParams.append('action', 'read');
        url.searchParams.append('sheet', params.sheet);
        if (SPREADSHEET_ID) url.searchParams.append('id', SPREADSHEET_ID);
        
        console.log(`Calling GAS (read): ${url.toString()}`);
        const response = await fetch(url.toString(), { 
          method: 'GET',
          redirect: 'follow' 
        });
        
        const text = await response.text();
        if (!response.ok) throw new Error(`GAS Error ${response.status}: ${text.substring(0, 100)}`);
        
        try {
          return JSON.parse(text);
        } catch (e) {
          console.error('GAS returned non-JSON response (GET):', text.substring(0, 200));
          throw new Error('La URL de la Web App devolvió una página de error de Google. Posibles causas: 1. El script no está publicado como "Cualquier persona". 2. El script tiene un error interno (revise las ejecuciones en script.google.com). 3. El script no tiene permisos para acceder a la hoja.');
        }
      }
      
      // For POST requests (append, verify, update)
      console.log(`Calling GAS (${action}): ${WEB_APP_URL}`);
      const response = await fetch(WEB_APP_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, spreadsheetId: SPREADSHEET_ID, ...params }),
        redirect: 'follow'
      });
      
      const text = await response.text();
      if (!response.ok) throw new Error(`GAS Error ${response.status}: ${text.substring(0, 100)}`);
      
      try {
        return JSON.parse(text);
      } catch (e) {
        console.error('GAS returned non-JSON response (POST):', text.substring(0, 200));
        throw new Error('La URL de la Web App devolvió una página HTML en lugar de una respuesta de éxito. Verifique la configuración de publicación del script.');
      }
    } catch (error) {
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

  // Gastos endpoints
  app.get('/api/gastos', async (req, res) => {
    try {
      let rows: any[][] = [];
      if (WEB_APP_URL) {
        rows = await callGAS('read', { sheet: 'GASTOS' });
      } else if (SPREADSHEET_ID) {
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: 'GASTOS!A:H',
        });
        rows = response.data.values || [];
      } else {
        return res.json([]);
      }

      if (rows.length < 2) return res.json([]);
      const headers = rows[0];
      const data = rows.slice(1).map(row => {
        const obj: any = {};
        headers.forEach((h, i) => {
          if (h === 'AUTORIZADO_POR') obj.autorizadoPor = row[i];
          else if (h === 'FECHA') obj.date = row[i];
          else if (h === 'TIENDA_ID') obj.tiendaId = row[i];
          else if (h === 'MONTO') obj.monto = row[i];
          else if (h === 'DESCRIPCION') obj.descripcion = row[i];
          else if (h === 'TIPO') obj.tipo = row[i];
          else if (h === 'USUARIO') obj.usuario = row[i];
          else if (h === 'TIMESTAMP') obj.timestamp = row[i];
          else obj[h] = row[i];
        });
        return obj;
      });
      res.json(data);
    } catch (error: any) {
      console.error('Error reading GASTOS:', error);
      res.status(500).json({ error: error.message || 'Error reading GASTOS' });
    }
  });

  app.post('/api/gastos', async (req, res) => {
    try {
      const { date, tiendaId, monto, descripcion, tipo, autorizadoPor, usuario } = req.body;
      const values = [date, tiendaId, monto, descripcion, tipo, autorizadoPor, usuario, new Date().toISOString()];
      
      if (WEB_APP_URL) {
        await callGAS('append', { sheet: 'GASTOS', values });
      } else if (SPREADSHEET_ID) {
        await sheets.spreadsheets.values.append({
          spreadsheetId: SPREADSHEET_ID,
          range: 'GASTOS!A:H',
          valueInputOption: 'RAW',
          requestBody: { values: [values] },
        });
      }
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error writing GASTOS:', error);
      res.status(500).json({ error: error.message || 'Error writing GASTOS' });
    }
  });

  // Pagos Movil endpoints
  app.get('/api/pagos-movil', async (req, res) => {
    try {
      let rows: any[][] = [];
      if (WEB_APP_URL) {
        rows = await callGAS('read', { sheet: 'PAGOS_MOVIL' });
      } else if (SPREADSHEET_ID) {
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: 'PAGOS_MOVIL!A:I',
        });
        rows = response.data.values || [];
      } else {
        return res.json([]);
      }

      if (rows.length < 2) return res.json([]);
      const headers = rows[0];
      const data = rows.slice(1).map(row => {
        const obj: any = {};
        headers.forEach((h, i) => {
          if (h === 'TITULAR') obj.titular = row[i];
          else if (h === 'FECHA') obj.date = row[i];
          else if (h === 'TIENDA_ID') obj.tiendaId = row[i];
          else if (h === 'MONTO_BS') obj.montoBs = row[i];
          else if (h === 'REFERENCIA') obj.referencia = row[i];
          else if (h === 'BANCO') obj.banco = row[i];
          else if (h === 'VERIFICADO') obj.verificado = row[i];
          else if (h === 'USUARIO') obj.usuario = row[i];
          else if (h === 'TIMESTAMP') obj.timestamp = row[i];
          else obj[h] = row[i];
        });
        return obj;
      });
      res.json(data);
    } catch (error: any) {
      console.error('Error reading PAGOS_MOVIL:', error);
      res.status(500).json({ error: error.message || 'Error reading PAGOS_MOVIL' });
    }
  });

  app.post('/api/pagos-movil', async (req, res) => {
    try {
      const { date, tiendaId, montoBs, referencia, banco, titular, usuario } = req.body;

      // Duplicate check
      let refs: any[] = [];
      if (WEB_APP_URL) {
        const rows = await callGAS('read', { sheet: 'PAGOS_MOVIL' });
        refs = rows.slice(1).map((r: any) => r[3]); // Referencia is column D
      } else if (SPREADSHEET_ID) {
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: 'PAGOS_MOVIL!D:D',
        });
        refs = response.data.values?.flat() || [];
      }

      if (refs.includes(referencia)) {
        return res.status(400).json({ error: 'El número de referencia ya existe' });
      }

      const values = [date, tiendaId, montoBs, referencia, banco, titular, 'FALSE', usuario, new Date().toISOString()];
      
      if (WEB_APP_URL) {
        await callGAS('append', { sheet: 'PAGOS_MOVIL', values });
      } else if (SPREADSHEET_ID) {
        await sheets.spreadsheets.values.append({
          spreadsheetId: SPREADSHEET_ID,
          range: 'PAGOS_MOVIL!A:I',
          valueInputOption: 'RAW',
          requestBody: { values: [values] },
        });
      }
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error writing PAGOS_MOVIL:', error);
      res.status(500).json({ error: error.message || 'Error writing PAGOS_MOVIL' });
    }
  });

  app.post('/api/verificar-pago', async (req, res) => {
    try {
      const { referencia, verificado } = req.body;
      
      let rows: any[][] = [];
      if (WEB_APP_URL) {
        rows = await callGAS('read', { sheet: 'PAGOS_MOVIL' });
      } else if (SPREADSHEET_ID) {
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: 'PAGOS_MOVIL!A:I',
        });
        rows = response.data.values || [];
      } else {
        return res.json({ success: true });
      }
      
      const rowIndex = rows.findIndex(row => row[3] === referencia);
      
      if (rowIndex !== -1) {
        const newValue = verificado ? 'TRUE' : 'FALSE';
        if (WEB_APP_URL) {
          await callGAS('update', { 
            sheet: 'PAGOS_MOVIL', 
            range: `G${rowIndex + 1}`, 
            values: [[newValue]] 
          });
        } else {
          await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `PAGOS_MOVIL!G${rowIndex + 1}`,
            valueInputOption: 'RAW',
            requestBody: { values: [[newValue]] }
          });
        }
        res.json({ success: true });
      } else {
        res.status(404).json({ error: 'Pago no encontrado' });
      }
    } catch (error) {
      res.status(500).json({ error: 'Error verifying payment' });
    }
  });

  // Login endpoint
  app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    
    // Superadmin check
    if (email === 'josemdesousa03@gmail.com' && password === 'd7246089') {
      return res.json({
        success: true,
        user: {
          email: 'josemdesousa03@gmail.com',
          role: 'Administrador',
          displayName: 'Super Admin',
          assignedStores: ['*'] // All access
        }
      });
    }

    try {
      let rows: any[][] = [];
      if (WEB_APP_URL) {
        rows = await callGAS('read', { sheet: 'USUARIO' });
      } else if (SPREADSHEET_ID) {
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: 'USUARIO!A:F',
        });
        rows = response.data.values || [];
      } else {
        return res.status(500).json({ error: 'Spreadsheet ID or Web App URL not configured' });
      }

      if (rows.length < 2) {
        return res.status(401).json({ success: false, error: 'No hay usuarios registrados en la hoja' });
      }

      const headers = rows[0].map(h => h.trim().toUpperCase());
      const users = rows.slice(1).map(row => {
        const obj: any = {};
        headers.forEach((header, index) => {
          obj[header] = row[index];
        });
        return obj;
      });

      // Find user by email and password
      // USUARIO Structure: ID_USUARIO, USUARIO, CORREO, CLAVE, TIENDAS_ASIGNADA, ROL
      const foundUser = users.find(u => 
        (u.CORREO || u.EMAIL) === email && 
        (u.CLAVE || u.PASSWORD || u.CONTRASENA) === password
      );

      if (foundUser) {
        res.json({
          success: true,
          user: {
            email: foundUser.CORREO || foundUser.EMAIL,
            role: foundUser.ROL || foundUser.ROLE,
            displayName: foundUser.USUARIO || foundUser.NOMBRE || foundUser.NAME,
            assignedStores: (foundUser.TIENDAS_ASIGNADA || foundUser.TIENDAS || foundUser.STORES) ? (foundUser.TIENDAS_ASIGNADA || foundUser.TIENDAS || foundUser.STORES).split(',').map((s: string) => s.trim()) : []
          }
        });
      } else {
        res.status(401).json({ success: false, error: 'Credenciales incorrectas' });
      }
    } catch (error) {
      console.error('Error reading USUARIO sheet:', error);
      res.status(500).json({ error: 'Failed to read users from Google Sheets' });
    }
  });

  // Get stores endpoint
  app.get('/api/stores', async (req, res) => {
    try {
      let rows: any[][] = [];
      if (WEB_APP_URL) {
        rows = await callGAS('read', { sheet: 'SUCURSAL' });
      } else if (SPREADSHEET_ID) {
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: 'SUCURSAL!A:F',
        });
        rows = response.data.values || [];
      } else {
        // Fallback for demo
        return res.json(Array.from({ length: 16 }, (_, i) => ({
          id: `${i + 1}`,
          name: `Tienda ${i + 1}`
        })));
      }

      const headers = rows[0];
      // SUCURSAL Structure: ID_SUCURSAL, SUCURSAL, LONGITUD, LATITUD, CATEGORIA, EMPRESA
      const stores = rows.slice(1).map(row => {
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
          company: obj.EMPRESA
        };
      });

      res.json(stores);
    } catch (error: any) {
      console.error('Error reading SUCURSAL sheet:', error);
      // Fallback for demo if GAS fails
      res.json(Array.from({ length: 16 }, (_, i) => ({
        id: `${i + 1}`,
        name: `Tienda ${i + 1} (Modo Fallback)`
      })));
    }
  });

  app.post('/api/arqueos', async (req, res) => {
    try {
      const data = req.body;
      const values = [
        data.date,
        data.tiendaId,
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
        data.userEmail,
        new Date().toISOString()
      ];

      if (WEB_APP_URL) {
        await callGAS('append', { sheet: 'ARQUEOS', values });
      } else if (SPREADSHEET_ID) {
        await sheets.spreadsheets.values.append({
          spreadsheetId: SPREADSHEET_ID,
          range: 'ARQUEOS!A:Y',
          valueInputOption: 'RAW',
          requestBody: { values: [values] },
        });
      } else {
        // Fallback for demo if no ID provided
        console.log('Demo Mode: Arqueo received', req.body);
        return res.json({ success: true, message: 'Demo Mode: Data logged to console' });
      }

      res.json({ success: true });
    } catch (error) {
      console.error('Error writing to Google Sheets:', error);
      res.status(500).json({ error: 'Failed to write to Google Sheets' });
    }
  });

  app.get('/api/arqueos', async (req, res) => {
    try {
      let rows: any[][] = [];
      if (WEB_APP_URL) {
        rows = await callGAS('read', { sheet: 'ARQUEOS' });
      } else if (SPREADSHEET_ID) {
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: 'ARQUEOS!A:Y',
        });
        rows = response.data.values || [];
      } else {
        return res.json([]);
      }

      const headers = rows[0];
      const data = rows.slice(1).map(row => {
        const obj: any = {};
        headers.forEach((header, index) => {
          obj[header] = row[index];
        });
        return obj;
      });

      res.json(data);
    } catch (error: any) {
      console.error('Error reading from Google Sheets:', error);
      res.status(500).json({ error: error.message || 'Failed to read from Google Sheets' });
    }
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
