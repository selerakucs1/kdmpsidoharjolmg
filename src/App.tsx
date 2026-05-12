/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, login, logout, db } from './lib/firebase';
import { doc, getDoc, setDoc, query, collection, where, getDocs } from 'firebase/firestore';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Members from './pages/Members';
import Inventory from './pages/Inventory';
import Financials from './pages/Financials';
import Transactions from './pages/Transactions';
import POS from './pages/POS';
import Staff from './pages/Staff';
import MemberPortal from './pages/MemberPortal';
import { LogIn, Loader2, ShoppingCart, LogOut } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [memberUser, setMemberUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loginMode, setLoginMode] = useState<'staff' | 'member'>('staff');
  const [memberCreds, setMemberCreds] = useState({ card: '', pass: '' });

  useEffect(() => {
    // Check session for member
    const savedMember = localStorage.getItem('member_session');
    if (savedMember) {
      setMemberUser(JSON.parse(savedMember));
    }

    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        try {
          const profileRef = doc(db, 'profiles', u.uid);
          const profileSnap = await getDoc(profileRef);
          
          if (!profileSnap.exists()) {
            const newProfile = {
              uid: u.uid,
              name: u.displayName || 'Unknown Member',
              email: u.email || '',
              role: u.email === 'seleraku.cs1@gmail.com' ? 'admin' : 'pending',
              createdAt: new Date().toISOString()
            };
            await setDoc(profileRef, newProfile);
            setProfile(newProfile);
          } else {
            setProfile(profileSnap.data());
          }
        } catch (error) {
          console.error("Profile check error:", error);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleMemberLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const cardNum = memberCreds.card.trim();
      const q = query(collection(db, 'members'), where('cardNumber', '==', cardNum));
      const snap = await getDocs(q);
      
      if (snap.empty) {
        throw new Error("Nomor kartu tidak ditemukan di sistem");
      }
      
      const docData = snap.docs[0].data();
      if (docData.password !== memberCreds.pass) {
        throw new Error("Kata sandi salah. Silakan coba lagi.");
      }
      
      const userData = { id: snap.docs[0].id, ...docData, role: 'member' };
      setMemberUser(userData);
      localStorage.setItem('member_session', JSON.stringify(userData));
    } catch (error) {
      alert(error instanceof Error ? error.message : "Gagal masuk ke portal");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    setMemberUser(null);
    localStorage.removeItem('member_session');
  };

  const isAuthorized = memberUser || profile?.role === 'admin' || profile?.role === 'staff' || user?.email === 'seleraku.cs1@gmail.com';
  const effectiveRole = memberUser ? 'member' : (user?.email === 'seleraku.cs1@gmail.com' ? 'admin' : profile?.role);

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-stone-50">
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div 
              key="loader"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 flex items-center justify-center z-50 bg-stone-50"
            >
              <Loader2 className="w-10 h-10 animate-spin text-[#141414]" />
            </motion.div>
          ) : (!user && !memberUser) ? (
            <motion.div 
              key="login"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="fixed inset-0 flex items-center justify-center p-4 z-40 bg-[#E4E3E0]"
            >
              <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl border-2 border-[#141414] overflow-hidden text-center">
                <div className="p-8 sm:p-12">
                  <div className="w-16 h-16 bg-[#141414] rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl">
                    <span className="text-2xl font-serif italic text-white">K</span>
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-serif italic text-[#141414] mb-2 tracking-tight">Koperasi Merah Putih</h1>
                  <p className="text-stone-500 text-[10px] mb-8 uppercase tracking-widest font-mono font-bold">Portal Terpadu Kelurahan Sidoharjo</p>
                  
                  <div className="flex bg-stone-100 p-1 rounded-xl mb-8 font-mono text-[9px]">
                    <button 
                      onClick={() => setLoginMode('staff')}
                      className={`flex-1 py-3 rounded-lg transition-all duration-300 ${loginMode === 'staff' ? 'bg-[#141414] text-white shadow-lg scale-[1.02]' : 'text-stone-400 hover:text-stone-600'}`}
                    >
                      STAF / PENGURUS
                    </button>
                    <button 
                      onClick={() => setLoginMode('member')}
                      className={`flex-1 py-3 rounded-lg transition-all duration-300 ${loginMode === 'member' ? 'bg-[#141414] text-white shadow-lg scale-[1.02]' : 'text-stone-400 hover:text-stone-600'}`}
                    >
                      ANGGOTA KOPERASI
                    </button>
                  </div>

                  {loginMode === 'staff' ? (
                    <button
                      onClick={login}
                      className="w-full flex items-center justify-center gap-3 py-4 px-4 bg-[#141414] text-white rounded-xl hover:bg-stone-800 transition-all font-mono text-[10px] tracking-widest shadow-xl group"
                    >
                      <LogIn size={18} className="group-hover:translate-x-1 transition-transform" />
                      MASUK SEBAGAI PETUGAS
                    </button>
                  ) : (
                    <form onSubmit={handleMemberLogin} className="space-y-4 text-left">
                      <div className="space-y-1">
                        <label className="text-[10px] font-mono uppercase opacity-50 font-bold">No. Kartu Anggota</label>
                        <input 
                          required
                          type="text" 
                          value={memberCreds.card}
                          onChange={e => setMemberCreds({...memberCreds, card: e.target.value})}
                          className="w-full border-2 border-stone-100 rounded-xl p-4 font-mono text-sm focus:border-[#141414] outline-none transition-colors"
                          placeholder="Contoh: 3524..."
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-mono uppercase opacity-50 font-bold">Kata Sandi Personal</label>
                        <input 
                          required
                          type="password" 
                          value={memberCreds.pass}
                          onChange={e => setMemberCreds({...memberCreds, pass: e.target.value})}
                          className="w-full border-2 border-stone-100 rounded-xl p-4 font-mono text-sm focus:border-[#141414] outline-none transition-colors"
                          placeholder="••••••••"
                        />
                      </div>
                      <button
                        type="submit"
                        className="w-full py-4 bg-[#141414] text-white rounded-xl hover:bg-stone-800 transition-all font-mono text-[10px] tracking-widest shadow-xl uppercase mt-4"
                      >
                        Masuk Dashboard Anggota
                      </button>
                    </form>
                  )}
                </div>
                <div className="bg-stone-50 p-6 text-[8px] uppercase tracking-widest text-stone-400 border-t border-stone-100 font-mono font-bold">
                  Sistem Informasi Koperasi Merah Putih v2.4
                </div>
              </div>
            </motion.div>
          ) : !isAuthorized ? (
            <motion.div 
              key="unauthorized"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="fixed inset-0 flex items-center justify-center p-4 bg-stone-100 z-40"
            >
              <div className="max-w-md w-full bg-white border-2 border-[#141414] p-12 text-center space-y-6 rounded-3xl shadow-2xl">
                <div className="w-20 h-20 bg-amber-50 text-amber-600 rounded-3xl flex items-center justify-center mx-auto border-2 border-amber-200">
                  <LogOut size={40} />
                </div>
                <div className="space-y-2">
                  <h1 className="font-serif italic text-3xl text-[#141414]">Akses Ditangguhkan</h1>
                  <p className="text-sm font-sans opacity-60">Akun Anda ("{user?.email || memberUser?.name}") belum diverifikasi oleh Admin Utama.</p>
                </div>
                {user && (
                  <div className="pt-6 border-t border-stone-100">
                    <p className="text-[9px] font-mono uppercase opacity-40 mb-2">Google Unique ID</p>
                    <p className="text-xs font-mono bg-stone-50 p-4 rounded-xl select-all break-all border border-stone-200">{user.uid}</p>
                  </div>
                )}
                <button 
                  onClick={handleLogout}
                  className="w-full py-4 bg-[#141414] text-white rounded-xl font-mono text-[10px] tracking-widest hover:scale-[1.02] transition-all shadow-lg"
                >
                  KELUAR & GANTI AKUN
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="app"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="min-h-screen"
            >
              <Layout user={user || memberUser} onLogout={handleLogout} userRole={effectiveRole}>
                <Routes>
                  <Route path="/" element={effectiveRole === 'member' ? <Navigate to="/portal" replace /> : <Dashboard />} />
                  <Route 
                    path="/portal" 
                    element={effectiveRole === 'member' && memberUser ? <MemberPortal member={memberUser} /> : <Navigate to="/" replace />} 
                  />
                  <Route path="/pos" element={<POS />} />
                  <Route path="/members" element={<Members />} />
                  <Route path="/inventory" element={<Inventory />} />
                  <Route path="/financials" element={<Financials />} />
                  <Route path="/transactions" element={<Transactions />} />
                  <Route path="/staff" element={<Staff />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Layout>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </BrowserRouter>
  );
}

