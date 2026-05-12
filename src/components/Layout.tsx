import { ReactNode, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { User } from 'firebase/auth';
import { 
  LayoutDashboard, 
  Users, 
  Package, 
  Wallet, 
  History, 
  LogOut,
  ChevronRight,
  ShoppingCart,
  Settings,
  Menu,
  X
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { AnimatePresence, motion } from 'motion/react';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface LayoutProps {
  children: ReactNode;
  user: User;
  userRole?: string;
  onLogout: () => void;
}

export default function Layout({ children, user, userRole, onLogout }: LayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const navItems = userRole === 'member' 
    ? [{ to: '/portal', label: 'Monitor Portal', icon: LayoutDashboard }]
    : [
        { to: '/', label: 'Overview', icon: LayoutDashboard },
        { to: '/pos', label: 'Penjualan', icon: ShoppingCart },
        { to: '/members', label: 'Anggota', icon: Users },
        { to: '/inventory', label: 'Stok', icon: Package },
        { to: '/financials', label: 'Simpan Pinjam', icon: Wallet },
        { to: '/transactions', label: 'Log Transaksi', icon: History },
      ];

  if ((userRole === 'admin' || user?.email === 'seleraku.cs1@gmail.com') && userRole !== 'member') {
    navItems.push({ to: '/staff', label: 'Kelola Staf', icon: Settings });
  }

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  return (
    <div className="flex h-screen bg-[#E4E3E0] text-[#141414] font-sans overflow-hidden">
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-[#E4E3E0] border-b border-[#141414] flex items-center justify-between px-4 z-40">
        <div className="flex items-center gap-2">
          <h1 className="font-serif italic text-xl">Sidoharjo</h1>
          <span className="text-[8px] bg-[#141414] text-white px-1 rounded">PRO</span>
        </div>
        <button onClick={toggleSidebar} className="p-2 border border-[#141414] rounded-lg">
          {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-[#141414]/40 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-[#E4E3E0] border-r border-[#141414] flex flex-col transition-transform duration-300 lg:relative lg:translate-x-0",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-8 border-bottom border-[#141414]">
          <h1 className="font-serif italic text-2xl tracking-tight">Sidoharjo</h1>
          <p className="text-[10px] uppercase font-mono mt-1 opacity-50 tracking-widest text-[#141414]">KDMP Management v1.0</p>
        </div>

        <nav className="flex-1 px-4 py-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setIsSidebarOpen(false)}
              className={({ isActive }) => cn(
                "flex items-center justify-between p-3 rounded-lg transition-all duration-200 group font-mono text-sm",
                isActive 
                  ? "bg-[#141414] text-[#E4E3E0]" 
                  : "hover:bg-[#d4d3d0] text-[#141414]/70 hover:text-[#141414]"
              )}
            >
              <div className="flex items-center gap-3">
                <item.icon size={18} />
                <span>{item.label}</span>
              </div>
              <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity lg:block hidden" />
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-[#141414] space-y-4">
          <div className="flex items-center gap-3 px-3">
            {user?.photoURL ? (
              <img src={user.photoURL} alt={user.displayName || (user as any).name || ''} className="w-8 h-8 rounded-full border border-[#141414]" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-[#141414] text-[#E4E3E0] flex items-center justify-center text-xs font-mono">
                {user?.displayName?.[0] || (user as any).name?.[0] || 'U'}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-mono truncate font-bold">{user?.displayName || (user as any).name}</p>
              <p className="text-[9px] font-mono opacity-50 truncate select-all" title="Klik untuk menyalin">ID: {user?.uid || (user as any).id?.slice(0,8)}</p>
              <p className={cn(
                "text-[9px] font-mono uppercase mt-1",
                userRole === 'member' ? "text-blue-600" : "text-green-600"
              )}>{userRole === 'member' ? 'Anggota Koperasi' : 'Staff Administrasi'}</p>
            </div>
          </div>
          <button 
            onClick={onLogout}
            className="w-full flex items-center gap-3 p-3 text-sm font-mono hover:bg-[#141414] hover:text-[#E4E3E0] rounded-lg transition-all cursor-pointer"
          >
            <LogOut size={18} />
            <span>Keluar Sistem</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto pt-16 lg:pt-0">
        <AnimatePresence mode="wait">
          <div className="min-h-full">
            {children}
          </div>
        </AnimatePresence>
      </main>
    </div>
  );
}
