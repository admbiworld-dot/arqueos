import React, { useState, useEffect, useMemo } from 'react';
import { LogIn, LogOut, Store as StoreIcon, ClipboardList, PlusCircle, History, ChevronRight, Calculator, DollarSign, CreditCard, ShoppingBag, User, LayoutDashboard, BarChart3, TrendingUp, PieChart, Trash2, Plus, CheckCircle2, Clock, AlertCircle, ExternalLink, RefreshCw, Share2, Copy, Info, Upload, Search, Filter, Check, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArqueoData, User as UserType, UserRole, Store, Gasto, PagoMovil } from './types';
import { format, subDays, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Cell, PieChart as RePieChart, Pie } from 'recharts';
import { Settings, Code, ShieldCheck, Database } from 'lucide-react';

const SUPERADMIN_EMAIL = 'josemdesousa03@gmail.com';
const SUPERADMIN_PASS = 'd7246089';

const ROLES: UserRole[] = ['Gerente de Tienda', 'Verificador de Pagos', 'Administrador', 'Contabilidad', 'Supervisor'];

export default function App() {
  const [user, setUser] = useState<UserType | null>(null);
  const [view, setView] = useState<'dashboard' | 'form' | 'history' | 'stats' | 'settings' | 'monitoring' | 'gastos' | 'pagos-movil'>('dashboard');
  const [selectedStore, setSelectedStore] = useState<string | null>(null);
  const [arqueos, setArqueos] = useState<ArqueoData[]>([]);
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [pagosMovil, setPagosMovil] = useState<PagoMovil[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [loginError, setLoginError] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const filteredArqueos = useMemo(() => {
    if (!user) return [];
    if (['Administrador', 'Supervisor', 'Contabilidad'].includes(user.role)) return arqueos;
    return arqueos.filter(a => user.assignedStores.includes(a.tiendaId || a['Tienda ID']));
  }, [arqueos, user]);

  const filteredGastos = useMemo(() => {
    if (!user) return [];
    if (['Administrador', 'Supervisor', 'Contabilidad'].includes(user.role)) return gastos;
    return gastos.filter(g => user.assignedStores.includes(g.tiendaId));
  }, [gastos, user]);

  const filteredPagosMovil = useMemo(() => {
    if (!user) return [];
    if (['Administrador', 'Supervisor', 'Contabilidad', 'Verificador de Pagos'].includes(user.role)) return pagosMovil;
    return pagosMovil.filter(p => user.assignedStores.includes(p.tiendaId));
  }, [pagosMovil, user]);

  const stats = useMemo(() => {
    const totalVentas = filteredArqueos.reduce((sum, a) => sum + parseFloat(a.ventaTotal?.toString() || a['Venta Total']?.toString() || '0'), 0);
    const totalTransacciones = filteredArqueos.reduce((sum, a) => sum + parseInt(a.transacciones?.toString() || a['Transacciones']?.toString() || '0'), 0);
    return { totalVentas, totalTransacciones };
  }, [filteredArqueos]);

  useEffect(() => {
    const checkAuth = async () => {
      const savedUser = localStorage.getItem('arqueo_user');
      if (savedUser) {
        setUser(JSON.parse(savedUser));
      }
      
      // Sync config to server
      const spreadsheetId = localStorage.getItem('GOOGLE_SHEETS_ID');
      const serviceAccount = localStorage.getItem('GOOGLE_SERVICE_ACCOUNT_KEY');
      const webAppUrl = localStorage.getItem('WEB_APP_URL');
      
      if (spreadsheetId || serviceAccount || webAppUrl) {
        try {
          const response = await fetch('/api/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ spreadsheetId, serviceAccount, webAppUrl }),
          });
          if (response.ok) {
            const data = await response.json();
            console.log('Config synced to server:', data);
            // Re-fetch stores after sync
            fetchStores();
          }
        } catch (e) {
          console.error('Error syncing config to server:', e);
        }
      } else {
        fetchStores();
      }
      
      setLoading(false);
    };
    checkAuth();
    fetchStores();
  }, []);

  const fetchStores = async () => {
    try {
      const response = await fetch('/api/stores');
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error ${response.status}: ${errorText}`);
      }
      const data = await response.json();
      setStores(data);
    } catch (error) {
      console.error("Error fetching stores", error);
    }
  };

  useEffect(() => {
    if (user) {
      fetchArqueos();
      fetchGastos();
      fetchPagosMovil();
    }
  }, [user]);

  const fetchArqueos = async () => {
    try {
      const response = await fetch('/api/arqueos');
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Error fetching arqueos');
      }
      const data = await response.json();
      setArqueos(data);
    } catch (error: any) {
      console.error("Error fetching history", error);
      // Optional: show toast
    }
  };

  const fetchGastos = async () => {
    try {
      const response = await fetch('/api/gastos');
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Error fetching gastos');
      }
      const data = await response.json();
      setGastos(data);
    } catch (error: any) {
      console.error("Error fetching gastos", error);
    }
  };

  const fetchPagosMovil = async () => {
    try {
      const response = await fetch('/api/pagos-movil');
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Error fetching pagos movil');
      }
      const data = await response.json();
      setPagosMovil(data);
    } catch (error: any) {
      console.error("Error fetching pagos movil", error);
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
      } else {
        setLoginError(data.error || 'Credenciales incorrectas');
      }
    } catch (error) {
      console.error('Login error:', error);
      setLoginError('Error al conectar con el servidor');
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('arqueo_user');
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

  const canSeeStats = ['Administrador', 'Supervisor', 'Gerente de Tienda'].includes(user.role);

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
            {['Administrador', 'Supervisor', 'Contabilidad'].includes(user.role) && (
              <SidebarItem 
                icon={<Clock className="w-5 h-5" />} 
                label="Monitoreo" 
                active={view === 'monitoring'} 
                onClick={() => { setView('monitoring'); setIsSidebarOpen(false); }} 
              />
            )}
            {['Administrador', 'Gerente de Tienda'].includes(user.role) && (
              <SidebarItem 
                icon={<PlusCircle className="w-5 h-5" />} 
                label="Nuevo Arqueo" 
                active={view === 'form'} 
                onClick={() => {
                  const availableStores = user.role === 'Administrador' ? stores : stores.filter(s => user.assignedStores.includes(s.id));
                  if (availableStores.length > 0) {
                    setSelectedStore(availableStores[0].id);
                    setView('form');
                    setIsSidebarOpen(false);
                  }
                }} 
              />
            )}
            {['Administrador', 'Gerente de Tienda'].includes(user.role) && (
              <SidebarItem 
                icon={<DollarSign className="w-5 h-5" />} 
                label="Gastos/Vales" 
                active={view === 'gastos'} 
                onClick={() => { setView('gastos'); setIsSidebarOpen(false); }} 
              />
            )}
            {['Administrador', 'Gerente de Tienda', 'Verificador de Pagos', 'Contabilidad'].includes(user.role) && (
              <SidebarItem 
                icon={<CreditCard className="w-5 h-5" />} 
                label="Pagos Móvil" 
                active={view === 'pagos-movil'} 
                onClick={() => { setView('pagos-movil'); setIsSidebarOpen(false); }} 
              />
            )}
            {['Administrador', 'Contabilidad', 'Supervisor'].includes(user.role) && (
              <SidebarItem 
                icon={<History className="w-5 h-5" />} 
                label="Histórico" 
                active={view === 'history'} 
                onClick={() => { setView('history'); setIsSidebarOpen(false); }} 
              />
            )}
            {['Administrador', 'Supervisor', 'Contabilidad', 'Gerente de Tienda'].includes(user.role) && (
              <SidebarItem 
                icon={<BarChart3 className="w-5 h-5" />} 
                label="Reportes" 
                active={view === 'stats'} 
                onClick={() => { setView('stats'); setIsSidebarOpen(false); }} 
              />
            )}
            {user.email === SUPERADMIN_EMAIL && (
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
              {user.displayName.charAt(0)}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-bold text-white truncate">{user.displayName}</p>
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
            {user.displayName.charAt(0)}
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
                        {user.displayName.charAt(0)}
                      </div>
                      <div className="flex-1">
                        <p className="font-bold text-stone-900 uppercase text-sm">{user.displayName}</p>
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
            />
          )}

          {view === 'pagos-movil' && (
            <PagosMovilView 
              pagos={filteredPagosMovil} 
              stores={stores}
              user={user}
              onBack={() => setView('dashboard')} 
              onRefresh={fetchPagosMovil}
            />
          )}

          {view === 'stats' && canSeeStats && (
            <StatsView 
              arqueos={filteredArqueos} 
              onBack={() => setView('dashboard')} 
              stores={stores}
            />
          )}

          {view === 'settings' && user.email === SUPERADMIN_EMAIL && (
            <SettingsView 
              onBack={() => setView('dashboard')} 
              onRefresh={() => {
                fetchArqueos();
                fetchGastos();
                fetchPagosMovil();
                fetchStores();
              }}
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

function ArqueoForm({ storeId, onBack, userEmail, gastos, pagosMovil }: { storeId: string; onBack: () => void; userEmail: string; gastos: Gasto[]; pagosMovil: PagoMovil[] }) {
  const [formData, setFormData] = useState<Partial<ArqueoData>>({
    date: new Date().toISOString().split('T')[0],
    tasaBcv: 0,
    tiendaId: storeId,
    turno: 'PRIMER TURNO',
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
    
    const storePagos = pagosMovil.filter(p => p.tiendaId === storeId && p.date === formData.date && p.verificado);
    const totalPagoMovilBs = storePagos.reduce((sum, p) => sum + (parseFloat(p.montoBs.toString()) || 0), 0);
    
    setFormData(prev => ({
      ...prev,
      gastos: totalGastos,
      vales: totalVales,
      pagoMovil: {
        bs: totalPagoMovilBs,
        usd: prev.tasaBcv && prev.tasaBcv > 0 ? parseFloat((totalPagoMovilBs / prev.tasaBcv).toFixed(2)) : 0
      }
    }));
  }, [formData.date, storeId, gastos, pagosMovil, formData.tasaBcv]);

  const [submitting, setSubmitting] = useState(false);

  // Recalculate all USD fields when Tasa BCV changes
  useEffect(() => {
    const tasa = formData.tasaBcv || 0;
    if (tasa <= 0) return;

    setFormData(prev => {
      const newData = { ...prev };
      
      // Fondo
      if (newData.fondoBs) newData.fondoUsd = parseFloat((newData.fondoBs / tasa).toFixed(2)) || 0;
      
      // Efectivo
      if (newData.efectivo?.bs) {
        newData.efectivo = { ...newData.efectivo, usd: parseFloat((newData.efectivo.bs / tasa).toFixed(2)) || 0 };
      }
      
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
    setSubmitting(true);
    try {
      const response = await fetch('/api/arqueos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, userEmail }),
      });
      
      if (response.ok) {
        alert('Arqueo registrado en Google Sheets con éxito');
        onBack();
      } else {
        throw new Error('Failed to save');
      }
    } catch (error) {
      console.error("Error saving arqueo", error);
      alert('Error al guardar el arqueo. Verifica la configuración de Google Sheets.');
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
        // Auto-calculate USD for fondoBs
        if (path === 'fondoBs' && tasa > 0) {
          newData.fondoUsd = parseFloat((sanitizedValue / tasa).toFixed(2)) || 0;
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

        // Auto-calculate USD for efectivo and pagoMovil
        if (keys[1] === 'bs' && tasa > 0) {
          if (keys[0] === 'efectivo' || keys[0] === 'pagoMovil') {
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
    const efectivo = formData.efectivo?.usd || 0;
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
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-stone-400 uppercase tracking-wider">Venta Total ($)</label>
                <input 
                  type="number" step="0.01" value={formData.ventaTotal}
                  onChange={(e) => updateField('ventaTotal', parseFloat(e.target.value))}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-stone-400 uppercase tracking-wider">Transacciones</label>
                <input 
                  type="number" value={formData.transacciones}
                  onChange={(e) => updateField('transacciones', parseInt(e.target.value))}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2"
                />
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-5 h-5 text-emerald-600" />
              <h3 className="font-bold">Fondo de Caja</h3>
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
            <h3 className="font-bold flex items-center gap-2"><DollarSign className="w-4 h-4" /> Efectivo</h3>
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

function SettingsView({ onBack, onRefresh }: { onBack: () => void, onRefresh: () => void }) {
  const [config, setConfig] = useState({
    spreadsheetId: localStorage.getItem('GOOGLE_SHEETS_ID') || '',
    serviceAccount: localStorage.getItem('GOOGLE_SERVICE_ACCOUNT_KEY') || '',
    webAppUrl: localStorage.getItem('WEB_APP_URL') || 'https://script.google.com/macros/s/AKfycb.../exec'
  });
  const [saving, setSaving] = useState(false);
  const [dbSource, setDbSource] = useState('Google Sheets');

  const appUrl = "https://ais-dev-gf267we4c5ex6bzahu6dpp-314533971453.us-west2.run.app";
  const sharedUrl = "https://ais-pre-gf267we4c5ex6bzahu6dpp-314533971453.us-west2.run.app";

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
      
      const response = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spreadsheetId,
          serviceAccount,
          webAppUrl
        }),
      });
      
      if (response.ok) {
        alert('Configuración guardada correctamente. El servidor se reiniciará para aplicar los cambios.');
        window.location.reload();
      } else {
        throw new Error('Error al guardar en el servidor');
      }
    } catch (error) {
      console.error('Error saving config:', error);
      alert('Error al guardar la configuración');
    } finally {
      setSaving(false);
    }
  };

  const handleVerify = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/verify-sheets', { method: 'POST' });
      const data = await response.json();
      if (data.success) alert(data.message || 'Hojas verificadas y creadas correctamente.');
      else alert(data.error || 'Error al verificar hojas');
    } catch (e) {
      alert('Error al conectar con el servidor');
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/test-gas', { method: 'POST' });
      const data = await response.json();
      if (data.success) {
        alert('¡Conexión Exitosa! El servidor puede comunicarse con su Web App.');
      } else {
        alert('Error: ' + (data.error || 'Fallo en la conexión'));
      }
    } catch (error: any) {
      alert('Error de Conexión: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copiado al portapapeles');
  };

  const implementationCode = `/**
 * ArqueoPro - Backend para Google Apps Script
 * Configuración: 16 Tiendas, Métodos de Pago y Gastos
 */

function getSS(id) {
  try {
    if (id) return SpreadsheetApp.openById(id);
    return SpreadsheetApp.getActiveSpreadsheet();
  } catch (e) {
    return null;
  }
}

function doGet(e) {
  try {
    var id = e && e.parameter ? e.parameter.id : null;
    var ss = getSS(id);
    
    if (!ss) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false, 
        error: 'No se pudo acceder a la hoja de cálculo. Verifique el ID o asegúrese de que el script esté vinculado a la hoja.'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    if (e && e.parameter && e.parameter.action === 'read') {
      var sheet = ss.getSheetByName(e.parameter.sheet);
      if (!sheet) return ContentService.createTextOutput(JSON.stringify([])).setMimeType(ContentService.MimeType.JSON);
      
      var range = sheet.getDataRange();
      if (range.getNumRows() < 1) return ContentService.createTextOutput(JSON.stringify([])).setMimeType(ContentService.MimeType.JSON);
      
      var values = range.getValues();
      return ContentService.createTextOutput(JSON.stringify(values)).setMimeType(ContentService.MimeType.JSON);
    }
    
    if (e && e.parameter && e.parameter.action === 'test') {
      return ContentService.createTextOutput(JSON.stringify({success: true, message: 'Conexión exitosa con Google Apps Script'})).setMimeType(ContentService.MimeType.JSON);
    }

    return HtmlService.createHtmlOutput('<h1>ArqueoPro GAS Backend</h1><p>Si ve esto, la URL es correcta pero no se especificó una acción válida.</p>')
      .setTitle('ArqueoPro - GAS')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({success: false, error: err.toString()})).setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var ss = getSS(data.spreadsheetId);
    
    if (!ss) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false, 
        error: 'No se pudo acceder a la hoja de cálculo. Verifique el ID.'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    if (data.action === 'test') {
      return ContentService.createTextOutput(JSON.stringify({success: true, message: 'Conexión POST exitosa'})).setMimeType(ContentService.MimeType.JSON);
    }
    
    if (data.action === 'verify') {
      verifySheets(ss);
      return ContentService.createTextOutput(JSON.stringify({success: true})).setMimeType(ContentService.MimeType.JSON);
    }
    
    if (data.action === 'append') {
      var sheet = ss.getSheetByName(data.sheet) || ss.insertSheet(data.sheet);
      sheet.appendRow(data.values);
      return ContentService.createTextOutput(JSON.stringify({success: true})).setMimeType(ContentService.MimeType.JSON);
    }

    if (data.action === 'update') {
      var sheet = ss.getSheetByName(data.sheet);
      if (!sheet) throw new Error("Sheet not found");
      var range = sheet.getRange(data.range);
      range.setValues(data.values);
      return ContentService.createTextOutput(JSON.stringify({success: true})).setMimeType(ContentService.MimeType.JSON);
    }
    
    return ContentService.createTextOutput(JSON.stringify({success: false, error: 'Unknown action'})).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({success: false, error: err.toString()})).setMimeType(ContentService.MimeType.JSON);
  }
}

function verifySheets(ss) {
  var required = {
    'USUARIO': ['ID_USUARIO', 'USUARIO', 'CORREO', 'CLAVE', 'TIENDAS_ASIGNADA', 'ROL'],
    'SUCURSAL': ['ID_SUCURSAL', 'SUCURSAL', 'LONGITUD', 'LATITUD', 'CATEGORIA', 'EMPRESA'],
    'ARQUEOS': ['FECHA', 'TIENDA_ID', 'TURNO', 'TASA_BCV', 'VENTA_TOTAL', 'TRANSACCIONES', 'FONDO_BS', 'FONDO_USD', 'EFECTIVO_BS', 'EFECTIVO_USD', 'PAGOMOVIL_BS', 'PAGOMOVIL_USD', 'ZELLE', 'POS_VENEZUELA', 'POS_BANPLUS', 'POS_MERCANTIL', 'POS_DETALLES', 'APPS_PEDIDOSYA', 'APPS_YUMMY', 'APPS_ZUPPER', 'GASTOS', 'ENCARGADO', 'CAJERA', 'USUARIO_EMAIL', 'TIMESTAMP'],
    'GASTOS': ['FECHA', 'TIENDA_ID', 'MONTO', 'DESCRIPCION', 'TIPO', 'AUTORIZADO_POR', 'USUARIO', 'TIMESTAMP'],
    'PAGOS_MOVIL': ['FECHA', 'TIENDA_ID', 'MONTO_BS', 'REFERENCIA', 'BANCO', 'TITULAR', 'VERIFICADO', 'USUARIO', 'TIMESTAMP']
  };

  for (var name in required) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
      sheet.appendRow(required[name]);
    } else {
      // Check headers
      var currentHeaders = sheet.getRange(1, 1, 1, required[name].length).getValues()[0];
      if (currentHeaders.join(',') !== required[name].join(',')) {
        sheet.getRange(1, 1, 1, required[name].length).setValues([required[name]]);
      }
    }
  }
}
`;

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
            <label className="text-xs font-bold text-stone-800">ID de la Hoja de Google (Spreadsheet ID)</label>
            <input 
              type="text" 
              value={config.spreadsheetId}
              onChange={(e) => setConfig({ ...config, spreadsheetId: e.target.value })}
              placeholder="Ej: 11Iml7CA3u8W1rYB-2TXGwlDx49SbOLx1x4OHkOoQDKk"
              className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm font-mono"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-stone-800">URL del Web App (Google Apps Script / OneDrive API)</label>
            <input 
              type="text" 
              value={config.webAppUrl}
              onChange={(e) => setConfig({ ...config, webAppUrl: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm font-mono"
            />
          </div>

          <div className="bg-orange-50 border border-orange-100 p-4 rounded-2xl flex gap-4">
            <AlertCircle className="w-6 h-6 text-orange-500 shrink-0" />
            <div className="space-y-1">
              <p className="text-sm font-bold text-orange-800">Nota para dispositivos móviles</p>
              <p className="text-xs text-orange-700 leading-relaxed">
                La configuración de la base de datos se guarda <span className="font-bold">solo en este dispositivo</span>. Para que los pedidos del teléfono lleguen a la base, debe copiar la URL del Web App en la configuración de su teléfono.
              </p>
            </div>
          </div>

          <div className="bg-indigo-50 border border-indigo-100 p-6 rounded-2xl flex gap-4">
            <Info className="w-6 h-6 text-indigo-500 shrink-0" />
            <div className="space-y-3">
              <p className="text-sm font-bold text-indigo-800">¿Cómo configurar Google Sheets?</p>
              <ol className="text-xs text-indigo-700 space-y-2 list-decimal ml-4">
                <li>Cree un script en <a href="https://script.google.com" target="_blank" rel="noreferrer" className="underline font-bold">script.google.com</a></li>
                <li>Copie el código del archivo <span className="font-bold uppercase">GOOGLE_APPS_SCRIPT.gs</span> (He actualizado este archivo para que use el ID de la hoja automáticamente)</li>
                <li>Implemente como "Aplicación Web" con acceso para "Cualquiera" (Anyone)</li>
                <li>Pegue la URL generada arriba y asegúrese de que el ID de la hoja también esté configurado</li>
                <li><span className="font-bold">Importante:</span> Si el script no está vinculado a la hoja, el sistema usará el ID de la hoja configurado arriba.</li>
              </ol>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={handleTestConnection}
              disabled={saving}
              className="flex items-center justify-center gap-2 px-6 py-4 bg-indigo-50 text-indigo-700 rounded-2xl font-bold hover:bg-indigo-100 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${saving ? 'animate-spin' : ''}`} />
              Probar Conexión
            </button>
            <button
              onClick={handleVerify}
              disabled={saving}
              className="flex items-center justify-center gap-2 px-6 py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all disabled:opacity-50 shadow-lg shadow-indigo-600/20"
            >
              <ShieldCheck className="w-4 h-4" />
              Verificar y Crear Pestañas
            </button>
            <button
              onClick={() => {
                onRefresh();
                alert('Sincronización iniciada...');
              }}
              className="flex items-center justify-center gap-2 px-6 py-4 bg-stone-800 text-white rounded-2xl font-bold hover:bg-stone-900 transition-all shadow-lg shadow-stone-800/20"
            >
              <RefreshCw className="w-4 h-4" />
              Descargar de Google Sheets
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button 
              onClick={async () => {
                onRefresh();
                alert('Sincronización iniciada');
              }}
              className="bg-indigo-600 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20"
            >
              <RefreshCw className="w-5 h-5" />
              Descargar de Google Sheets
            </button>
            <button className="border-2 border-indigo-600 text-indigo-600 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-50 transition-all">
              <Upload className="w-5 h-5" />
              Subir Datos a Google Sheets
            </button>
          </div>
        </div>
      </div>

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
            <span className="font-bold text-stone-800">1.2.0</span>
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

      {/* Implementation Code Section */}
      <div className="bg-white border border-stone-200 rounded-[2rem] overflow-hidden shadow-sm">
        <div className="p-6 border-b border-stone-100 flex items-center justify-between bg-stone-50">
          <div className="flex items-center gap-2">
            <Code className="w-5 h-5 text-stone-400" />
            <h3 className="font-bold">Código de Implementación (Google Apps Script)</h3>
          </div>
          <button 
            onClick={() => copyToClipboard(implementationCode)}
            className="text-xs font-bold text-emerald-600 hover:text-emerald-700 uppercase tracking-wider"
          >
            Copiar Código
          </button>
        </div>
        <div className="p-6 bg-stone-900 overflow-x-auto">
          <pre className="text-emerald-400 font-mono text-sm leading-relaxed">
            {implementationCode}
          </pre>
        </div>
      </div>
    </motion.div>
  );
}

function GastosView({ gastos, stores, user, onBack, onRefresh }: { gastos: Gasto[], stores: Store[], user: UserType, onBack: () => void, onRefresh: () => void }) {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    tiendaId: user.assignedStores[0] || '',
    monto: 0,
    descripcion: '',
    tipo: 'Gasto' as 'Gasto' | 'Vale',
    autorizadoPor: ''
  });

  const availableStores = user.role === 'Administrador' ? stores : stores.filter(s => user.assignedStores.includes(s.id));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/gastos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, usuario: user.email }),
      });
      if (response.ok) {
        alert('Gasto registrado con éxito');
        setShowForm(false);
        onRefresh();
      }
    } catch (e) {
      alert('Error al registrar gasto');
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
              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-400 uppercase">Monto ($)</label>
                <input 
                  type="number" step="0.01"
                  value={formData.monto}
                  onChange={e => setFormData({...formData, monto: parseFloat(e.target.value)})}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2"
                />
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
                <button type="submit" className="flex-1 bg-stone-900 text-white py-3 rounded-xl font-bold">Guardar</button>
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
                      (g.tipo || (g as any).TIPO) === 'Gasto' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'
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

function PagosMovilView({ pagos, stores, user, onBack, onRefresh }: { pagos: PagoMovil[], stores: Store[], user: UserType, onBack: () => void, onRefresh: () => void }) {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    tiendaId: user.assignedStores[0] || '',
    montoBs: 0,
    referencia: '',
    banco: '',
    titular: ''
  });

  const availableStores = user.role === 'Administrador' ? stores : stores.filter(s => user.assignedStores.includes(s.id));
  const canVerify = ['Administrador', 'Verificador de Pagos', 'Contabilidad'].includes(user.role);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/pagos-movil', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, usuario: user.email }),
      });
      if (response.ok) {
        alert('Pago registrado con éxito');
        setShowForm(false);
        onRefresh();
      } else {
        const data = await response.json();
        alert(data.error || 'Error al registrar pago');
      }
    } catch (e) {
      alert('Error al conectar con el servidor');
    }
  };

  const handleVerify = async (referencia: string, verificado: boolean) => {
    try {
      const response = await fetch('/api/verificar-pago', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ referencia, verificado }),
      });
      if (response.ok) {
        onRefresh();
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
          {['Administrador', 'Gerente de Tienda', 'Verificador de Pagos'].includes(user.role) && (
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
                <button type="submit" className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-bold">Registrar</button>
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
            {pagos.length === 0 ? (
              <tr><td colSpan={8} className="px-6 py-8 text-center text-stone-400">No hay pagos registrados</td></tr>
            ) : (
              pagos.map((p, i) => {
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
