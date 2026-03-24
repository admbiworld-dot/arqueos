-- Habilitar la extensión pgvector para futuras búsquedas de IA
CREATE EXTENSION IF NOT EXISTS vector;

-- Tabla de Usuarios (Basada en la hoja USUARIO)
CREATE TABLE IF NOT EXISTS usuarios (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    nombre TEXT NOT NULL,
    rol TEXT NOT NULL,
    sucursal_id TEXT DEFAULT '*',
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de Sucursales (Basada en la hoja SUCURSAL)
CREATE TABLE IF NOT EXISTS sucursales (
    id_sucursal TEXT PRIMARY KEY,
    sucursal TEXT NOT NULL,
    longitud TEXT,
    latitud TEXT,
    categoria TEXT,
    empresa TEXT,
    gerente_asignado TEXT
);

-- Tabla de Arqueos (Basada en la hoja ARQUEOS)
CREATE TABLE IF NOT EXISTS arqueos (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES usuarios(id),
    sucursal_id TEXT REFERENCES sucursales(id_sucursal),
    fecha DATE NOT NULL,
    turno TEXT NOT NULL,
    tasa_bcv NUMERIC(15, 2),
    venta_total NUMERIC(15, 2),
    transacciones INTEGER,
    fondo_bs NUMERIC(15, 2),
    fondo_usd NUMERIC(15, 2),
    efectivo_bs NUMERIC(15, 2),
    efectivo_usd NUMERIC(15, 2),
    pagomovil_bs NUMERIC(15, 2),
    pagomovil_usd NUMERIC(15, 2),
    zelle NUMERIC(15, 2),
    pos_venezuela NUMERIC(15, 2),
    pos_banplus NUMERIC(15, 2),
    pos_mercantil NUMERIC(15, 2),
    pos_detalles TEXT,
    apps_pedidosya NUMERIC(15, 2),
    apps_yummy NUMERIC(15, 2),
    apps_zupper NUMERIC(15, 2),
    gastos NUMERIC(15, 2),
    encargado TEXT,
    cajera TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de Gastos (Basada en la hoja GASTOS)
CREATE TABLE IF NOT EXISTS gastos (
    id TEXT PRIMARY KEY,
    arqueo_id TEXT, -- Puede ser nulo si el gasto es independiente
    user_id TEXT REFERENCES usuarios(id),
    fecha DATE NOT NULL,
    tienda_id TEXT REFERENCES sucursales(id_sucursal),
    monto NUMERIC(15, 2) NOT NULL,
    descripcion TEXT,
    tipo TEXT,
    autorizado_por TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de Pagos Móvil (Basada en la hoja PAGOS_MOVIL)
CREATE TABLE IF NOT EXISTS pagos_movil (
    id TEXT PRIMARY KEY,
    arqueo_id TEXT,
    user_id TEXT REFERENCES usuarios(id),
    fecha DATE NOT NULL,
    tienda_id TEXT REFERENCES sucursales(id_sucursal),
    monto_bs NUMERIC(15, 2) NOT NULL,
    referencia TEXT UNIQUE NOT NULL,
    banco TEXT,
    titular TEXT,
    verificado BOOLEAN DEFAULT FALSE,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de Auditoría (Basada en la hoja AUDITORIA)
CREATE TABLE IF NOT EXISTS auditoria (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES usuarios(id),
    accion TEXT NOT NULL,
    detalles TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de Registros de Visitas (Nueva, para fotos y geolocalización)
CREATE TABLE IF NOT EXISTS registros_visitas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendedor_id TEXT REFERENCES usuarios(id),
    cliente_id TEXT, -- ID del cliente visitado
    sucursal_id TEXT REFERENCES sucursales(id_sucursal),
    fecha TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    latitud NUMERIC(10, 8),
    longitud NUMERIC(11, 8),
    foto_url TEXT, -- Enlace a Google Drive / OneDrive
    comentarios TEXT,
    embedding vector(1536) -- Para futuras búsquedas semánticas con IA
);

-- Índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_arqueos_fecha ON arqueos(fecha);
CREATE INDEX IF NOT EXISTS idx_gastos_tienda ON gastos(tienda_id);
CREATE INDEX IF NOT EXISTS idx_pagos_referencia ON pagos_movil(referencia);
