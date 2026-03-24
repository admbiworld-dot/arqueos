import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseClient: SupabaseClient | null = null;

/**
 * Get the Supabase client, initializing it if necessary with the latest config from localStorage
 */
export const getSupabase = () => {
  if (!supabaseClient) {
    const supabaseUrl = localStorage.getItem('VITE_SUPABASE_URL') || import.meta.env.VITE_SUPABASE_URL || '';
    const supabaseKey = localStorage.getItem('VITE_SUPABASE_ANON_KEY') || import.meta.env.VITE_SUPABASE_ANON_KEY || '';
    
    if (supabaseUrl && supabaseKey) {
      supabaseClient = createClient(supabaseUrl, supabaseKey);
    }
  }
  return supabaseClient;
};

// Contingency Storage Key
const OFFLINE_STORAGE_KEY = 'arqueo_offline_data';

export interface OfflineRecord {
  id: string;
  table: string;
  data: any;
  timestamp: number;
  type: 'insert' | 'update';
}

/**
 * Data Manager Module
 * Handles Supabase, Google Drive, and Offline Contingency
 */
export const DataManager = {
  
  /**
   * Upload photo to Google Drive via server-side proxy
   * @param base64Data Image data in base64 format
   * @param fileName Optional filename
   * @returns Public URL of the uploaded photo
   */
  async upload_photo_to_cloud(base64Data: string, fileName?: string): Promise<string> {
    const token = localStorage.getItem('arqueo_token');
    const response = await fetch('/api/upload-photo', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ base64Data, fileName }),
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error('Error al subir la foto a la nube');
    }

    const result = await response.json();
    return result.url;
  },

  /**
   * Save a visit record with a photo link
   */
  async saveVisitRecord(visitData: {
    vendedor_id: string;
    cliente_id: string;
    sucursal_id: string;
    latitud: number;
    longitud: number;
    foto_base64: string;
    comentarios: string;
  }) {
    try {
      // 1. Upload photo first
      const photoUrl = await this.upload_photo_to_cloud(visitData.foto_base64);

      // 2. Save to Supabase
      const supabase = getSupabase();
      if (!supabase) throw new Error('Supabase no está configurado');

      const { data, error } = await supabase
        .from('registros_visitas')
        .insert([{
          vendedor_id: visitData.vendedor_id,
          cliente_id: visitData.cliente_id,
          sucursal_id: visitData.sucursal_id,
          latitud: visitData.latitud,
          longitud: visitData.longitud,
          foto_url: photoUrl,
          comentarios: visitData.comentarios
        }]);

      if (error) throw error;
      return data;

    } catch (error) {
      console.error('Error saving visit, using contingency logic:', error);
      // 3. Contingency: Save locally if Supabase fails
      this.saveToOfflineStorage('registros_visitas', visitData);
      throw new Error('Sin conexión. Los datos se guardaron localmente y se sincronizarán después.');
    }
  },

  /**
   * Sync Google Sheets data to Supabase (Massive sync)
   */
  async syncSheetsToSupabase(sheetName: string, supabaseTable: string) {
    const token = localStorage.getItem('arqueo_token');
    const response = await fetch('/api/sync-to-supabase', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ sheetName }),
      credentials: 'include'
    });

    if (!response.ok) throw new Error('Error al obtener datos de Google Sheets');
    
    const { data: sheetsData } = await response.json();
    
    // Push to Supabase in batches
    const supabase = getSupabase();
    if (!supabase) throw new Error('Supabase no está configurado');

    const { error } = await supabase
      .from(supabaseTable)
      .upsert(sheetsData, { onConflict: 'id' });

    if (error) throw error;
    return { success: true, count: sheetsData.length };
  },

  /**
   * Contingency Logic: Save to LocalStorage
   */
  saveToOfflineStorage(table: string, data: any) {
    const offlineData: OfflineRecord[] = JSON.parse(localStorage.getItem(OFFLINE_STORAGE_KEY) || '[]');
    const newRecord: OfflineRecord = {
      id: crypto.randomUUID(),
      table,
      data,
      timestamp: Date.now(),
      type: 'insert'
    };
    offlineData.push(newRecord);
    localStorage.setItem(OFFLINE_STORAGE_KEY, JSON.stringify(offlineData));
    
    // Also generate a downloadable JSON as requested
    const blob = new Blob([JSON.stringify(newRecord, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `contingencia_${table}_${newRecord.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },

  /**
   * Retry syncing offline data
   */
  async syncOfflineData() {
    const offlineData: OfflineRecord[] = JSON.parse(localStorage.getItem(OFFLINE_STORAGE_KEY) || '[]');
    if (offlineData.length === 0) return { success: true, synced: 0 };

    const remaining: OfflineRecord[] = [];
    let syncedCount = 0;

    const supabase = getSupabase();
    if (!supabase) throw new Error('Supabase no está configurado');

    for (const record of offlineData) {
      try {
        const { error } = await supabase
          .from(record.table)
          .insert([record.data]);
        
        if (error) throw error;
        syncedCount++;
      } catch (e) {
        console.error(`Failed to sync record ${record.id}:`, e);
        remaining.push(record);
      }
    }

    localStorage.setItem(OFFLINE_STORAGE_KEY, JSON.stringify(remaining));
    return { success: true, synced: syncedCount, remaining: remaining.length };
  }
};
