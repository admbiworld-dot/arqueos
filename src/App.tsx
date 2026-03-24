import React, { useState, useEffect, useMemo } from 'react';
import { LogIn, LogOut, Store as StoreIcon, ClipboardList, PlusCircle, History, ChevronRight, Calculator, DollarSign, CreditCard, ShoppingBag, User, Users, LayoutDashboard, BarChart3, TrendingUp, PieChart, Trash2, Plus, CheckCircle2, Clock, AlertCircle, ExternalLink, RefreshCw, Share2, Copy, Info, Upload, Search, Filter, Check, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArqueoData, User as UserType, UserRole, Store, Gasto, PagoMovil, Zelle } from './types';
import { format, subDays, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Cell, PieChart as RePieChart, Pie } from 'recharts';
import { Settings, Code, ShieldCheck, Database, Download } from 'lucide-react';
import * as XLSX from 'xlsx';

const SUPERADMIN_EMAIL = 'admbiworld@gmail.com';
const SUPERADMIN_PASS = 'admin123';

const ROLES: UserRole[] = ['Superadmin', 'Gerente de Tienda', 'Cajero/Operador', 'Supervisor', 'Verificador de Pagos', 'Contabilidad'];

export default function App() {
  const [user, setUser] = useState<UserType | null>(null);
  const [view, setView] = useState<'dashboard' | 'form' | 'history' | 'stats' | 'settings' | 'monitoring' | 'gastos' | 'pagos-movil' | 'zelle' | 'lotes' | 'users' | 'store-selection'>('dashboard');
  const [selectedStore, setSelectedStore] = useState<string | null>(null);
  const [arqueos, setArqueos] = useState<ArqueoData[]>([]);
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [pagosMovil, setPagosMovil] = useState<PagoMovil[]>([]);
  const [zelle, setZelle] = useState<Zelle[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [loginError, setLoginError] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const filteredArqueos = useMemo(() => {
    if (!user) return [];
    if (user.role === 'Superadmin') return arqueos;
    return arqueos.filter(a => a.USER_ID === user.id);
  }, [arqueos, user]);

  const filteredGastos = useMemo(() => {
    if (!user) return [];
    if (user.role === 'Superadmin') return gastos;
    return gastos.filter(g => g.userId === user.id);
  }, [gastos, user]);

  const filteredPagosMovil = useMemo(() => {
    if (!user) return [];
    if (user.role === 'Superadmin' || user.role === 'Verificador Zelle y Pago Movil' || user.role === 'Verificador de Pagos') return pagosMovil;
    return pagosMovil.filter(p => p.userId === user.id);
  }, [pagosMovil, user]);

  const filteredZelle = useMemo(() => {
    if (!user) return [];
    if (user.role === 'Superadmin' || user.role === 'Verificador Zelle y Pago Movil') return zelle;
    return zelle.filter(z => z.userId === user.id);
  }, [zelle, user]);

  const stats = useMemo(() => {
    const totalVentas = filteredArqueos.reduce((sum, a) => sum + parseFloat(a.ventaTotal?.toString() || a['Venta Total']?.toString() || '0'), 0);
    const totalTransacciones = filteredArqueos.reduce((sum, a) => sum + parseInt(a.transacciones?.toString() || a['Transacciones']?.toString() || '0'), 0);
    return { totalVentas, totalTransacciones };
  }, [filteredArqueos]);

  const handleLogout = async () => {
    console.log('handleLogout called');
    try {
      await fetch('/api/logout', { method: 'POST', credentials: 'include' });
    } catch (e) {
      console.error('Logout error:', e);
    }
    setUser(null);
    localStorage.removeItem('arqueo_user');
    localStorage.removeItem('arqueo_token');
  };

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Try to get user from /api/me
        const token = localStorage.getItem('arqueo_token');
        console.log('checkAuth: token from localStorage:', token);
        const response = await fetch('/api/me', { 
          credentials: 'include',
          headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });
        if (response.ok) {
          const data = await response.json();
          setUser(data.user);
        } else if (response.status === 401) {
          // Token expired or invalid, clear local user
          handleLogout();
          return;
        } else {
          // Fallback to localStorage if server check fails (e.g. other error)
          const savedUser = localStorage.getItem('arqueo_user');
          if (savedUser) {
            try {
              setUser(JSON.parse(savedUser));
            } catch (e) {
              console.error('Error parsing saved user:', e);
              localStorage.removeItem('arqueo_user');
            }
          }
        }
        
        // Fetch and sync config from server to localStorage for all users
        try {
          const token = localStorage.getItem('arqueo_token');
          const configResponse = await fetch('/api/config', {
            headers: token ? { 'Authorization': `Bearer ${token}` } : {}
          });
          if (configResponse.ok) {
            const data = await configResponse.json();
            if (data.spreadsheetId) localStorage.setItem('GOOGLE_SHEETS_ID', data.spreadsheetId);
            if (data.webAppUrl) localStorage.setItem('WEB_APP_URL', data.webAppUrl);
            if (data.supabaseUrl) localStorage.setItem('VITE_SUPABASE_URL', data.supabaseUrl);
            if (data.supabaseAnonKey) localStorage.setItem('VITE_SUPABASE_ANON_KEY', data.supabaseAnonKey);
            if (data.dbSource) localStorage.setItem('DB_SOURCE', data.dbSource);
            console.log('Config synced from server to local storage');
          }
        } catch (e) {
          console.error('Error syncing config from server:', e);
        }
      } catch (error) {
        console.error('Error in checkAuth:', error);
        // Network error, fallback to local user
        const savedUser = localStorage.getItem('arqueo_user');
        if (savedUser) {
          try {
            setUser(JSON.parse(savedUser));
          } catch (e) {
            console.error('Error parsing saved user:', e);
            localStorage.removeItem('arqueo_user');
          }
        }
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, []);

  const fetchStores = async () => {
    try {
      const token = localStorage.getItem('arqueo_token');
      const response = await fetch('/api/stores', { 
        credentials: 'include',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      if (!response.ok) {
        if (response.status === 401) {
          handleLogout();
        }
        const errorText = await response.text();
        throw new Error(`Error ${response.status}: ${errorText.includes('<html>') ? 'Forbidden/Unauthorized' : errorText}`);
      }
      const data = await response.json();
      setStores(data);
      return data;
    } catch (error) {
      console.error("Error fetching stores", error);
      throw error;
    }
  };

  useEffect(() => {
    if (user) {
      fetchStores();
      fetchArqueos();
      fetchGastos();
      fetchPagosMovil();
      fetchZelle();
    }
  }, [user]);

  useEffect(() => {
    if (user && user.sucursalId && user.sucursalId !== '*' && !selectedStore) {
      setSelectedStore(user.sucursalId);
    }
  }, [user, selectedStore]);

  const fetchArqueos = async () => {
    try {
      const token = localStorage.getItem('arqueo_token');
      const response = await fetch('/api/arqueos', { 
        credentials: 'include',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      if (!response.ok) {
        if (response.status === 401) {
          handleLogout();
        }
        let errorMessage = `Error ${response.status}`;
        try {
          const err = await response.json();
          errorMessage = err.error || errorMessage;
        } catch (e) {
          // Not JSON
        }
        throw new Error(errorMessage);
      }
      const data = await response.json();
      setArqueos(data);
      return data;
    } catch (error: any) {
      console.error("Error fetching history", error);
      throw error;
    }
  };

  const fetchGastos = async () => {
    try {
      const token = localStorage.getItem('arqueo_token');
      const response = await fetch('/api/gastos', { 
        credentials: 'include',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      if (!response.ok) {
        if (response.status === 401) {
          handleLogout();
        }
        let errorMessage = `Error ${response.status}`;
        try {
          const err = await response.json();
          errorMessage = err.error || errorMessage;
        } catch (e) {
          // Not JSON
        }
        throw new Error(errorMessage);
      }
      const data = await response.json();
      setGastos(data);
      return data;
    } catch (error: any) {
      console.error("Error fetching gastos", error);
      throw error;
    }
  };

  const fetchPagosMovil = async () => {
    try {
      const token = localStorage.getItem('arqueo_token');
      const response = await fetch('/api/pagos-movil', { 
        credentials: 'include',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      if (!response.ok) {
        if (response.status === 401) {
          handleLogout();
        }
        let errorMessage = `Error ${response.status}`;
        try {
          const err = await response.json();
          errorMessage = err.error || errorMessage;
        } catch (e) {
          // Not JSON
        }
        throw new Error(errorMessage);
      }
      const data = await response.json();
      setPagosMovil(data);
      return data;
    } catch (error: any) {
      console.error("Error fetching pagos movil", error);
      throw error;
    }
  };

  const fetchZelle = async () => {
    try {
      const token = localStorage.getItem('arqueo_token');
      const response = await fetch('/api/zelle', { 
        credentials: 'include',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      if (!response.ok) {
        if (response.status === 401) {
          handleLogout();
        }
        let errorMessage = `Error ${response.status}`;
        try {
          const err = await response.json();
          errorMessage = err.error || errorMessage;
        } catch (e) {
          // Not JSON
        }
        throw new Error(errorMessage);
      }
      const data = await response.json();
      setZelle(data);
      return data;
    } catch (error: any) {
      console.error("Error fetching zelle", error);
      throw error;
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    const email = (e.target as any).email.value;
    const password = (e.target as any).password.value;

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Error desconocido' }));
        setLoginError(errorData.error || `Error ${response.status}`);
        return;
      }

      const data = await response.json();

      if (data.success) {
        setUser(data.user);
        localStorage.setItem('arqueo_user', JSON.stringify(data.user));
        if (data.token) localStorage.setItem('arqueo_token', data.token);
      } else {
        setLoginError(data.error || 'Credenciales incorrectas');
      }
    } catch (error) {
      console.error('Login error:', error);
      setLoginError('Error al conectar con el servidor');
    }
  };

  if (loading) return <div className="h-screen flex items-center justify-center bg-stone-100 font-sans">Cargando...</div>;

  if (!user) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-stone-100 p-4 font-sans">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full text-center border border-stone-200"
        >
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Calculator className="w-10 h-10 text-emerald-600" />
          </div>
          <h1 className="text-3xl font-bold text-stone-900 mb-2">ArqueoPro</h1>
          <p className="text-stone-500 mb-8">Gestión de arqueos del sistema.</p>
          <form onSubmit={handleLogin} className="space-y-4 text-left">
            <div className="space-y-1">
              <label className="text-xs font-bold text-stone-400 uppercase">Correo</label>
              <input 
                name="email"
                type="email" 
                required
                placeholder="ejemplo@correo.com"
                className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-stone-400 uppercase">Contraseña</label>
              <input 
                name="password"
                type="password" 
                required
                placeholder="••••••••"
                className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
            {loginError && <p className="text-red-500 text-xs font-bold">{loginError}</p>}
            <button 
              type="submit"
              className="w-full flex items-center justify-center gap-3 bg-stone-900 text-white py-4 rounded-2xl font-semibold hover:bg-stone-800 transition-all active:scale-95 shadow-lg mt-4"
            >
              <LogIn className="w-5 h-5" />
              Ingresar al Sistema
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  const canSeeStats = ['Superadmin', 'Gerente de Tienda'].includes(user.role);

  return (
    <div className="flex h-screen bg-[#f8f9fd] font-sans overflow-hidden">
      {/* Mobile Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-[#1a1c2c] text-stone-400 flex flex-col shrink-0 transition-transform duration-300 lg:relative lg:translate-x-0
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3 text-white">
              <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center">
                <Calculator className="w-6 h-6" />
              </div>
              <span className="text-xl font-bold tracking-tight">ArqueoPro</span>
            </div>
            <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden text-stone-400">
              <ChevronRight className="w-6 h-6 rotate-180" />
            </button>
          </div>
          
          <nav className="space-y-1">
            <SidebarItem 
              icon={<LayoutDashboard className="w-5 h-5" />} 
              label="Dashboard" 
              active={view === 'dashboard'} 
              onClick={() => { setView('dashboard'); setIsSidebarOpen(false); }} 
            />
            {user.role === 'Superadmin' && (
              <SidebarItem 
                icon={<Clock className="w-5 h-5" />} 
                label="Monitoreo" 
                active={view === 'monitoring'} 
                onClick={() => { setView('monitoring'); setIsSidebarOpen(false); }} 
              />
            )}
            {['Superadmin', 'Gerente de Tienda', 'Cajero/Operador', 'Supervisor'].includes(user.role) && (
              <SidebarItem 
                icon={<PlusCircle className="w-5 h-5" />} 
                label="Nuevo Arqueo" 
                active={view === 'form' || view === 'store-selection'} 
                onClick={() => {
                  if (user.role === 'Superadmin' || user.role === 'Supervisor') {
                    setView('store-selection');
                    setIsSidebarOpen(false);
                  } else {
                    const availableStores = stores.filter(s => s.id === user.sucursalId);
                    if (availableStores.length > 0) {
                      setSelectedStore(availableStores[0].id);
                      setView('form');
                      setIsSidebarOpen(false);
                    }
                  }
                }} 
              />
            )}
            {['Superadmin', 'Gerente de Tienda'].includes(user.role) && (
              <SidebarItem 
                icon={<DollarSign className="w-5 h-5" />} 
                label="Gastos/Vales" 
                active={view === 'gastos'} 
                onClick={() => { setView('gastos'); setIsSidebarOpen(false); }} 
              />
            )}
            {['Superadmin', 'Gerente de Tienda', 'Cajero/Operador', 'Verificador de Pagos', 'Verificador Zelle y Pago Movil'].includes(user.role) && (
              <SidebarItem 
                icon={<CreditCard className="w-5 h-5" />} 
                label="Pagos Móvil" 
                active={view === 'pagos-movil'} 
                onClick={() => { setView('pagos-movil'); setIsSidebarOpen(false); }} 
              />
            )}
            {['Superadmin', 'Gerente de Tienda', 'Cajero/Operador', 'Verificador Zelle y Pago Movil'].includes(user.role) && (
              <SidebarItem 
                icon={<DollarSign className="w-5 h-5" />} 
                label="Zelle" 
                active={view === 'zelle'} 
                onClick={() => { setView('zelle'); setIsSidebarOpen(false); }} 
              />
            )}
            {['Superadmin', 'Contabilidad'].includes(user.role) && (
              <SidebarItem 
                icon={<Database className="w-5 h-5" />} 
                label="Lotes POS" 
                active={view === 'lotes'} 
                onClick={() => { setView('lotes'); setIsSidebarOpen(false); }} 
              />
            )}
            {user.role === 'Superadmin' && (
              <SidebarItem 
                icon={<History className="w-5 h-5" />} 
                label="Histórico" 
                active={view === 'history'} 
                onClick={() => { setView('history'); setIsSidebarOpen(false); }} 
              />
            )}
            {['Superadmin', 'Gerente de Tienda'].includes(user.role) && (
              <SidebarItem 
                icon={<BarChart3 className="w-5 h-5" />} 
                label="Reportes" 
                active={view === 'stats'} 
                onClick={() => { setView('stats'); setIsSidebarOpen(false); }} 
              />
            )}
            {user.role === 'Superadmin' && (
              <SidebarItem 
                icon={<User className="w-5 h-5" />} 
                label="Usuarios" 
                active={view === 'users'} 
                onClick={() => { setView('users'); setIsSidebarOpen(false); }} 
              />
            )}
            {user.role === 'Superadmin' && (
              <SidebarItem 
                icon={<Settings className="w-5 h-5" />} 
                label="Configuración" 
                active={view === 'settings'} 
                onClick={() => { setView('settings'); setIsSidebarOpen(false); }} 
              />
            )}
          </nav>
        </div>
        
        <div className="mt-auto p-6 border-t border-white/5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-indigo-500/20 rounded-full flex items-center justify-center text-indigo-400 font-bold">
              {user.nombre?.charAt(0)}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-bold text-white truncate">{user.nombre}</p>
              <p className="text-xs truncate opacity-50">{user.role}</p>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-2 text-sm hover:text-white transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-[#f8f9fd]">
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-stone-200 px-6 py-4 flex items-center justify-between lg:hidden">
          <div className="flex items-center gap-3">
            <button onClick={() => setIsSidebarOpen(true)} className="p-2 bg-stone-100 rounded-lg">
              <LayoutDashboard className="w-5 h-5 text-stone-600" />
            </button>
            <span className="font-bold text-stone-900">ArqueoPro</span>
          </div>
          <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 text-xs font-bold">
            {user.nombre?.charAt(0)}
          </div>
        </header>

        <div className="p-4 md:p-10">
          <AnimatePresence mode="wait">
            {view === 'dashboard' && (
              <motion.div 
                key="dashboard"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                  <div>
                    <h2 className="text-3xl font-black text-stone-900">Hola, {user.nombre}</h2>
                    <p className="text-stone-500 font-medium">Bienvenido de nuevo al panel de ArqueoPro.</p>
                  </div>
                  {['Superadmin', 'Gerente de Tienda', 'Cajero/Operador'].includes(user.role) && (
                    <button 
                      onClick={() => {
                        const availableStores = user.role === 'Superadmin' ? stores : stores.filter(s => s.id === user.sucursalId);
                        if (availableStores.length > 0) {
                          setSelectedStore(availableStores[0].id);
                          setView('form');
                        }
                      }}
                      className="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-bold flex items-center gap-2 shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all active:scale-95"
                    >
                      <PlusCircle className="w-5 h-5" />
                      Nuevo Arqueo
                    </button>
                  )}
                </div>

                {/* Header Stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <StatCard 
                  icon={<DollarSign className="w-6 h-6 text-indigo-600" />} 
                  label="VENTAS TOTALES ($)" 
                  value={`$${stats.totalVentas.toFixed(2)}`}
                  bg="bg-white"
                />
                <StatCard 
                  icon={<Calculator className="w-6 h-6 text-emerald-600" />} 
                  label="ARQUEOS REALIZADOS" 
                  value={filteredArqueos.length.toString()}
                  bg="bg-white"
                />
                <StatCard 
                  icon={<ShoppingBag className="w-6 h-6 text-orange-600" />} 
                  label="TRANSACCIONES" 
                  value={stats.totalTransacciones.toString()}
                  bg="bg-white"
                />
                <StatCard 
                  icon={<User className="w-6 h-6 text-purple-600" />} 
                  label="USUARIOS ACTIVOS" 
                  value="1"
                  bg="bg-white"
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Usuarios en Línea */}
                <div className="lg:col-span-1 bg-white p-8 rounded-[2.5rem] border border-stone-100 shadow-sm min-h-[500px]">
                  <div className="flex items-center gap-2 mb-8">
                    <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse" />
                    <h3 className="font-bold text-stone-800">Usuarios en Línea (1)</h3>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="flex items-center gap-4 p-4 bg-stone-50 rounded-2xl border border-stone-100">
                      <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600 font-bold">
                        {user.nombre?.charAt(0)}
                      </div>
                      <div className="flex-1">
                        <p className="font-bold text-stone-900 uppercase text-sm">{user.nombre}</p>
                        <p className="text-xs text-stone-400 font-bold uppercase tracking-wider">{user.role}</p>
                      </div>
                      <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                    </div>
                  </div>
                </div>

                {/* Top Desempeño & Chart */}
                <div className="lg:col-span-2 space-y-8">
                  <div className="bg-white p-8 rounded-[2.5rem] border border-stone-100 shadow-sm">
                    <div className="flex items-center gap-2 mb-8">
                      <TrendingUp className="w-5 h-5 text-indigo-600" />
                      <h3 className="font-bold text-stone-800">Top Desempeño</h3>
                    </div>
                    
                    <div className="space-y-6">
                      <PerformanceItem 
                        icon={<ShoppingBag className="w-5 h-5 text-orange-600" />}
                        label="ÚLTIMA TIENDA ARQUEADA"
                        value={filteredArqueos.length > 0 ? (filteredArqueos[0].tiendaId || filteredArqueos[0]['Tienda ID'] || 'N/A') : 'N/A'}
                        subValue={filteredArqueos.length > 0 ? (filteredArqueos[0].date || filteredArqueos[0]['Fecha'] || '') : ''}
                        color="bg-orange-50"
                      />
                      <PerformanceItem 
                        icon={<User className="w-5 h-5 text-indigo-600" />}
                        label="ÚLTIMO RESPONSABLE"
                        value={filteredArqueos.length > 0 ? (filteredArqueos[0].encargado || filteredArqueos[0]['Encargado'] || 'N/A') : 'N/A'}
                        subValue={filteredArqueos.length > 0 ? (filteredArqueos[0].userEmail || '') : ''}
                        color="bg-indigo-50"
                      />
                      <PerformanceItem 
                        icon={<TrendingUp className="w-5 h-5 text-emerald-600" />}
                        label="VENTA PROMEDIO"
                        value={`$${(stats.totalVentas / (filteredArqueos.length || 1)).toFixed(2)}`}
                        subValue="Por arqueo"
                        color="bg-emerald-50"
                      />
                    </div>
                  </div>

                  <div className="bg-indigo-600 p-8 rounded-[2.5rem] text-white min-h-[300px] flex flex-col">
                    <h3 className="font-bold mb-8">Ventas por Portafolio</h3>
                    <div className="flex-1 flex items-center justify-center opacity-50">
                      <RePieChart width={200} height={200}>
                        <Pie data={[{ name: 'Ventas', value: 100 }]} dataKey="value" fill="#fff" opacity={0.3} />
                      </RePieChart>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

            {view === 'monitoring' && (
              <MonitoringView 
                arqueos={arqueos} 
                stores={stores} 
                onBack={() => setView('dashboard')} 
              />
            )}
            {view === 'form' && selectedStore && (
            <ArqueoForm 
              storeId={selectedStore} 
              onBack={() => setView('dashboard')} 
              userEmail={user.email}
              gastos={gastos}
              pagosMovil={pagosMovil}
              zelle={zelle}
              onLogout={handleLogout}
            />
          )}

          {view === 'history' && (
            <HistoryView 
              arqueos={filteredArqueos} 
              onBack={() => setView('dashboard')} 
            />
          )}

          {view === 'gastos' && (
            <GastosView 
              gastos={filteredGastos} 
              stores={stores}
              user={user}
              onBack={() => setView('dashboard')} 
              onRefresh={fetchGastos}
              onLogout={handleLogout}
            />
          )}

          {view === 'pagos-movil' && (
            <PagosMovilView 
              pagos={filteredPagosMovil} 
              stores={stores}
              user={user}
              onBack={() => setView('dashboard')} 
              onRefresh={fetchPagosMovil}
              onLogout={handleLogout}
            />
          )}

          {view === 'zelle' && (
            <ZelleView 
              zelle={filteredZelle} 
              stores={stores}
              user={user}
              onBack={() => setView('dashboard')} 
              onRefresh={fetchZelle}
              onLogout={handleLogout}
            />
          )}

          {view === 'lotes' && (
            <LotesView 
              arqueos={filteredArqueos} 
              stores={stores}
              onBack={() => setView('dashboard')} 
            />
          )}

          {view === 'stats' && canSeeStats && (
            <StatsView 
              arqueos={filteredArqueos} 
              onBack={() => setView('dashboard')} 
              stores={stores}
            />
          )}

          {view === 'settings' && user.role === 'Superadmin' && (
            <SettingsView 
              onBack={() => setView('dashboard')} 
              onRefresh={async () => {
                await Promise.all([
                  fetchArqueos(),
                  fetchGastos(),
                  fetchPagosMovil(),
                  fetchStores()
                ]);
              }}
              onLogout={handleLogout}
            />
          )}

          {view === 'users' && user.role === 'Superadmin' && (
            <UsersView 
              onBack={() => setView('dashboard')} 
              stores={stores}
              onLogout={handleLogout}
            />
          )}

          {view === 'store-selection' && (user.role === 'Superadmin' || user.role === 'Supervisor') && (
            <StoreSelectionView 
              stores={stores}
              onSelect={(storeId) => {
                setSelectedStore(storeId);
                setView('form');
              }}
              onBack={() => setView('dashboard')}
            />
          )}
        </AnimatePresence>
      </div>
    </main>
  </div>
  );
}

function SidebarItem({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
        active 
          ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' 
          : 'hover:bg-white/5 text-stone-400'
      }`}
    >
      {icon}
      <span className="font-bold text-sm">{label}</span>
    </button>
  );
}

function StatCard({ icon, label, value, bg }: { icon: React.ReactNode, label: string, value: string, bg: string }) {
  return (
    <div className={`${bg} p-6 rounded-[2rem] border border-stone-100 shadow-sm flex items-center gap-4`}>
      <div className="w-14 h-14 rounded-2xl bg-stone-50 flex items-center justify-center">
        {icon}
      </div>
      <div>
        <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">{label}</p>
        <p className="text-2xl font-bold text-stone-900">{value}</p>
      </div>
    </div>
  );
}

function PerformanceItem({ icon, label, value, subValue, color }: { icon: React.ReactNode, label: string, value: string, subValue: string, color: string }) {
  return (
    <div className="flex items-center gap-4">
      <div className={`w-12 h-12 ${color} rounded-2xl flex items-center justify-center`}>
        {icon}
      </div>
      <div className="flex-1">
        <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">{label}</p>
        <p className="font-bold text-stone-900">{value}</p>
        <p className="text-xs text-stone-400">{subValue}</p>
      </div>
    </div>
  );
}

function ArqueoForm({ storeId, onBack, userEmail, gastos, pagosMovil, zelle, onLogout }: { storeId: string; onBack: () => void; userEmail: string; gastos: Gasto[]; pagosMovil: PagoMovil[]; zelle: Zelle[]; onLogout: () => void }) {
  const [formData, setFormData] = useState<Partial<ArqueoData>>({
    date: new Date().toISOString().split('T')[0],
    tasaBcv: 0,
    tiendaId: storeId,
    turno: 'PRIMER TURNO',
    ventaTotalBs: 0,
    ventaTotal: 0,
    transacciones: 0,
    fondoBs: 0,
    fondoUsd: 0,
    efectivo: { bs: 0, usd: 0 },
    pagoMovil: { bs: 0, usd: 0 },
    zelle: 0,
    puntosVenta: {
      venezuela: { lotes: [{ numero: '', bs: 0, usd: 0 }] },
      banplus: { lotes: [{ numero: '', bs: 0, usd: 0 }] },
      mercantil: { lotes: [{ numero: '', bs: 0, usd: 0 }] },
    },
    apps: { pedidosYa: 0, yummy: 0, zupper: 0 },
    gastos: 0,
    valesFaltante: 0,
    vales: 0,
    fallas: 0,
    sistemaDuplicados: 0,
    obsequios: 0,
    encargado: '',
    cajera: '',
  });

  // Auto-calculate expenses and mobile payments for this store and date
  useEffect(() => {
    const storeGastos = gastos.filter(g => g.tiendaId === storeId && g.date === formData.date);
    const totalGastos = storeGastos.filter(g => g.tipo === 'Gasto').reduce((sum, g) => sum + (parseFloat(g.monto.toString()) || 0), 0);
    const totalVales = storeGastos.filter(g => g.tipo === 'Vale').reduce((sum, g) => sum + (parseFloat(g.monto.toString()) || 0), 0);
    const totalFallas = storeGastos.filter(g => g.tipo === 'Falla').reduce((sum, g) => sum + (parseFloat(g.monto.toString()) || 0), 0);
    const totalValesFaltante = storeGastos.filter(g => g.tipo === 'Vale por faltante').reduce((sum, g) => sum + (parseFloat(g.monto.toString()) || 0), 0);
    const totalObsequios = storeGastos.filter(g => g.tipo === 'Obsequio').reduce((sum, g) => sum + (parseFloat(g.monto.toString()) || 0), 0);
    
    const storePagos = pagosMovil.filter(p => p.tiendaId === storeId && p.date === formData.date && p.verificado);
    const totalPagoMovilBs = storePagos.reduce((sum, p) => sum + (parseFloat(p.montoBs.toString()) || 0), 0);
    
    const storeZelle = zelle.filter(z => z.tiendaId === storeId && z.date === formData.date && z.verificado);
    const totalZelle = storeZelle.reduce((sum, z) => sum + (parseFloat(z.monto.toString()) || 0), 0);
    
    setFormData(prev => ({
      ...prev,
      gastos: totalGastos,
      vales: totalVales,
      fallas: totalFallas,
      valesFaltante: totalValesFaltante,
      obsequios: totalObsequios,
      zelle: totalZelle,
      pagoMovil: {
        bs: totalPagoMovilBs,
        usd: prev.tasaBcv && prev.tasaBcv > 0 ? parseFloat((totalPagoMovilBs / prev.tasaBcv).toFixed(2)) : 0
      }
    }));
  }, [formData.date, storeId, gastos, pagosMovil, zelle, formData.tasaBcv]);

  const [submitting, setSubmitting] = useState(false);

  // Recalculate all USD fields when Tasa BCV changes
  useEffect(() => {
    const tasa = formData.tasaBcv || 0;
    if (tasa <= 0) return;

    setFormData(prev => {
      const newData = { ...prev };
      
      // Venta Total
      if (newData.ventaTotalBs) newData.ventaTotal = parseFloat((newData.ventaTotalBs / tasa).toFixed(2)) || 0;
      
      // Pago Movil
      if (newData.pagoMovil?.bs) {
        newData.pagoMovil = { ...newData.pagoMovil, usd: parseFloat((newData.pagoMovil.bs / tasa).toFixed(2)) || 0 };
      }
      
      // Puntos de Venta
      if (newData.puntosVenta) {
        const newPOS = { ...newData.puntosVenta };
        Object.keys(newPOS).forEach(bank => {
          const b = bank as keyof typeof newPOS;
          if (newPOS[b].lotes) {
            newPOS[b].lotes = newPOS[b].lotes.map(lote => ({
              ...lote,
              usd: parseFloat((lote.bs / tasa).toFixed(2)) || 0
            }));
          }
        });
        newData.puntosVenta = newPOS;
      }
      
      return newData;
    });
  }, [formData.tasaBcv]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation: No past dates
    const selectedDate = new Date(formData.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (selectedDate < today) {
      alert('No se puede registrar con fecha anterior al día de hoy');
      return;
    }

    // Validation: 1 hour limit after day ends (assuming day ends at 23:59)
    const dayEnd = new Date(formData.date);
    dayEnd.setHours(23, 59, 59, 999);
    const limit = new Date(dayEnd.getTime() + 3600000); // 1 hour after day end
    
    if (new Date() > limit) {
      alert('Solo tiene 1 hora después de terminar el día para registrar el arqueo');
      return;
    }

    if (submitting) return;
    setSubmitting(true);
    try {
      const token = localStorage.getItem('arqueo_token');
      const response = await fetch('/api/arqueos', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ ...formData, userEmail }),
        credentials: 'include'
      });
      
      if (response.status === 401) {
        onLogout();
        return;
      }

      if (response.ok) {
        alert('Arqueo registrado en Google Sheets con éxito');
        onBack();
      } else {
        const errorText = await response.text();
        let errorMessage = 'Error al guardar el arqueo';
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          errorMessage = errorText.includes('<html>') ? `Error ${response.status}: Servidor no disponible` : errorText;
        }
        throw new Error(errorMessage);
      }
    } catch (error: any) {
      console.error("Error saving arqueo", error);
      alert(error.message || 'Error al guardar el arqueo. Verifica la configuración de Google Sheets.');
    } finally {
      setSubmitting(false);
    }
  };

  const updateField = (path: string, value: any) => {
    const keys = path.split('.');
    const tasa = formData.tasaBcv || 1;
    
    // Ensure numeric values are not NaN
    let sanitizedValue = value;
    if (typeof value === 'number' && isNaN(value)) {
      sanitizedValue = 0;
    }

    if (keys.length === 1) {
      setFormData(prev => {
        const newData = { ...prev, [path]: sanitizedValue };
        
        // Auto-calculate USD for ventaTotalBs
        if (path === 'ventaTotalBs' && tasa > 0) {
          newData.ventaTotal = parseFloat((sanitizedValue / tasa).toFixed(2)) || 0;
        }

        // Auto-calculate Bs for ventaTotal
        if (path === 'ventaTotal' && tasa > 0) {
          newData.ventaTotalBs = parseFloat((sanitizedValue * tasa).toFixed(2)) || 0;
        }
        
        return newData;
      });
    } else if (keys.length === 2) {
      setFormData(prev => {
        const parent = (prev as any)[keys[0]];
        const newData = {
          ...prev,
          [keys[0]]: { ...parent, [keys[1]]: sanitizedValue }
        };

        // Auto-calculate USD for pagoMovil
        if (keys[1] === 'bs' && tasa > 0) {
          if (keys[0] === 'pagoMovil') {
            (newData as any)[keys[0]].usd = parseFloat((sanitizedValue / tasa).toFixed(2)) || 0;
          }
        }
        return newData;
      });
    } else if (keys.length === 3) {
      setFormData(prev => {
        const parent = (prev as any)[keys[0]];
        const child = parent[keys[1]];
        const newData = {
          ...prev,
          [keys[0]]: {
            ...parent,
            [keys[1]]: { ...child, [keys[2]]: sanitizedValue }
          }
        };

        // Auto-calculate USD for puntosVenta
        if (keys[0] === 'puntosVenta' && keys[2] === 'bs' && tasa > 0) {
          (newData as any).puntosVenta[keys[1]].usd = parseFloat((sanitizedValue / tasa).toFixed(2)) || 0;
        }
        return newData;
      });
    }
  };

  const updateLote = (bank: string, index: number, field: string, value: any) => {
    const tasa = formData.tasaBcv || 1;
    setFormData(prev => {
      const newPOS = { ...prev.puntosVenta } as any;
      const bankData = { ...newPOS[bank] };
      const newLotes = [...(bankData.lotes || [])];
      
      let sanitizedValue = value;
      if (field !== 'numero' && typeof value === 'number' && isNaN(value)) {
        sanitizedValue = 0;
      }

      if (newLotes[index]) {
        newLotes[index] = { ...newLotes[index], [field]: sanitizedValue };
        
        if (field === 'bs' && tasa > 0) {
          newLotes[index].usd = parseFloat((sanitizedValue / tasa).toFixed(2)) || 0;
        }
      }

      bankData.lotes = newLotes;
      newPOS[bank] = bankData;
      return { ...prev, puntosVenta: newPOS };
    });
  };

  const addLote = (bank: string) => {
    setFormData(prev => {
      const newPOS = { ...prev.puntosVenta } as any;
      const bankData = { ...newPOS[bank] };
      bankData.lotes = [...(bankData.lotes || []), { numero: '', bs: 0, usd: 0 }];
      newPOS[bank] = bankData;
      return { ...prev, puntosVenta: newPOS };
    });
  };

  const removeLote = (bank: string, index: number) => {
    setFormData(prev => {
      const newPOS = { ...prev.puntosVenta } as any;
      const bankData = { ...newPOS[bank] };
      if (!bankData.lotes || bankData.lotes.length <= 1) return prev;
      bankData.lotes = bankData.lotes.filter((_: any, i: number) => i !== index);
      newPOS[bank] = bankData;
      return { ...prev, puntosVenta: newPOS };
    });
  };

  const totalPagos = useMemo(() => {
    const tasa = formData.tasaBcv || 1;
    const efectivoUsd = formData.efectivo?.usd || 0;
    const efectivoBsEnUsd = (formData.efectivo?.bs || 0) / tasa;
    const efectivo = efectivoUsd + efectivoBsEnUsd;
    
    const pagoMovil = formData.pagoMovil?.usd || 0;
    const zelle = formData.zelle || 0;
    
    const pos = Object.values(formData.puntosVenta || {}).reduce((sum: number, bank: any) => {
      return sum + (bank.lotes?.reduce((lSum: number, lote: any) => lSum + (lote.usd || 0), 0) || 0);
    }, 0);

    const apps = (formData.apps?.pedidosYa || 0) + 
                 (formData.apps?.yummy || 0) + 
                 (formData.apps?.zupper || 0);
    const gastos = (formData.gastos || 0) + 
                   (formData.valesFaltante || 0) + 
                   (formData.vales || 0) + 
                   (formData.fallas || 0) + 
                   (formData.sistemaDuplicados || 0) + 
                   (formData.obsequios || 0);
    
    return efectivo + pagoMovil + zelle + pos + apps + gastos;
  }, [formData]);

  const diferencia = (totalPagos - (formData.ventaTotal || 0)).toFixed(2);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="max-w-4xl mx-auto pb-20"
    >
      <div className="flex items-center justify-between mb-8">
        <button onClick={onBack} className="text-stone-500 hover:text-stone-900 flex items-center gap-2">
          <ChevronRight className="w-5 h-5 rotate-180" />
          Volver
        </button>
        <div className="text-right">
          <h2 className="text-2xl font-bold">Nuevo Arqueo - Tienda {storeId}</h2>
          <p className="text-stone-500">Los datos se enviarán al sistema central.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Header Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-white p-6 rounded-3xl border border-stone-200 shadow-sm">
          <div className="space-y-2">
            <label className="text-xs font-bold text-stone-400 uppercase tracking-wider">Fecha</label>
            <input 
              type="date" 
              value={formData.date}
              onChange={(e) => updateField('date', e.target.value)}
              className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-stone-400 uppercase tracking-wider">Tasa BCV</label>
            <input 
              type="number" 
              step="0.01"
              placeholder="0.00"
              value={formData.tasaBcv}
              onChange={(e) => updateField('tasaBcv', parseFloat(e.target.value))}
              className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-stone-400 uppercase tracking-wider">Turno</label>
            <select 
              value={formData.turno}
              onChange={(e) => updateField('turno', e.target.value)}
              className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 outline-none"
            >
              <option>PRIMER TURNO</option>
              <option>SEGUNDO TURNO</option>
            </select>
          </div>
        </div>

        {/* Sales Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <ShoppingBag className="w-5 h-5 text-emerald-600" />
              <h3 className="font-bold">Resumen de Ventas</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-stone-400 uppercase tracking-wider">Venta Total (Bs)</label>
                <input 
                  type="number" step="0.01" value={formData.ventaTotalBs || ''}
                  onChange={(e) => updateField('ventaTotalBs', parseFloat(e.target.value))}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-stone-400 uppercase tracking-wider">Venta Total ($)</label>
                <input 
                  type="number" step="0.01" value={formData.ventaTotal || ''}
                  onChange={(e) => updateField('ventaTotal', parseFloat(e.target.value))}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-stone-400 uppercase tracking-wider">Transacciones</label>
                <input 
                  type="number" value={formData.transacciones || ''}
                  onChange={(e) => updateField('transacciones', parseInt(e.target.value))}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2"
                />
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold">Fondo de Caja</h3>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Total Fondo</p>
                <p className="text-lg font-bold text-emerald-600">
                  ${((formData.fondoUsd || 0) + ((formData.fondoBs || 0) / (formData.tasaBcv || 1))).toFixed(2)}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-stone-400 uppercase tracking-wider">Fondo Bs.S</label>
                <input 
                  type="number" step="0.01" value={formData.fondoBs}
                  onChange={(e) => updateField('fondoBs', parseFloat(e.target.value))}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-stone-400 uppercase tracking-wider">Fondo $</label>
                <input 
                  type="number" step="0.01" value={formData.fondoUsd}
                  onChange={(e) => updateField('fondoUsd', parseFloat(e.target.value))}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Payments Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Efectivo */}
          <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold flex items-center gap-2"><DollarSign className="w-4 h-4" /> Efectivo</h3>
              <div className="text-right">
                <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Total</p>
                <p className="text-sm font-bold text-emerald-600">
                  ${((formData.efectivo?.usd || 0) + ((formData.efectivo?.bs || 0) / (formData.tasaBcv || 1))).toFixed(2)}
                </p>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-stone-500">Bs.S</span>
                <input type="number" step="0.01" className="w-24 bg-stone-50 border border-stone-200 rounded-lg px-2 py-1 text-right" 
                  value={formData.efectivo?.bs} onChange={(e) => updateField('efectivo.bs', parseFloat(e.target.value))} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-stone-500">$</span>
                <input type="number" step="0.01" className="w-24 bg-stone-50 border border-stone-200 rounded-lg px-2 py-1 text-right" 
                  value={formData.efectivo?.usd} onChange={(e) => updateField('efectivo.usd', parseFloat(e.target.value))} />
              </div>
            </div>
          </div>

          {/* Pago Movil */}
          <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm space-y-4">
            <h3 className="font-bold flex items-center gap-2"><CreditCard className="w-4 h-4" /> Pago Móvil</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-stone-500">Bs.S</span>
                <input type="number" step="0.01" className="w-24 bg-stone-50 border border-stone-200 rounded-lg px-2 py-1 text-right" 
                  value={formData.pagoMovil?.bs} onChange={(e) => updateField('pagoMovil.bs', parseFloat(e.target.value))} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-stone-500">$ Equiv.</span>
                <input type="number" step="0.01" className="w-24 bg-stone-50 border border-stone-200 rounded-lg px-2 py-1 text-right" 
                  value={formData.pagoMovil?.usd} onChange={(e) => updateField('pagoMovil.usd', parseFloat(e.target.value))} />
              </div>
            </div>
          </div>

          {/* Zelle */}
          <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm space-y-4">
            <h3 className="font-bold flex items-center gap-2"><DollarSign className="w-4 h-4" /> Zelle</h3>
            <div className="flex items-center justify-between pt-4">
              <span className="text-sm text-stone-500">Total $</span>
              <input type="number" step="0.01" className="w-24 bg-stone-50 border border-stone-200 rounded-lg px-2 py-1 text-right" 
                value={formData.zelle} onChange={(e) => updateField('zelle', parseFloat(e.target.value))} />
            </div>
          </div>
        </div>

        {/* POS Section */}
        <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm space-y-6">
          <h3 className="font-bold flex items-center gap-2"><CreditCard className="w-5 h-5 text-emerald-600" /> Puntos de Venta (Lotes Credicard)</h3>
          <div className="grid grid-cols-1 gap-8">
            {['venezuela', 'banplus', 'mercantil'].map((bank) => (
              <div key={bank} className="space-y-4 p-4 bg-stone-50 rounded-2xl border border-stone-100">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-stone-500 uppercase tracking-widest">{bank}</p>
                  <button 
                    type="button"
                    onClick={() => addLote(bank)}
                    className="text-xs bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full font-bold hover:bg-emerald-200 transition-colors flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> Agregar Lote
                  </button>
                </div>
                
                <div className="space-y-3">
                  {(formData.puntosVenta as any)[bank]?.lotes.map((lote: any, idx: number) => (
                    <div key={idx} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end bg-white p-3 rounded-xl border border-stone-200 shadow-sm">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-stone-400 uppercase">N° Lote</label>
                        <input 
                          type="text" 
                          placeholder="000"
                          className="w-full bg-stone-50 border border-stone-200 rounded-lg px-2 py-1 text-sm"
                          value={lote.numero} 
                          onChange={(e) => updateLote(bank, idx, 'numero', e.target.value)} 
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-stone-400 uppercase">Monto Bs.S</label>
                        <input 
                          type="number" 
                          step="0.01"
                          className="w-full bg-stone-50 border border-stone-200 rounded-lg px-2 py-1 text-sm text-right"
                          value={lote.bs} 
                          onChange={(e) => updateLote(bank, idx, 'bs', parseFloat(e.target.value))} 
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-stone-400 uppercase">Monto $ Equiv.</label>
                        <input 
                          type="number" 
                          step="0.01"
                          readOnly
                          className="w-full bg-stone-100 border border-stone-200 rounded-lg px-2 py-1 text-sm text-right text-stone-500"
                          value={lote.usd} 
                        />
                      </div>
                      <div className="flex justify-end">
                        <button 
                          type="button"
                          onClick={() => removeLote(bank, idx)}
                          className="text-red-400 hover:text-red-600 p-1 disabled:opacity-30"
                          disabled={(formData.puntosVenta as any)[bank]?.lotes.length <= 1}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="flex justify-end pt-2 border-t border-stone-200">
                  <p className="text-xs font-bold text-stone-500">
                    Total {bank}: <span className="text-emerald-600 ml-2">
                      Bs.S {(formData.puntosVenta as any)[bank]?.lotes.reduce((s: number, l: any) => s + (l.bs || 0), 0).toFixed(2)}
                    </span>
                    <span className="text-stone-400 mx-2">|</span>
                    <span className="text-emerald-600">
                      $ {(formData.puntosVenta as any)[bank]?.lotes.reduce((s: number, l: any) => s + (l.usd || 0), 0).toFixed(2)}
                    </span>
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Apps & Adjustments */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm space-y-4">
            <h3 className="font-bold">Aplicaciones Online</h3>
            <div className="space-y-3">
              {['pedidosYa', 'yummy', 'zupper'].map(app => (
                <div key={app} className="flex items-center justify-between">
                  <span className="text-sm text-stone-500 capitalize">{app}</span>
                  <input type="number" step="0.01" className="w-24 bg-stone-50 border border-stone-200 rounded-lg px-2 py-1 text-right" 
                    value={(formData.apps as any)[app]} onChange={(e) => updateField(`apps.${app}`, parseFloat(e.target.value))} />
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm space-y-4">
            <h3 className="font-bold">Gastos y Ajustes</h3>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              {['gastos', 'valesFaltante', 'vales', 'fallas', 'sistemaDuplicados', 'obsequios'].map(adj => (
                <div key={adj} className="flex items-center justify-between">
                  <span className="text-xs text-stone-500 capitalize">{adj.replace(/([A-Z])/g, ' $1')}</span>
                  <input type="number" step="0.01" className="w-20 bg-stone-50 border border-stone-200 rounded-lg px-2 py-1 text-right" 
                    value={(formData as any)[adj]} onChange={(e) => updateField(adj, parseFloat(e.target.value))} />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Staff Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white p-6 rounded-3xl border border-stone-200 shadow-sm">
          <div className="space-y-2">
            <label className="text-xs font-bold text-stone-400 uppercase tracking-wider">Encargado</label>
            <input 
              type="text" value={formData.encargado}
              onChange={(e) => updateField('encargado', e.target.value)}
              className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-stone-400 uppercase tracking-wider">Cajera</label>
            <input 
              type="text" value={formData.cajera}
              onChange={(e) => updateField('cajera', e.target.value)}
              className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3"
            />
          </div>
        </div>

        {/* Summary Bar */}
        <div className={`p-6 rounded-3xl border flex items-center justify-between shadow-lg transition-all ${
          parseFloat(diferencia) === 0 
            ? 'bg-emerald-50 border-emerald-200 text-emerald-900' 
            : Math.abs(parseFloat(diferencia)) < 1 
              ? 'bg-orange-50 border-orange-200 text-orange-900'
              : 'bg-red-50 border-red-200 text-red-900'
        }`}>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest opacity-60">Resumen del Arqueo</p>
            <div className="flex gap-8 mt-1">
              <div>
                <p className="text-sm font-medium">Total Justificado</p>
                <p className="text-xl font-bold">${totalPagos.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-sm font-medium">Venta en Sistema</p>
                <p className="text-xl font-bold">${(formData.ventaTotal || 0).toFixed(2)}</p>
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs font-bold uppercase tracking-widest opacity-60">Diferencia</p>
            <p className={`text-3xl font-black ${
              parseFloat(diferencia) === 0 ? 'text-emerald-600' : 'text-red-600'
            }`}>
              {parseFloat(diferencia) > 0 ? '+' : ''}{diferencia}
            </p>
          </div>
        </div>

        <button 
          type="submit"
          disabled={submitting}
          className="w-full bg-emerald-600 text-white py-5 rounded-3xl font-bold text-lg hover:bg-emerald-700 transition-all active:scale-95 shadow-xl disabled:opacity-50"
        >
          {submitting ? 'Enviando a Sheets...' : 'Finalizar Arqueo'}
        </button>
      </form>
    </motion.div>
  );
}

function MonitoringView({ arqueos, stores, onBack }: { arqueos: ArqueoData[], stores: Store[], onBack: () => void }) {
  const today = format(new Date(), 'yyyy-MM-dd');
  
  const monitoring = useMemo(() => {
    const todayArqueos = arqueos.filter(a => a.date === today);
    
    const storeStatus = stores.map(store => {
      const storeArqueos = todayArqueos.filter(a => a.tiendaId === store.id);
      const hasDefinitive = storeArqueos.some(a => a.turno === 'SEGUNDO TURNO');
      const hasPartial = storeArqueos.some(a => a.turno === 'PRIMER TURNO');
      
      let status: 'pending' | 'partial' | 'definitive' = 'pending';
      let amount = 0;
      let responsible = '-';
      
      if (hasDefinitive) {
        status = 'definitive';
        const defArqueo = storeArqueos.find(a => a.turno === 'SEGUNDO TURNO');
        amount = parseFloat(defArqueo?.ventaTotal?.toString() || '0');
        responsible = defArqueo?.encargado || '-';
      } else if (hasPartial) {
        status = 'partial';
        const partArqueo = storeArqueos.find(a => a.turno === 'PRIMER TURNO');
        amount = parseFloat(partArqueo?.ventaTotal?.toString() || '0');
        responsible = partArqueo?.encargado || '-';
      }
      
      return {
        ...store,
        status,
        amount,
        responsible
      };
    });

    const partialCount = storeStatus.filter(s => s.status === 'partial' || s.status === 'definitive').length;
    const definitiveCount = storeStatus.filter(s => s.status === 'definitive').length;

    return {
      storeStatus,
      partialCount,
      definitiveCount,
      totalStores: stores.length
    };
  }, [arqueos, stores, today]);

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-stone-900">Monitoreo en Tiempo Real</h2>
          <p className="text-stone-500">Estado de carga de arqueos para hoy: {format(new Date(), 'dd/MM/yyyy')}</p>
        </div>
        <button 
          onClick={onBack}
          className="px-4 py-2 bg-stone-200 text-stone-700 rounded-xl font-medium hover:bg-stone-300 transition-all self-start"
        >
          Volver al Dashboard
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-[2rem] border border-stone-100 shadow-sm">
          <div className="flex items-center gap-4 mb-2">
            <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center text-amber-600">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-stone-400 uppercase tracking-wider">Resumen Parcial (1er Turno)</p>
              <p className="text-3xl font-black text-stone-900">{monitoring.partialCount} / {monitoring.totalStores}</p>
            </div>
          </div>
          <div className="w-full bg-stone-100 h-2 rounded-full mt-4 overflow-hidden">
            <div 
              className="bg-amber-500 h-full transition-all duration-1000" 
              style={{ width: `${(monitoring.partialCount / monitoring.totalStores) * 100}%` }}
            />
          </div>
        </div>

        <div className="bg-white p-6 rounded-[2rem] border border-stone-100 shadow-sm">
          <div className="flex items-center gap-4 mb-2">
            <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center text-emerald-600">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-stone-400 uppercase tracking-wider">Arqueo Definitivo (Cierre)</p>
              <p className="text-3xl font-black text-stone-900">{monitoring.definitiveCount} / {monitoring.totalStores}</p>
            </div>
          </div>
          <div className="w-full bg-stone-100 h-2 rounded-full mt-4 overflow-hidden">
            <div 
              className="bg-emerald-500 h-full transition-all duration-1000" 
              style={{ width: `${(monitoring.definitiveCount / monitoring.totalStores) * 100}%` }}
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-stone-100 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-stone-50">
          <h3 className="font-bold text-stone-800">Detalle por Tienda</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-stone-50/50">
                <th className="px-8 py-4 text-[10px] font-bold text-stone-400 uppercase tracking-widest">Tienda</th>
                <th className="px-8 py-4 text-[10px] font-bold text-stone-400 uppercase tracking-widest">Estado</th>
                <th className="px-8 py-4 text-[10px] font-bold text-stone-400 uppercase tracking-widest">Venta Reportada</th>
                <th className="px-8 py-4 text-[10px] font-bold text-stone-400 uppercase tracking-widest">Responsable</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {monitoring.storeStatus.map((store) => (
                <tr key={store.id} className="hover:bg-stone-50/30 transition-colors">
                  <td className="px-8 py-5">
                    <p className="font-bold text-stone-900">{store.name}</p>
                    <p className="text-xs text-stone-400">{store.location}</p>
                  </td>
                  <td className="px-8 py-5">
                    {store.status === 'definitive' ? (
                      <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full w-fit">
                        <CheckCircle2 className="w-4 h-4" />
                        <span className="text-xs font-bold uppercase">Definitivo</span>
                      </div>
                    ) : store.status === 'partial' ? (
                      <div className="flex items-center gap-2 text-amber-600 bg-amber-50 px-3 py-1 rounded-full w-fit">
                        <Clock className="w-4 h-4" />
                        <span className="text-xs font-bold uppercase">Parcial</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-stone-400 bg-stone-100 px-3 py-1 rounded-full w-fit">
                        <AlertCircle className="w-4 h-4" />
                        <span className="text-xs font-bold uppercase">Pendiente</span>
                      </div>
                    )}
                  </td>
                  <td className="px-8 py-5">
                    <p className="font-mono font-bold text-stone-900">
                      {store.amount > 0 ? `$${store.amount.toFixed(2)}` : '-'}
                    </p>
                  </td>
                  <td className="px-8 py-5">
                    <p className="text-sm text-stone-600">{store.responsible}</p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
}

function HistoryView({ arqueos, onBack }: { arqueos: any[]; onBack: () => void }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
    >
      <div className="flex items-center justify-between mb-8">
        <button onClick={onBack} className="text-stone-500 hover:text-stone-900 flex items-center gap-2">
          <ChevronRight className="w-5 h-5 rotate-180" />
          Volver
        </button>
        <h2 className="text-2xl font-bold">Historial de Arqueos</h2>
      </div>

      <div className="bg-white border border-stone-200 rounded-3xl overflow-hidden shadow-sm">
        <table className="w-full text-left">
          <thead className="bg-stone-50 border-b border-stone-100">
            <tr>
              <th className="px-6 py-4 text-xs font-bold text-stone-400 uppercase tracking-wider">Fecha</th>
              <th className="px-6 py-4 text-xs font-bold text-stone-400 uppercase tracking-wider">Tienda</th>
              <th className="px-6 py-4 text-xs font-bold text-stone-400 uppercase tracking-wider">Turno</th>
              <th className="px-6 py-4 text-xs font-bold text-stone-400 uppercase tracking-wider">Venta</th>
              <th className="px-6 py-4 text-xs font-bold text-stone-400 uppercase tracking-wider">Encargado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {arqueos.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-stone-400">No hay registros aún.</td>
              </tr>
            ) : (
              arqueos.slice().reverse().map((a, idx) => (
                <tr key={idx} className="hover:bg-stone-50 transition-colors">
                  <td className="px-6 py-4 text-sm font-medium">{a.date || a['Fecha']}</td>
                  <td className="px-6 py-4 text-sm">Tienda {a.tiendaId || a['Tienda']}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${(a.turno || a['Turno']) === 'PRIMER TURNO' ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'}`}>
                      {a.turno || a['Turno']}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm font-bold text-emerald-600">${parseFloat(a.ventaTotal || a['Venta Total'] || 0).toFixed(2)}</td>
                  <td className="px-6 py-4 text-sm text-stone-500">{a.encargado || a['Encargado']}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}

function StatsView({ arqueos, onBack, stores }: { arqueos: any[]; onBack: () => void; stores: Store[] }) {
  const stats = useMemo(() => {
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = subDays(new Date(), i);
      return format(date, 'yyyy-MM-dd');
    }).reverse();

    const dailyVentas = last7Days.map(day => {
      const total = arqueos
        .filter(a => (a.date || a['Fecha']) === day)
        .reduce((sum, a) => sum + parseFloat(a.ventaTotal || a['Venta Total'] || 0), 0);
      return { name: format(new Date(day + 'T00:00:00'), 'dd MMM'), total };
    });

    const storeVentas = stores.map(store => {
      const total = arqueos
        .filter(a => (a.tiendaId || a['Tienda']) === store.id)
        .reduce((sum, a) => sum + parseFloat(a.ventaTotal || a['Venta Total'] || 0), 0);
      return { name: store.name, total };
    }).filter(s => s.total > 0);

    const totalVentas = arqueos.reduce((sum, a) => sum + parseFloat(a.ventaTotal || a['Venta Total'] || 0), 0);
    const totalTrans = arqueos.reduce((sum, a) => sum + parseInt(a.transacciones || a['Transacciones'] || 0), 0);
    const avgTicket = totalTrans > 0 ? totalVentas / totalTrans : 0;

    return { dailyVentas, storeVentas, totalVentas, totalTrans, avgTicket };
  }, [arqueos, stores]);

  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-8 pb-20"
    >
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="text-stone-500 hover:text-stone-900 flex items-center gap-2">
          <ChevronRight className="w-5 h-5 rotate-180" />
          Volver
        </button>
        <h2 className="text-2xl font-bold">Dashboard de Estadísticas</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm">
          <p className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-1">Ventas Totales</p>
          <p className="text-3xl font-bold text-emerald-600">${stats.totalVentas.toLocaleString()}</p>
          <div className="flex items-center gap-1 text-emerald-500 text-xs font-bold mt-2">
            <TrendingUp className="w-3 h-3" />
            <span>Acumulado histórico</span>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm">
          <p className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-1">Transacciones</p>
          <p className="text-3xl font-bold text-stone-900">{stats.totalTrans.toLocaleString()}</p>
          <p className="text-xs text-stone-400 mt-2">Ventas registradas</p>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm">
          <p className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-1">Ticket Promedio</p>
          <p className="text-3xl font-bold text-stone-900">${stats.avgTicket.toFixed(2)}</p>
          <p className="text-xs text-stone-400 mt-2">Por transacción</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-3xl border border-stone-200 shadow-sm">
          <h3 className="font-bold mb-6 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-600" />
            Ventas Últimos 7 Días
          </h3>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats.dailyVentas}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#a8a29e' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#a8a29e' }} />
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: number) => [`$${value.toFixed(2)}`, 'Ventas']}
                />
                <Line type="monotone" dataKey="total" stroke="#10b981" strokeWidth={4} dot={{ r: 6, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 8 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-8 rounded-3xl border border-stone-200 shadow-sm">
          <h3 className="font-bold mb-6 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-emerald-600" />
            Ventas por Tienda
          </h3>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.storeVentas}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#a8a29e' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#a8a29e' }} />
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: number) => [`$${value.toFixed(2)}`, 'Ventas']}
                />
                <Bar dataKey="total" radius={[8, 8, 0, 0]}>
                  {stats.storeVentas.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function SettingsView({ onBack, onRefresh, onLogout }: { onBack: () => void, onRefresh: () => Promise<void>, onLogout: () => void }) {
  const [config, setConfig] = useState({
    spreadsheetId: localStorage.getItem('GOOGLE_SHEETS_ID') || '',
    serviceAccount: localStorage.getItem('GOOGLE_SERVICE_ACCOUNT_KEY') || '',
    webAppUrl: localStorage.getItem('WEB_APP_URL') || '',
    supabaseUrl: localStorage.getItem('VITE_SUPABASE_URL') || '',
    supabaseAnonKey: localStorage.getItem('VITE_SUPABASE_ANON_KEY') || ''
  });
  const [isDefault, setIsDefault] = useState(false);
  const [dbSource, setDbSource] = useState(localStorage.getItem('DB_SOURCE') || 'Google Sheets');

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const token = localStorage.getItem('arqueo_token');
        const response = await fetch('/api/config', {
          headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });
        if (response.status === 401) {
          onLogout();
          return;
        }
        if (response.ok) {
          const data = await response.json();
          setConfig({
            spreadsheetId: data.spreadsheetId || '',
            serviceAccount: '',
            webAppUrl: data.webAppUrl || '',
            supabaseUrl: data.supabaseUrl || '',
            supabaseAnonKey: data.supabaseAnonKey || ''
          });
          if (data.dbSource) setDbSource(data.dbSource);
          setIsDefault(data.isDefaultUrl);
        }
      } catch (e) {
        console.error('Error fetching server config:', e);
      }
    };
    fetchConfig();
  }, []);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showScriptCode, setShowScriptCode] = useState(false);
  const [notification, setNotification] = useState<{
    show: boolean;
    title: string;
    message: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);

  const scriptCode = `/**
 * ArqueoPro - Backend para Google Apps Script
 * Versión 1.3 - Mejoras en Diagnóstico de Errores
 */

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
      if (!sheet) return createJsonResponse([]);
      var range = sheet.getDataRange();
      if (range.isBlank()) return createJsonResponse([]);
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
    }
  }
}`;

  const handleTestConnection = async () => {
    setTesting(true);
    try {
      const token = localStorage.getItem('arqueo_token');
      const response = await fetch('/api/test-gas', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ 
          webAppUrl: config.webAppUrl,
          spreadsheetId: config.spreadsheetId
        }),
        credentials: 'include'
      });
      
      const data = await response.json();
      if (response.ok && data.success) {
        showNotify('Conexión Exitosa', 'El sistema se conectó correctamente con Google Apps Script y tiene acceso a la hoja de cálculo.', 'success');
      } else {
        showNotify('Error de Conexión', data.error || 'No se pudo establecer conexión con el script.', 'error');
      }
    } catch (error: any) {
      showNotify('Error de Red', 'No se pudo contactar con el servidor para probar la conexión.', 'error');
    } finally {
      setTesting(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showNotify('Copiado', 'El código se ha copiado al portapapeles.', 'info');
  };

  const appUrl = "https://ais-dev-gf267we4c5ex6bzahu6dpp-314533971453.us-west2.run.app";
  const sharedUrl = "https://ais-pre-gf267we4c5ex6bzahu6dpp-314533971453.us-west2.run.app";

  const showNotify = (title: string, message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setNotification({ show: true, title, message, type });
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      await onRefresh();
      showNotify('Sincronización Exitosa', 'Los datos de las tiendas y arqueos se han descargado correctamente desde Google Sheets.', 'success');
    } catch (error) {
      console.error('Error syncing data:', error);
      showNotify('Error de Sincronización', 'No se pudieron descargar los datos. Verifique la conexión y la URL de la Web App.', 'error');
    } finally {
      setSyncing(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      let spreadsheetId = config.spreadsheetId.includes('docs.google.com') 
        ? config.spreadsheetId.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)?.[1] || config.spreadsheetId
        : config.spreadsheetId;

      let webAppUrl = config.webAppUrl;
      let serviceAccount = config.serviceAccount;

      // If user put URL in service account field, fix it
      if (serviceAccount && serviceAccount.startsWith('http')) {
        webAppUrl = serviceAccount;
        serviceAccount = '';
        setConfig(prev => ({ ...prev, webAppUrl, serviceAccount }));
      }

      localStorage.setItem('GOOGLE_SHEETS_ID', spreadsheetId);
      localStorage.setItem('GOOGLE_SERVICE_ACCOUNT_KEY', serviceAccount);
      localStorage.setItem('WEB_APP_URL', webAppUrl);
      localStorage.setItem('VITE_SUPABASE_URL', config.supabaseUrl);
      localStorage.setItem('VITE_SUPABASE_ANON_KEY', config.supabaseAnonKey);
      localStorage.setItem('DB_SOURCE', dbSource);
      setIsDefault(webAppUrl.includes('AKfycbwUDLN3mjmnGAO25NKlX23DNU29IASOmy_AYYyKZx1gIlAgX_54Gs1GiaWw7m_tmYtp'));
      
      const token = localStorage.getItem('arqueo_token');
      const response = await fetch('/api/config', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          spreadsheetId,
          serviceAccount,
          webAppUrl,
          supabaseUrl: config.supabaseUrl,
          supabaseAnonKey: config.supabaseAnonKey,
          dbSource
        }),
        credentials: 'include'
      });
      
      if (response.status === 401) {
        onLogout();
        return;
      }

      if (response.ok) {
        showNotify('Configuración Guardada', 'Los cambios se han guardado correctamente. La aplicación se actualizará para aplicar los cambios.', 'success');
        setTimeout(() => window.location.reload(), 2000);
      } else {
        const errorText = await response.text();
        throw new Error(errorText.includes('<html>') ? 'Error al guardar en el servidor' : errorText);
      }
    } catch (error) {
      console.error('Error saving config:', error);
      showNotify('Error', 'No se pudo guardar la configuración.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleVerify = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('arqueo_token');
      const response = await fetch('/api/verify-sheets', { 
        method: 'POST', 
        credentials: 'include',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      if (response.status === 401) {
        onLogout();
        return;
      }
      const errorText = await response.text();
      try {
        const data = JSON.parse(errorText);
        if (data.success) {
          showNotify('Estructura Verificada', 'Se han verificado y creado todas las pestañas necesarias en su hoja de cálculo de Google.', 'success');
        } else {
          showNotify('Error de Verificación', data.error || 'No se pudieron crear las pestañas.', 'error');
        }
      } catch (e) {
        showNotify('Error de Verificación', errorText.includes('<html>') ? 'Error del servidor' : errorText, 'error');
      }
    } catch (e) {
      showNotify('Error de Conexión', 'No se pudo comunicar con el servidor para verificar las hojas.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-8 pb-20 max-w-4xl mx-auto"
    >
      <div className="flex items-center justify-between border-b border-stone-200 pb-4">
        <h2 className="text-xl font-bold text-stone-800">Settings</h2>
        <button onClick={onBack} className="text-stone-500 hover:text-stone-900 flex items-center gap-2 text-sm font-bold">
          <ChevronRight className="w-4 h-4 rotate-180" />
          Volver
        </button>
      </div>

      {/* Database Configuration Card */}
      <div className="bg-white p-8 rounded-[2rem] border border-stone-200 shadow-sm space-y-8">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center shrink-0">
            <Database className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-stone-800">Configuración de Base de Datos</h3>
            <p className="text-sm text-stone-500">Defina el origen de sus datos y configure la sincronización.</p>
          </div>
        </div>

        <div className="space-y-4">
          <label className="text-xs font-bold text-stone-800 uppercase">Origen de la Base de Datos</label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {['OneDrive', 'Google Drive', 'SQL', 'Google Sheets'].map((source) => (
              <button
                key={source}
                onClick={() => setDbSource(source)}
                className={`p-4 rounded-2xl border flex flex-col items-center gap-2 transition-all ${
                  dbSource === source 
                    ? 'border-indigo-600 bg-indigo-50/30 text-indigo-600' 
                    : 'border-stone-100 bg-white text-stone-400 hover:border-stone-200'
                }`}
              >
                <Database className="w-5 h-5" />
                <span className="text-[10px] font-bold uppercase">{source}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="h-px bg-stone-100" />

        <div className="space-y-6">
          <div className="flex items-center gap-2 text-stone-600">
            <ExternalLink className="w-4 h-4" />
            <h4 className="font-bold text-sm">Configuración de Sincronización</h4>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold text-stone-800">ID de la Hoja de Google (Spreadsheet ID)</label>
              <button 
                onClick={() => setConfig({ ...config, spreadsheetId: '1LzvB0RjeOrCLmfGPdEtEXAVhviel_it8soYQlgjegyw' })}
                className="text-[10px] font-bold text-indigo-600 hover:underline uppercase tracking-wider"
              >
                Restablecer por Defecto
              </button>
            </div>
            <input 
              type="text" 
              value={config.spreadsheetId}
              onChange={(e) => setConfig({ ...config, spreadsheetId: e.target.value })}
              placeholder="Ej: 11Iml7CA3u8W1rYB-2TXGwlDx49SbOLx1x4OHkOoQDKk"
              className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm font-mono"
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold text-stone-800">URL del Web App (Google Apps Script / OneDrive API)</label>
              <div className="flex gap-2">
                <button 
                  onClick={handleTestConnection}
                  disabled={testing}
                  className="text-[10px] font-bold text-indigo-600 hover:underline uppercase tracking-wider flex items-center gap-1"
                >
                  {testing ? <RefreshCw className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                  Probar Conexión
                </button>
                <button 
                  onClick={() => setConfig({ ...config, webAppUrl: 'https://script.google.com/macros/s/AKfycbwUDLN3mjmnGAO25NKlX23DNU29IASOmy_AYYyKZx1gIlAgX_54Gs1GiaWw7m_tmYtp/exec' })}
                  className="text-[10px] font-bold text-indigo-600 hover:underline uppercase tracking-wider"
                >
                  Restablecer por Defecto
                </button>
              </div>
            </div>
            <input 
              type="text" 
              value={config.webAppUrl}
              onChange={(e) => setConfig({ ...config, webAppUrl: e.target.value })}
              className={`w-full px-4 py-3 rounded-xl border focus:ring-2 outline-none transition-all text-sm font-mono ${
                isDefault ? 'border-red-300 bg-red-50 focus:ring-red-500' : 'border-stone-200 focus:ring-indigo-500'
              }`}
            />
            {isDefault && (
              <div className="flex items-center gap-2 text-red-600 mt-2">
                <AlertCircle className="w-4 h-4" />
                <p className="text-[10px] font-bold uppercase tracking-wider">URL por defecto detectada. Debe configurar su propia Web App.</p>
              </div>
            )}
          </div>

          <div className="h-px bg-stone-100" />

          <div className="bg-indigo-50 border border-indigo-100 p-6 rounded-2xl">
            <div className="flex gap-4 mb-4">
              <Info className="w-6 h-6 text-indigo-500 shrink-0" />
              <div className="space-y-3">
                <p className="text-sm font-bold text-indigo-800">¿Cómo configurar Google Sheets?</p>
                <ol className="text-xs text-indigo-700 space-y-2 list-decimal ml-4">
                  <li>Cree un script en <a href="https://script.google.com" target="_blank" rel="noreferrer" className="underline font-bold">script.google.com</a></li>
                  <li>Copie el código necesario usando el botón de abajo</li>
                  <li><span className="font-bold">PASO CRUCIAL:</span> En el editor de Google, haga clic en el botón <span className="font-bold text-red-600">"Ejecutar"</span> (triángulo) seleccionando la función <span className="font-bold">doGet</span>. Esto abrirá una ventana para <span className="font-bold underline">Autorizar</span> el acceso a sus hojas. <span className="font-bold">Si no hace esto, la app no funcionará.</span></li>
                  <li>Implemente como "Aplicación Web" con acceso para "Cualquiera" (Anyone)</li>
                  <li>Pegue la URL generada arriba y asegúrese de que el ID de la hoja también esté configurado</li>
                </ol>
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <button 
                onClick={() => setShowScriptCode(!showScriptCode)}
                className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all"
              >
                <Code className="w-4 h-4" />
                {showScriptCode ? 'Ocultar Código del Script' : 'Ver Código del Script'}
              </button>
              
              {showScriptCode && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="space-y-2"
                >
                  <div className="relative">
                    <pre className="bg-stone-900 text-stone-300 p-4 rounded-xl text-[10px] overflow-x-auto max-h-60 font-mono">
                      {scriptCode}
                    </pre>
                    <button 
                      onClick={() => copyToClipboard(scriptCode)}
                      className="absolute top-2 right-2 p-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-all"
                      title="Copiar código"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-[10px] text-indigo-600 italic">Copie este código y péguelo en su proyecto de Google Apps Script.</p>
                </motion.div>
              )}
            </div>
          </div>

          <div className="bg-red-50 border border-red-100 p-6 rounded-2xl flex gap-4">
            <AlertCircle className="w-6 h-6 text-red-500 shrink-0" />
            <div className="space-y-3">
              <p className="text-sm font-bold text-red-800">¿Sigue viendo errores de permisos?</p>
              <ul className="text-xs text-red-700 space-y-2 list-disc ml-4">
                <li><span className="font-bold">Error de Autorización:</span> Debe abrir el editor de Google Apps Script y hacer clic en <span className="font-bold">"Ejecutar"</span> manualmente una vez. Google le pedirá permisos.</li>
                <li><span className="font-bold">No se pudo acceder a la hoja:</span> Verifique que el ID de la hoja sea correcto y que la cuenta que desplegó el script tenga acceso de edición a la hoja.</li>
                <li><span className="font-bold">URL de Desarrollo vs Ejecución:</span> Asegúrese de que la URL termine en <span className="font-bold">/exec</span>.</li>
                <li><span className="font-bold">Acceso "Cualquiera":</span> Al implementar, asegúrese de seleccionar <span className="font-bold">"Quién tiene acceso: Cualquiera"</span> (Anyone).</li>
              </ul>
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-4">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 bg-stone-800 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-stone-900 transition-all shadow-lg shadow-stone-800/20 disabled:opacity-50"
            >
              {saving ? <RefreshCw className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
              Guardar Configuración
            </button>
            <button
              onClick={handleTestConnection}
              disabled={saving}
              className="flex-1 border-2 border-stone-800 text-stone-800 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-stone-50 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-5 h-5 ${saving ? 'animate-spin' : ''}`} />
              Probar Conexión
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={handleVerify}
              disabled={saving}
              className="flex items-center justify-center gap-2 px-6 py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all disabled:opacity-50 shadow-lg shadow-indigo-600/20"
            >
              <ShieldCheck className="w-4 h-4" />
              Verificar y Crear Pestañas
            </button>
            <button 
              onClick={handleSync}
              disabled={syncing}
              className="bg-emerald-600 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20 disabled:opacity-50"
            >
              <RefreshCw className={`w-5 h-5 ${syncing ? 'animate-spin' : ''}`} />
              Sincronizar Todo
            </button>
            <button 
              onClick={() => showNotify('Próximamente', 'La función de subida manual estará disponible en la próxima actualización.', 'info')}
              className="border-2 border-indigo-600 text-indigo-600 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-50 transition-all"
            >
              <Upload className="w-5 h-5" />
              Subir Datos
            </button>
          </div>
        </div>
      </div>

      {/* Notification Modal */}
      <AnimatePresence>
        {notification?.show && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-[2.5rem] p-8 max-w-sm w-full shadow-2xl border border-stone-100 text-center space-y-6"
            >
              <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto ${
                notification.type === 'success' ? 'bg-emerald-100 text-emerald-600' : 
                notification.type === 'error' ? 'bg-red-100 text-red-600' : 'bg-indigo-100 text-indigo-600'
              }`}>
                {notification.type === 'success' ? <CheckCircle2 className="w-10 h-10" /> : 
                 notification.type === 'error' ? <AlertCircle className="w-10 h-10" /> : <Info className="w-10 h-10" />}
              </div>
              <div>
                <h3 className="text-xl font-bold text-stone-900">{notification.title}</h3>
                <p className="text-stone-500 text-sm mt-2 leading-relaxed">{notification.message}</p>
              </div>
              <button
                onClick={() => setNotification(null)}
                className="w-full py-4 bg-stone-900 text-white rounded-2xl font-bold hover:bg-stone-800 transition-all active:scale-95"
              >
                Entendido
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Share Application Card */}
      <div className="bg-white p-8 rounded-[2rem] border border-stone-200 shadow-sm space-y-8">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center shrink-0">
            <Share2 className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-stone-800">Compartir Aplicación</h3>
            <p className="text-sm text-stone-500">Envie este link a sus vendedores para que puedan acceder desde sus móviles.</p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Link Público (Para Vendedores)</label>
            <div className="relative">
              <input 
                type="text" 
                readOnly 
                value={sharedUrl}
                className="w-full bg-emerald-50/30 border border-emerald-100 text-emerald-700 px-4 py-4 rounded-2xl text-sm font-mono pr-24"
              />
              <button 
                onClick={() => copyToClipboard(sharedUrl)}
                className="absolute right-2 top-2 bottom-2 bg-white border border-emerald-200 text-emerald-600 px-4 rounded-xl text-[10px] font-bold uppercase flex items-center gap-2 hover:bg-emerald-50"
              >
                <Copy className="w-3 h-3" />
                Copiar
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Link de Desarrollo (Solo Administrador)</label>
            <div className="relative">
              <input 
                type="text" 
                readOnly 
                value={appUrl}
                className="w-full bg-stone-50 border border-stone-200 text-stone-600 px-4 py-4 rounded-2xl text-sm font-mono pr-24"
              />
              <button 
                onClick={() => copyToClipboard(appUrl)}
                className="absolute right-2 top-2 bottom-2 bg-white border border-stone-200 text-stone-600 px-4 rounded-xl text-[10px] font-bold uppercase flex items-center gap-2 hover:bg-stone-50"
              >
                <Copy className="w-3 h-3" />
                Copiar
              </button>
            </div>
          </div>

          <div className="bg-orange-50 border border-orange-100 p-4 rounded-2xl flex gap-4">
            <AlertCircle className="w-6 h-6 text-orange-500 shrink-0" />
            <p className="text-xs text-orange-700 leading-relaxed">
              <span className="font-bold">Importante:</span> Use siempre el <span className="font-bold">Link Público</span> para compartir con su equipo. El link de desarrollo solo funciona si tiene acceso al editor de AI Studio.
            </p>
          </div>

          <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl flex gap-4">
            <CheckCircle2 className="w-6 h-6 text-emerald-500 shrink-0" />
            <p className="text-xs text-emerald-700 leading-relaxed">
              <span className="font-bold">Tip:</span> Los vendedores pueden abrir el link en su navegador móvil y seleccionar <span className="font-bold">"Añadir a la pantalla de inicio"</span> para usarla como una App nativa.
            </p>
          </div>
        </div>
      </div>

      {/* System Information Card */}
      <div className="bg-white p-8 rounded-[2rem] border border-stone-200 shadow-sm space-y-4">
        <h3 className="text-lg font-bold text-stone-800">Información del Sistema</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-stone-500">Versión:</span>
            <span className="font-bold text-stone-800">1.2.1</span>
          </div>
          <div className="flex justify-between">
            <span className="text-stone-500">Estado de Base de Datos Local:</span>
            <span className="font-bold text-emerald-600">Activa (LocalStorage)</span>
          </div>
          <div className="flex justify-between">
            <span className="text-stone-500">Última Sincronización:</span>
            <span className="font-bold text-stone-800">{format(new Date(), 'dd/MM/yyyy')}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function GastosView({ gastos, stores, user, onBack, onRefresh, onLogout }: { gastos: Gasto[], stores: Store[], user: UserType, onBack: () => void, onRefresh: () => void, onLogout: () => void }) {
  const [showForm, setShowForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    tiendaId: user.sucursalId || '',
    montoBs: 0,
    tasaBcv: 0,
    monto: 0,
    descripcion: '',
    tipo: 'Gasto' as Gasto['tipo'],
    autorizadoPor: ''
  });

  const handleMontoBsChange = (val: number) => {
    setFormData(prev => {
      const newData = { ...prev, montoBs: val };
      if (prev.tasaBcv > 0) {
        newData.monto = parseFloat((val / prev.tasaBcv).toFixed(2)) || 0;
      }
      return newData;
    });
  };

  const handleMontoUsdChange = (val: number) => {
    setFormData(prev => {
      const newData = { ...prev, monto: val };
      if (prev.tasaBcv > 0) {
        newData.montoBs = parseFloat((val * prev.tasaBcv).toFixed(2)) || 0;
      }
      return newData;
    });
  };

  const handleTasaChange = (val: number) => {
    setFormData(prev => {
      const newData = { ...prev, tasaBcv: val };
      if (val > 0 && prev.montoBs > 0) {
        newData.monto = parseFloat((prev.montoBs / val).toFixed(2)) || 0;
      }
      return newData;
    });
  };

  const availableStores = user.role === 'Superadmin' ? stores : stores.filter(s => s.id === user.sucursalId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const token = localStorage.getItem('arqueo_token');
      const response = await fetch('/api/gastos', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ ...formData, usuario: user.email }),
        credentials: 'include'
      });
      if (response.status === 401) {
        onLogout();
        return;
      }
      if (response.ok) {
        alert('Gasto registrado con éxito');
        setShowForm(false);
        onRefresh();
      } else {
        const errorText = await response.text();
        alert(errorText.includes('<html>') ? 'Error al registrar gasto' : errorText);
      }
    } catch (e) {
      alert('Error al registrar gasto');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-stone-800">Gastos y Vales</h2>
          <p className="text-stone-500">Gestión de egresos de tienda</p>
        </div>
        <div className="flex gap-2">
          <button onClick={onBack} className="px-4 py-2 text-stone-500 font-bold">Volver</button>
          <button 
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-stone-900 text-white px-6 py-2 rounded-xl font-bold"
          >
            <Plus className="w-5 h-5" />
            Nuevo Registro
          </button>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white p-8 rounded-3xl max-w-md w-full space-y-6"
          >
            <h3 className="text-xl font-bold">Nuevo Gasto/Vale</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-400 uppercase">Fecha</label>
                <input 
                  type="date" 
                  value={formData.date}
                  onChange={e => setFormData({...formData, date: e.target.value})}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-400 uppercase">Tienda</label>
                <select 
                  value={formData.tiendaId}
                  onChange={e => setFormData({...formData, tiendaId: e.target.value})}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2"
                >
                  {availableStores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-400 uppercase">Tipo</label>
                <select 
                  value={formData.tipo}
                  onChange={e => setFormData({...formData, tipo: e.target.value as any})}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2"
                >
                  <option value="Gasto">Gasto</option>
                  <option value="Vale">Vale</option>
                  <option value="Falla">Falla</option>
                  <option value="Vale por faltante">Vale por faltante</option>
                  <option value="Obsequio">Obsequio</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-400 uppercase">Autorizado por</label>
                <input 
                  type="text"
                  value={formData.autorizadoPor}
                  onChange={e => setFormData({...formData, autorizadoPor: e.target.value})}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2"
                  placeholder="Nombre de quien autoriza"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-stone-400 uppercase">Tasa BCV</label>
                  <input 
                    type="number" step="0.01"
                    value={formData.tasaBcv || ''}
                    onChange={e => handleTasaChange(parseFloat(e.target.value))}
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-stone-400 uppercase">Monto (Bs)</label>
                  <input 
                    type="number" step="0.01"
                    value={formData.montoBs || ''}
                    onChange={e => handleMontoBsChange(parseFloat(e.target.value))}
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-stone-400 uppercase">Monto ($)</label>
                  <input 
                    type="number" step="0.01"
                    value={formData.monto || ''}
                    onChange={e => handleMontoUsdChange(parseFloat(e.target.value))}
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-400 uppercase">Descripción</label>
                <textarea 
                  value={formData.descripcion}
                  onChange={e => setFormData({...formData, descripcion: e.target.value})}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2"
                />
              </div>
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-3 font-bold text-stone-500">Cancelar</button>
                <button type="submit" disabled={isSubmitting} className="flex-1 bg-stone-900 text-white py-3 rounded-xl font-bold disabled:opacity-50">
                  {isSubmitting ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      <div className="bg-white rounded-3xl border border-stone-200 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-stone-50 border-b border-stone-200">
            <tr>
              <th className="px-6 py-4 text-xs font-bold text-stone-400 uppercase">Fecha</th>
              <th className="px-6 py-4 text-xs font-bold text-stone-400 uppercase">Tienda</th>
              <th className="px-6 py-4 text-xs font-bold text-stone-400 uppercase">Tipo</th>
              <th className="px-6 py-4 text-xs font-bold text-stone-400 uppercase">Monto</th>
              <th className="px-6 py-4 text-xs font-bold text-stone-400 uppercase">Descripción</th>
              <th className="px-6 py-4 text-xs font-bold text-stone-400 uppercase">Autorizado</th>
              <th className="px-6 py-4 text-xs font-bold text-stone-400 uppercase">Usuario</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {gastos.length === 0 ? (
              <tr><td colSpan={7} className="px-6 py-8 text-center text-stone-400">No hay registros</td></tr>
            ) : (
              gastos.map((g, i) => (
                <tr key={i} className="hover:bg-stone-50 transition-colors">
                  <td className="px-6 py-4 text-sm">{g.date || (g as any).FECHA}</td>
                  <td className="px-6 py-4 text-sm font-bold">{g.tiendaId || (g as any).TIENDA_ID}</td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${
                      (g.tipo || (g as any).TIPO) === 'Gasto' ? 'bg-orange-100 text-orange-600' : 
                      (g.tipo || (g as any).TIPO) === 'Vale' ? 'bg-blue-100 text-blue-600' :
                      (g.tipo || (g as any).TIPO) === 'Falla' ? 'bg-red-100 text-red-600' :
                      (g.tipo || (g as any).TIPO) === 'Vale por faltante' ? 'bg-purple-100 text-purple-600' :
                      'bg-emerald-100 text-emerald-600'
                    }`}>
                      {g.tipo || (g as any).TIPO}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm font-bold text-red-600">${g.monto || (g as any).MONTO}</td>
                  <td className="px-6 py-4 text-sm text-stone-500">{g.descripcion || (g as any).DESCRIPCION}</td>
                  <td className="px-6 py-4 text-sm text-stone-600">{g.autorizadoPor || (g as any).AUTORIZADO_POR}</td>
                  <td className="px-6 py-4 text-xs text-stone-400">{g.usuario || (g as any).USUARIO}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}

function PagosMovilView({ pagos, stores, user, onBack, onRefresh, onLogout }: { pagos: PagoMovil[], stores: Store[], user: UserType, onBack: () => void, onRefresh: () => void, onLogout: () => void }) {
  const [showForm, setShowForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    tiendaId: user.sucursalId || '',
    montoBs: 0,
    referencia: '',
    banco: '',
    titular: ''
  });

  const availableStores = user.role.toLowerCase() === 'superadmin' ? stores : stores.filter(s => s.id === user.sucursalId);
  const canVerify = user.role.toLowerCase() === 'superadmin' || user.role === 'Verificador Zelle y Pago Movil' || user.role === 'Verificador de Pagos';

  const [filterStore, setFilterStore] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const filteredPagos = useMemo(() => {
    return pagos.filter(p => {
      if (filterStore && p.tiendaId !== filterStore) return false;
      if (startDate && p.date < startDate) return false;
      if (endDate && p.date > endDate) return false;
      return true;
    });
  }, [pagos, filterStore, startDate, endDate]);

  const exportToExcel = () => {
    const dataToExport = filteredPagos.map(p => {
      const store = stores.find(s => s.id === p.tiendaId);
      return {
        'Fecha': p.date,
        'Tienda': store ? store.name : p.tiendaId,
        'Titular': p.titular,
        'Banco': p.banco,
        'Referencia': p.referencia,
        'Monto (Bs)': p.montoBs,
        'Estado': p.verificado ? 'Verificado' : 'Pendiente',
        'Usuario': p.usuario
      };
    });
    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Pagos Movil");
    XLSX.writeFile(wb, `PagosMovil_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const token = localStorage.getItem('arqueo_token');
      const response = await fetch('/api/pagos-movil', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ ...formData, usuario: user.email }),
        credentials: 'include'
      });
      if (response.status === 401) {
        onLogout();
        return;
      }
      if (response.ok) {
        alert('Pago registrado con éxito');
        setShowForm(false);
        onRefresh();
      } else {
        const errorText = await response.text();
        try {
          const data = JSON.parse(errorText);
          alert(data.error || 'Error al registrar pago');
        } catch (e) {
          alert(errorText.includes('<html>') ? 'Error al registrar pago' : errorText);
        }
      }
    } catch (e) {
      alert('Error al conectar con el servidor');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerify = async (referencia: string, verificado: boolean) => {
    try {
      const token = localStorage.getItem('arqueo_token');
      const response = await fetch('/api/verificar-pago', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ referencia, verificado }),
        credentials: 'include'
      });
      if (response.status === 401) {
        onLogout();
        return;
      }
      if (response.ok) {
        onRefresh();
      } else {
        const errorText = await response.text();
        alert(errorText.includes('<html>') ? 'Error al verificar pago' : errorText);
      }
    } catch (e) {
      alert('Error al verificar pago');
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-stone-800">Pagos Móvil</h2>
          <p className="text-stone-500">Verificación y registro de pagos móviles</p>
        </div>
        <div className="flex gap-2">
          <button onClick={onBack} className="px-4 py-2 text-stone-500 font-bold">Volver</button>
          <button onClick={exportToExcel} className="flex items-center gap-2 bg-green-600 text-white px-6 py-2 rounded-xl font-bold">
            <Download className="w-5 h-5" />
            Exportar
          </button>
          {['Superadmin', 'Gerente de Tienda'].includes(user.role) && (
            <button 
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold"
            >
              <Plus className="w-5 h-5" />
              Nuevo Pago
            </button>
          )}
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-stone-200 flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-xs font-medium text-stone-500 mb-1">Tienda</label>
          <select 
            value={filterStore} 
            onChange={e => setFilterStore(e.target.value)}
            className="p-2 border border-stone-200 rounded-lg text-sm"
          >
            <option value="">Todas las tiendas</option>
            {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-stone-500 mb-1">Desde</label>
          <input 
            type="date" 
            value={startDate} 
            onChange={e => setStartDate(e.target.value)}
            className="p-2 border border-stone-200 rounded-lg text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-stone-500 mb-1">Hasta</label>
          <input 
            type="date" 
            value={endDate} 
            onChange={e => setEndDate(e.target.value)}
            className="p-2 border border-stone-200 rounded-lg text-sm"
          />
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white p-8 rounded-3xl max-w-md w-full space-y-6"
          >
            <h3 className="text-xl font-bold">Registrar Pago Móvil</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-400 uppercase">Fecha</label>
                <input 
                  type="date" 
                  value={formData.date}
                  onChange={e => setFormData({...formData, date: e.target.value})}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-400 uppercase">Tienda</label>
                <select 
                  value={formData.tiendaId}
                  onChange={e => setFormData({...formData, tiendaId: e.target.value})}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2"
                >
                  {availableStores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-400 uppercase">Monto Bs.S</label>
                <input 
                  type="number" step="0.01"
                  value={formData.montoBs}
                  onChange={e => setFormData({...formData, montoBs: parseFloat(e.target.value)})}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-400 uppercase">Referencia (Últimos 4-6 dígitos)</label>
                <input 
                  type="text"
                  value={formData.referencia}
                  onChange={e => setFormData({...formData, referencia: e.target.value})}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-400 uppercase">Banco Emisor</label>
                <input 
                  type="text"
                  placeholder="Ej: Mercantil, Banesco..."
                  value={formData.banco}
                  onChange={e => setFormData({...formData, banco: e.target.value})}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-400 uppercase">Nombre y Apellido (Titular)</label>
                <input 
                  type="text"
                  value={formData.titular}
                  onChange={e => setFormData({...formData, titular: e.target.value})}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2"
                  placeholder="Nombre del titular de la cuenta"
                />
              </div>
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-3 font-bold text-stone-500">Cancelar</button>
                <button type="submit" disabled={isSubmitting} className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-bold disabled:opacity-50">
                  {isSubmitting ? 'Registrando...' : 'Registrar'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      <div className="bg-white rounded-3xl border border-stone-200 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-stone-50 border-b border-stone-200">
            <tr>
              <th className="px-6 py-4 text-xs font-bold text-stone-400 uppercase">Fecha</th>
              <th className="px-6 py-4 text-xs font-bold text-stone-400 uppercase">Tienda</th>
              <th className="px-6 py-4 text-xs font-bold text-stone-400 uppercase">Monto Bs.S</th>
              <th className="px-6 py-4 text-xs font-bold text-stone-400 uppercase">Referencia</th>
              <th className="px-6 py-4 text-xs font-bold text-stone-400 uppercase">Banco</th>
              <th className="px-6 py-4 text-xs font-bold text-stone-400 uppercase">Titular</th>
              <th className="px-6 py-4 text-xs font-bold text-stone-400 uppercase">Estado</th>
              <th className="px-6 py-4 text-xs font-bold text-stone-400 uppercase">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {filteredPagos.length === 0 ? (
              <tr><td colSpan={8} className="px-6 py-8 text-center text-stone-400">No hay pagos registrados</td></tr>
            ) : (
              filteredPagos.map((p, i) => {
                const isVerificado = (p.verificado || (p as any).VERIFICADO) === 'TRUE' || p.verificado === true;
                return (
                  <tr key={i} className="hover:bg-stone-50 transition-colors">
                    <td className="px-6 py-4 text-sm">{p.date || (p as any).FECHA}</td>
                    <td className="px-6 py-4 text-sm font-bold">{p.tiendaId || (p as any).TIENDA_ID}</td>
                    <td className="px-6 py-4 text-sm font-bold text-indigo-600">{p.montoBs || (p as any).MONTO_BS} Bs.S</td>
                    <td className="px-6 py-4 text-sm font-mono">{p.referencia || (p as any).REFERENCIA}</td>
                    <td className="px-6 py-4 text-sm text-stone-500">{p.banco || (p as any).BANCO}</td>
                    <td className="px-6 py-4 text-sm text-stone-600">{p.titular || (p as any).TITULAR}</td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase flex items-center gap-1 w-fit ${
                        isVerificado ? 'bg-emerald-100 text-emerald-600' : 'bg-orange-100 text-orange-600'
                      }`}>
                        {isVerificado ? <Check className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                        {isVerificado ? 'Verificado' : 'Pendiente'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {canVerify && !isVerificado && (
                        <button 
                          onClick={() => handleVerify(p.referencia || (p as any).REFERENCIA, true)}
                          className="text-emerald-600 hover:text-emerald-700 font-bold text-xs uppercase tracking-wider"
                        >
                          Verificar
                        </button>
                      )}
                      {canVerify && isVerificado && (
                        <button 
                          onClick={() => handleVerify(p.referencia || (p as any).REFERENCIA, false)}
                          className="text-stone-400 hover:text-stone-600 font-bold text-xs uppercase tracking-wider"
                        >
                          Desmarcar
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}

function ZelleView({ zelle, stores, user, onBack, onRefresh, onLogout }: { zelle: Zelle[], stores: Store[], user: UserType, onBack: () => void, onRefresh: () => void, onLogout: () => void }) {
  const [showForm, setShowForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    tiendaId: user.sucursalId || '',
    monto: 0,
    titular: '',
    receptor: '',
    motivo: ''
  });

  const availableStores = user.role.toLowerCase() === 'superadmin' ? stores : stores.filter(s => s.id === user.sucursalId);
  const canVerify = user.role.toLowerCase() === 'superadmin' || user.role === 'Verificador Zelle y Pago Movil';

  const [filterStore, setFilterStore] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const filteredZelle = useMemo(() => {
    return zelle.filter(z => {
      if (filterStore && z.tiendaId !== filterStore) return false;
      if (startDate && z.date < startDate) return false;
      if (endDate && z.date > endDate) return false;
      return true;
    });
  }, [zelle, filterStore, startDate, endDate]);

  const exportToExcel = () => {
    const dataToExport = filteredZelle.map(z => {
      const store = stores.find(s => s.id === z.tiendaId);
      return {
        'Fecha': z.date,
        'Tienda': store ? store.name : z.tiendaId,
        'Titular': z.titular,
        'Receptor': z.receptor,
        'Motivo': z.motivo,
        'Monto ($)': z.monto,
        'Estado': z.verificado ? 'Verificado' : 'Pendiente',
        'Usuario': z.usuario
      };
    });
    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Zelle");
    XLSX.writeFile(wb, `Zelle_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const token = localStorage.getItem('arqueo_token');
      const response = await fetch('/api/zelle', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ ...formData, usuario: user.email }),
        credentials: 'include'
      });
      if (response.status === 401) {
        onLogout();
        return;
      }
      if (response.ok) {
        alert('Zelle registrado con éxito');
        setShowForm(false);
        onRefresh();
      } else {
        const errorText = await response.text();
        try {
          const data = JSON.parse(errorText);
          alert(data.error || 'Error al registrar Zelle');
        } catch (e) {
          alert(errorText.includes('<html>') ? 'Error al registrar Zelle' : errorText);
        }
      }
    } catch (e) {
      alert('Error al conectar con el servidor');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerify = async (id: string, verificado: boolean) => {
    try {
      const token = localStorage.getItem('arqueo_token');
      const response = await fetch('/api/verificar-zelle', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ id, verificado }),
        credentials: 'include'
      });
      if (response.status === 401) {
        onLogout();
        return;
      }
      if (response.ok) {
        onRefresh();
      } else {
        alert('Error al verificar');
      }
    } catch (e) {
      alert('Error de conexión');
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div className="flex gap-2">
          <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <ChevronRight className="w-6 h-6 rotate-180" />
          </button>
          <button onClick={exportToExcel} className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors">
            <Download className="w-5 h-5" />
            Exportar
          </button>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            {showForm ? <X className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
            {showForm ? 'Cancelar' : 'Nuevo Zelle'}
          </button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-wrap gap-4 items-end mb-6">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Tienda</label>
          <select 
            value={filterStore} 
            onChange={e => setFilterStore(e.target.value)}
            className="p-2 border border-gray-200 rounded-lg text-sm"
          >
            <option value="">Todas las tiendas</option>
            {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Desde</label>
          <input 
            type="date" 
            value={startDate} 
            onChange={e => setStartDate(e.target.value)}
            className="p-2 border border-gray-200 rounded-lg text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Hasta</label>
          <input 
            type="date" 
            value={endDate} 
            onChange={e => setEndDate(e.target.value)}
            className="p-2 border border-gray-200 rounded-lg text-sm"
          />
        </div>
      </div>

      {showForm && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-6">
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Fecha</label>
              <input
                type="date"
                required
                value={formData.date}
                onChange={e => setFormData({...formData, date: e.target.value})}
                className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Tienda</label>
              <select
                required
                value={formData.tiendaId}
                onChange={e => setFormData({...formData, tiendaId: e.target.value})}
                className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Seleccione una tienda</option>
                {availableStores.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Monto ($)</label>
              <input
                type="number"
                step="0.01"
                required
                value={formData.monto || ''}
                onChange={e => setFormData({...formData, monto: parseFloat(e.target.value)})}
                className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Titular (Emisor)</label>
              <input
                type="text"
                required
                value={formData.titular}
                onChange={e => setFormData({...formData, titular: e.target.value})}
                className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Nombre del titular"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Receptor</label>
              <input
                type="text"
                required
                value={formData.receptor}
                onChange={e => setFormData({...formData, receptor: e.target.value})}
                className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Correo o teléfono receptor"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Motivo</label>
              <input
                type="text"
                required
                value={formData.motivo}
                onChange={e => setFormData({...formData, motivo: e.target.value})}
                className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Motivo del pago"
              />
            </div>
            <div className="md:col-span-2 lg:col-span-3 flex justify-end gap-4 mt-4">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-6 py-2 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {isSubmitting ? 'Guardando...' : 'Guardar Zelle'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="p-4 font-semibold text-gray-600">Fecha</th>
                <th className="p-4 font-semibold text-gray-600">Tienda</th>
                <th className="p-4 font-semibold text-gray-600">Titular</th>
                <th className="p-4 font-semibold text-gray-600">Receptor</th>
                <th className="p-4 font-semibold text-gray-600">Motivo</th>
                <th className="p-4 font-semibold text-gray-600 text-right">Monto ($)</th>
                <th className="p-4 font-semibold text-gray-600 text-center">Estado</th>
                {canVerify && <th className="p-4 font-semibold text-gray-600 text-center">Acción</th>}
              </tr>
            </thead>
            <tbody>
              {filteredZelle.map((z, i) => {
                const store = stores.find(s => String(s.id) === String(z.tiendaId));
                return (
                  <tr key={z.id || i} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="p-4 text-gray-800">{z.date}</td>
                    <td className="p-4 text-gray-600">{store?.name || z.tiendaId}</td>
                    <td className="p-4 text-gray-600">{z.titular}</td>
                    <td className="p-4 text-gray-600">{z.receptor}</td>
                    <td className="p-4 text-gray-600">{z.motivo}</td>
                    <td className="p-4 text-gray-800 font-medium text-right">${z.monto?.toFixed(2)}</td>
                    <td className="p-4 text-center">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        z.verificado ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {z.verificado ? 'Verificado' : 'Pendiente'}
                      </span>
                    </td>
                    {canVerify && (
                      <td className="p-4 text-center">
                        {!z.verificado && (
                          <button
                            onClick={() => handleVerify(z.id!, true)}
                            className="text-blue-600 hover:text-blue-800 font-medium text-sm"
                          >
                            Verificar
                          </button>
                        )}
                        {z.verificado && (
                          <button
                            onClick={() => handleVerify(z.id!, false)}
                            className="text-red-600 hover:text-red-800 font-medium text-sm"
                          >
                            Deshacer
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
              {filteredZelle.length === 0 && (
                <tr>
                  <td colSpan={canVerify ? 8 : 7} className="p-8 text-center text-gray-500">
                    No hay registros de Zelle
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function LotesView({ arqueos, stores, onBack }: { arqueos: ArqueoData[], stores: Store[], onBack: () => void }) {
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [filterStore, setFilterStore] = useState('');

  const lotesDelDia = useMemo(() => {
    const arqueosFiltrados = arqueos.filter(a => {
      const date = (a as any).FECHA || a.date;
      if (startDate && date < startDate) return false;
      if (endDate && date > endDate) return false;
      
      const storeId = (a as any).SUCURSAL_ID || a.tiendaId;
      if (filterStore && storeId !== filterStore) return false;
      
      return true;
    });
    
    const lotes: any[] = [];
    
    arqueosFiltrados.forEach(a => {
      const storeId = (a as any).SUCURSAL_ID || a.tiendaId;
      const store = stores.find(s => s.id === storeId);
      const storeName = store ? store.name : storeId;
      
      const pv = a.puntosVenta || (a as any).POS_DETALLES;
      if (pv) {
        let parsedPv = pv;
        if (typeof pv === 'string') {
          try { parsedPv = JSON.parse(pv); } catch(e) {}
        }
        
        ['venezuela', 'banplus', 'mercantil'].forEach(banco => {
          if (parsedPv[banco] && parsedPv[banco].lotes) {
            parsedPv[banco].lotes.forEach((lote: any) => {
              if (lote.numero || lote.bs > 0) {
                lotes.push({
                  tienda: storeName,
                  fecha: (a as any).FECHA || a.date,
                  banco: banco?.charAt(0).toUpperCase() + banco.slice(1),
                  numero: lote.numero,
                  montoBs: lote.bs,
                  montoUsd: lote.usd
                });
              }
            });
          }
        });
      }
    });
    
    return lotes;
  }, [arqueos, startDate, endDate, filterStore, stores]);

  const exportToExcel = () => {
    const dataToExport = lotesDelDia.map(l => ({
      'Fecha': l.fecha,
      'Tienda': l.tienda,
      'Banco': l.banco,
      'N° de Lote': l.numero,
      'Monto (Bs)': l.montoBs,
      'Monto ($)': l.montoUsd
    }));
    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Lotes POS");
    XLSX.writeFile(wb, `LotesPOS_${startDate}_${endDate}.xlsx`);
  };

  const totalBs = lotesDelDia.reduce((sum, l) => sum + (l.montoBs || 0), 0);
  const totalUsd = lotesDelDia.reduce((sum, l) => sum + (l.montoUsd || 0), 0);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div className="flex gap-2">
          <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <ChevronRight className="w-6 h-6 rotate-180" />
          </button>
          <button onClick={exportToExcel} className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors">
            <Download className="w-5 h-5" />
            Exportar
          </button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-wrap gap-4 items-end mb-6">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Tienda</label>
          <select 
            value={filterStore} 
            onChange={e => setFilterStore(e.target.value)}
            className="p-2 border border-gray-200 rounded-lg text-sm"
          >
            <option value="">Todas las tiendas</option>
            {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Desde</label>
          <input 
            type="date" 
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Hasta</label>
          <input 
            type="date" 
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col">
          <span className="text-sm text-gray-500 font-medium">Total Lotes (Bs)</span>
          <span className="text-2xl font-bold text-gray-800">Bs. {totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</span>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col">
          <span className="text-sm text-gray-500 font-medium">Total Lotes ($)</span>
          <span className="text-2xl font-bold text-gray-800">${totalUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="p-4 font-semibold text-gray-600">Fecha</th>
                <th className="p-4 font-semibold text-gray-600">Tienda</th>
                <th className="p-4 font-semibold text-gray-600">Banco</th>
                <th className="p-4 font-semibold text-gray-600">N° de Lote</th>
                <th className="p-4 font-semibold text-gray-600 text-right">Monto (Bs)</th>
                <th className="p-4 font-semibold text-gray-600 text-right">Monto ($)</th>
              </tr>
            </thead>
            <tbody>
              {lotesDelDia.map((lote, i) => (
                <tr key={i} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="p-4 text-gray-800">{lote.fecha}</td>
                  <td className="p-4 text-gray-800 font-medium">{lote.tienda}</td>
                  <td className="p-4 text-gray-600">{lote.banco}</td>
                  <td className="p-4 text-gray-600">{lote.numero || 'N/A'}</td>
                  <td className="p-4 text-gray-800 text-right">Bs. {lote.montoBs?.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</td>
                  <td className="p-4 text-gray-800 text-right">${lote.montoUsd?.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                </tr>
              ))}
              {lotesDelDia.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-500">
                    No hay lotes registrados para esta fecha
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StoreSelectionView({ stores, onSelect, onBack }: { stores: Store[]; onSelect: (id: string) => void; onBack: () => void }) {
  const [search, setSearch] = useState('');
  
  const filteredStores = stores.filter(s => 
    s.name.toLowerCase().includes(search.toLowerCase()) || 
    s.id.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="max-w-4xl mx-auto pt-10 pb-20 px-6"
    >
      <div className="flex items-center justify-between mb-8">
        <button onClick={onBack} className="text-stone-500 hover:text-stone-900 flex items-center gap-2">
          <ChevronRight className="w-5 h-5 rotate-180" />
          Volver
        </button>
        <h2 className="text-2xl font-bold text-stone-900">Seleccionar Tienda</h2>
      </div>

      <div className="bg-white p-8 rounded-[2.5rem] border border-stone-200 shadow-xl">
        <div className="relative mb-8">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 w-5 h-5" />
          <input 
            type="text"
            placeholder="Buscar tienda por nombre o ID..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-stone-50 border border-stone-200 rounded-2xl pl-12 pr-6 py-4 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredStores.map(store => (
            <button
              key={store.id}
              onClick={() => onSelect(store.id)}
              className="flex items-center justify-between p-6 rounded-3xl border border-stone-100 hover:border-indigo-500 hover:bg-indigo-50 transition-all group text-left"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-stone-100 group-hover:bg-white rounded-2xl flex items-center justify-center text-stone-400 group-hover:text-indigo-600 transition-colors">
                  <StoreIcon className="w-6 h-6" />
                </div>
                <div>
                  <p className="font-bold text-stone-900 group-hover:text-indigo-900">{store.name}</p>
                  <p className="text-xs text-stone-400 uppercase tracking-widest font-bold">ID: {store.id}</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-stone-300 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all" />
            </button>
          ))}
        </div>

        {filteredStores.length === 0 && (
          <div className="text-center py-20">
            <div className="w-20 h-20 bg-stone-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="w-10 h-10 text-stone-200" />
            </div>
            <p className="text-stone-400 font-medium">No se encontraron tiendas con ese nombre.</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function UsersView({ onBack, stores, onLogout }: { onBack: () => void; stores: Store[]; onLogout: () => void }) {
  const [users, setUsers] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    nombre: '',
    role: 'Supervisor' as UserRole,
    sucursalId: '*'
  });
  const [error, setError] = useState('');

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('arqueo_token');
      const response = await fetch('/api/users', { 
        credentials: 'include',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      if (response.status === 401) {
        onLogout();
        return;
      }
      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      }
    } catch (e) {
      console.error('Error fetching users:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!formData.email || !formData.password || !formData.nombre) {
      setError('Todos los campos son obligatorios');
      return;
    }

    try {
      const token = localStorage.getItem('arqueo_token');
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify(formData),
        credentials: 'include'
      });

      if (response.status === 401) {
        onLogout();
        return;
      }

      if (response.ok) {
        setShowForm(false);
        setFormData({ email: '', password: '', nombre: '', role: 'Supervisor', sucursalId: '*' });
        fetchUsers();
      } else {
        const errorText = await response.text();
        try {
          const data = JSON.parse(errorText);
          setError(data.error || 'Error al crear usuario');
        } catch (e) {
          setError(errorText.includes('<html>') ? 'Error al crear usuario' : errorText);
        }
      }
    } catch (e) {
      setError('Error de conexión');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de desactivar este usuario?')) return;
    try {
      const token = localStorage.getItem('arqueo_token');
      const response = await fetch(`/api/users/${id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      if (response.status === 401) {
        onLogout();
        return;
      }
      if (response.ok) {
        fetchUsers();
      } else {
        const errorText = await response.text();
        console.error('Error deleting user:', errorText);
      }
    } catch (e) {
      console.error('Error deleting user:', e);
    }
  };

  const allowedRoles: UserRole[] = ['Supervisor', 'Verificador de Pagos', 'Contabilidad'];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-6xl mx-auto pt-10 pb-20 px-6"
    >
      <div className="flex items-center justify-between mb-8">
        <button onClick={onBack} className="text-stone-500 hover:text-stone-900 flex items-center gap-2">
          <ChevronRight className="w-5 h-5 rotate-180" />
          Volver
        </button>
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold text-stone-900">Gestión de Usuarios</h2>
          <button 
            onClick={() => setShowForm(true)}
            className="bg-indigo-600 text-white px-6 py-2 rounded-full text-sm font-bold flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
          >
            <Plus className="w-4 h-4" />
            Nuevo Usuario
          </button>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-stone-900/40 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white w-full max-w-md rounded-[2.5rem] p-10 shadow-2xl"
          >
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-bold">Crear Nuevo Usuario</h3>
              <button onClick={() => setShowForm(false)} className="p-2 hover:bg-stone-100 rounded-full">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="p-4 bg-red-50 text-red-600 rounded-2xl text-sm font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </div>
              )}
              
              <div className="space-y-2">
                <label className="text-xs font-bold text-stone-400 uppercase tracking-wider">Nombre Completo</label>
                <input 
                  type="text"
                  value={formData.nombre}
                  onChange={e => setFormData({...formData, nombre: e.target.value})}
                  className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-6 py-4 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  placeholder="Ej: Juan Pérez"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-stone-400 uppercase tracking-wider">Correo Electrónico</label>
                <input 
                  type="email"
                  value={formData.email}
                  onChange={e => setFormData({...formData, email: e.target.value})}
                  className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-6 py-4 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  placeholder="usuario@ejemplo.com"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-stone-400 uppercase tracking-wider">Contraseña</label>
                <input 
                  type="password"
                  value={formData.password}
                  onChange={e => setFormData({...formData, password: e.target.value})}
                  className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-6 py-4 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  placeholder="••••••••"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-stone-400 uppercase tracking-wider">Rol de Usuario</label>
                <select 
                  value={formData.role}
                  onChange={e => setFormData({...formData, role: e.target.value as UserRole})}
                  className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-6 py-4 focus:ring-2 focus:ring-indigo-500 outline-none transition-all appearance-none"
                >
                  {allowedRoles.map((role, index) => (
                    <option key={`${role}-${index}`} value={role}>{role}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-stone-400 uppercase tracking-wider">Sucursal Asignada</label>
                <select 
                  value={formData.sucursalId}
                  onChange={e => setFormData({...formData, sucursalId: e.target.value})}
                  className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-6 py-4 focus:ring-2 focus:ring-indigo-500 outline-none transition-all appearance-none"
                >
                  <option value="*">Todas las sucursales (Acceso Total)</option>
                  {stores.map((store, index) => (
                    <option key={`${store.id}-${index}`} value={store.id}>{store.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-4 pt-4">
                <button 
                  type="button" 
                  onClick={() => setShowForm(false)}
                  className="flex-1 py-4 font-bold text-stone-500 hover:text-stone-900 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="flex-1 bg-indigo-600 text-white py-4 rounded-2xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all"
                >
                  Crear Usuario
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      <div className="bg-white rounded-[2.5rem] border border-stone-200 overflow-hidden shadow-sm">
        <table className="w-full text-left">
          <thead className="bg-stone-50 border-b border-stone-200">
            <tr>
              <th className="px-8 py-5 text-xs font-bold text-stone-400 uppercase tracking-widest">Usuario</th>
              <th className="px-8 py-5 text-xs font-bold text-stone-400 uppercase tracking-widest">Rol</th>
              <th className="px-8 py-5 text-xs font-bold text-stone-400 uppercase tracking-widest">Sucursal</th>
              <th className="px-8 py-5 text-xs font-bold text-stone-400 uppercase tracking-widest">Estado</th>
              <th className="px-8 py-5 text-xs font-bold text-stone-400 uppercase tracking-widest text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {loading ? (
              <tr><td colSpan={5} className="px-8 py-20 text-center text-stone-400">Cargando usuarios...</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={5} className="px-8 py-20 text-center text-stone-400">No hay usuarios registrados</td></tr>
            ) : (
              users.map((u, index) => (
                <tr key={`${u.id}-${index}`} className="hover:bg-stone-50/50 transition-colors">
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600 font-bold">
                        {u.nombre?.charAt(0)}
                      </div>
                      <div>
                        <p className="font-bold text-stone-900">{u.nombre}</p>
                        <p className="text-xs text-stone-400">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <span className="px-3 py-1 bg-stone-100 rounded-full text-[10px] font-bold uppercase tracking-wider text-stone-600">
                      {u.role}
                    </span>
                  </td>
                  <td className="px-8 py-5">
                    <p className="text-sm font-medium text-stone-600">
                      {u.sucursalId === '*' ? 'Acceso Total' : `Tienda ${u.sucursalId}`}
                    </p>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${u.activo ? 'bg-emerald-500' : 'bg-red-500'}`} />
                      <span className={`text-xs font-bold uppercase ${u.activo ? 'text-emerald-600' : 'text-red-600'}`}>
                        {u.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </div>
                  </td>
                  <td className="px-8 py-5 text-right">
                    {u.email !== SUPERADMIN_EMAIL && u.activo && (
                      <button 
                        onClick={() => handleDelete(u.id)}
                        className="text-red-400 hover:text-red-600 p-2 hover:bg-red-50 rounded-xl transition-all"
                        title="Desactivar Usuario"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}
