/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, login, logout, db } from './lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Members from './pages/Members';
import Inventory from './pages/Inventory';
import Financials from './pages/Financials';
import Transactions from './pages/Transactions';
import POS from './pages/POS';
import Staff from './pages/Staff';
import { LogIn, Loader2, ShoppingCart } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <Loader2 className="w-8 h-8 animate-spin text-stone-400" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50 p-4">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-sm border border-stone-200 p-8 text-center">
          <div className="mb-6">
            <div className="w-16 h-16 bg-stone-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl font-serif italic">S</span>
            </div>
            <h1 className="text-2xl font-serif italic text-stone-900 mb-2">KDMP Sidoharjo</h1>
            <p className="text-stone-500 text-sm">Koperasi Desa Mandiri Pangan Kelurahan Sidoharjo, Lamongan</p>
          </div>
          <button
            onClick={login}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-stone-900 text-white rounded-xl hover:bg-stone-800 transition-colors"
          >
            <LogIn size={18} />
            Masuk dengan Google
          </button>
          <div className="mt-8 pt-6 border-t border-stone-100 text-[10px] uppercase tracking-widest text-stone-400">
            Internal Access Only
          </div>
        </div>
      </div>
    );
  }

  const isAuthorized = profile?.role === 'admin' || profile?.role === 'staff' || user.email === 'seleraku.cs1@gmail.com';
  const effectiveRole = user.email === 'seleraku.cs1@gmail.com' ? 'admin' : profile?.role;

  if (!isAuthorized) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-[#E4E3E0] p-8">
        <div className="max-w-md w-full bg-white border border-[#141414] p-12 text-center space-y-6 rounded-2xl shadow-xl">
          <div className="w-20 h-20 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto border border-amber-200">
            <Loader2 className="animate-spin" size={40} />
          </div>
          <div className="space-y-2">
            <h1 className="font-serif italic text-3xl">Akses Ditangguhkan</h1>
            <p className="text-sm font-sans opacity-60">Akun Anda sedang dalam antrian verifikasi. Silakan hubungi Admin Utama untuk mendapatkan izin akses input data.</p>
          </div>
          <div className="pt-6 border-t border-[#141414]/10">
            <p className="text-[10px] font-mono uppercase opacity-40 mb-2">ID IDENTITAS ANDA</p>
            <p className="text-xs font-mono bg-stone-50 p-3 rounded-lg select-all">{user.uid}</p>
          </div>
          <button 
            onClick={logout}
            className="w-full py-4 border border-[#141414] rounded-xl font-mono text-[10px] tracking-widest hover:bg-[#141414] hover:text-white transition-all"
          >
            KELUAR AKUN
          </button>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Layout user={user} onLogout={logout} userRole={effectiveRole}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/pos" element={<POS />} />
          <Route path="/members" element={<Members />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/financials" element={<Financials />} />
          <Route path="/transactions" element={<Transactions />} />
          <Route path="/staff" element={<Staff />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

