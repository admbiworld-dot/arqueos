export type UserRole = 'Superadmin' | 'Gerente de Tienda' | 'Cajero/Operador' | 'Supervisor' | 'Verificador de Pagos' | 'Verificador Zelle y Pago Movil' | 'Contabilidad';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  nombre: string;
  sucursalId: string;
  activo: boolean;
  createdAt: string;
}

export interface Zelle {
  id?: string;
  date: string;
  tiendaId: string;
  titular: string;
  receptor: string;
  monto: number;
  motivo: string;
  verificado: boolean;
  usuario: string;
  timestamp: string;
}

export interface Gasto {
  id?: string;
  date: string;
  tiendaId: string;
  monto: number;
  descripcion: string;
  tipo: 'Gasto' | 'Vale' | 'Falla' | 'Vale por faltante' | 'Obsequio';
  autorizadoPor: string;
  usuario: string;
  timestamp: string;
}

export interface PagoMovil {
  id?: string;
  date: string;
  tiendaId: string;
  montoBs: number;
  referencia: string;
  banco: string;
  titular: string;
  verificado: boolean;
  usuario: string;
  timestamp: string;
}

export interface ArqueoData {
  id?: string;
  date: string;
  tasaBcv: number;
  tiendaId: string;
  turno: 'PRIMER TURNO' | 'SEGUNDO TURNO';
  ventaTotalBs?: number;
  ventaTotal: number;
  transacciones: number;
  fondoBs: number;
  fondoUsd: number;
  efectivo: {
    bs: number;
    usd: number;
  };
  pagoMovil: {
    bs: number;
    usd: number;
  };
  zelle: number;
  puntosVenta: {
    venezuela: { lotes: { numero: string; bs: number; usd: number }[] };
    banplus: { lotes: { numero: string; bs: number; usd: number }[] };
    mercantil: { lotes: { numero: string; bs: number; usd: number }[] };
  };
  apps: {
    pedidosYa: number;
    yummy: number;
    zupper: number;
  };
  gastos: number;
  valesFaltante: number;
  vales: number;
  fallas: number;
  sistemaDuplicados: number;
  obsequios: number;
  encargado: string;
  cajera: string;
  timestamp: any;
  userId: string;
}

export interface Store {
  id: string;
  name: string;
  longitude?: string;
  latitude?: string;
  category?: string;
  company?: string;
}
