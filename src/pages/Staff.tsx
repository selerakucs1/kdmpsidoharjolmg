import React, { useState, useEffect } from 'react';
import { collection, getDocs, updateDoc, doc, query, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { UserCheck, UserX, Shield, ShieldAlert, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';

interface Profile {
  uid: string;
  name: string;
  email: string;
  role: 'admin' | 'staff' | 'pending';
  createdAt: string;
}

export default function Staff() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    fetchProfiles();
  }, []);

  const fetchProfiles = async () => {
    try {
      const snap = await getDocs(query(collection(db, 'profiles'), orderBy('createdAt', 'desc')));
      setProfiles(snap.docs.map(d => d.data() as Profile));
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const updateRole = async (uid: string, newRole: 'staff' | 'pending') => {
    setProcessing(uid);
    try {
      await updateDoc(doc(db, 'profiles', uid), { role: newRole });
      fetchProfiles();
    } catch (error) {
      alert("Gagal memperbarui peran");
    } finally {
      setProcessing(null);
    }
  };

  if (loading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-stone-400" /></div>;

  return (
    <div className="p-8 space-y-8">
      <header>
        <span className="font-serif italic text-sm opacity-50 block mb-1">Pengaturan Sistem</span>
        <h1 className="text-4xl font-serif italic tracking-tight">Manajemen Staf</h1>
        <p className="text-sm font-sans opacity-60 mt-2">Kelola siapa saja yang memiliki akses untuk menginput data ke sistem.</p>
      </header>

      <div className="bg-white border border-[#141414] rounded-2xl shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead className="bg-[#141414] text-white font-mono text-[10px] tracking-widest uppercase">
            <tr>
              <th className="p-4">Staff Member</th>
              <th className="p-4">Email</th>
              <th className="p-4">Role</th>
              <th className="p-4">Status</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#141414]/10">
            {profiles.map(p => (
              <tr key={p.uid} className="hover:bg-stone-50 transition-colors">
                <td className="p-4">
                  <div className="font-medium">{p.name || 'Unknown'}</div>
                  <div className="text-[10px] font-mono opacity-40">{p.uid}</div>
                </td>
                <td className="p-4 font-mono text-xs">{p.email}</td>
                <td className="p-4">
                  <span className={`px-2 py-0.5 rounded-full border text-[10px] font-mono ${
                    p.role === 'admin' ? 'bg-purple-50 text-purple-600 border-purple-200' :
                    p.role === 'staff' ? 'bg-blue-50 text-blue-600 border-blue-200' :
                    'bg-amber-50 text-amber-600 border-amber-200'
                  }`}>
                    {p.role.toUpperCase()}
                  </span>
                </td>
                <td className="p-4">
                    {p.role === 'pending' ? (
                        <span className="flex items-center gap-1 text-[10px] text-amber-600 font-mono">
                            <ShieldAlert size={12} /> MENUNGGU PERSETUJUAN
                        </span>
                    ) : (
                        <span className="flex items-center gap-1 text-[10px] text-green-600 font-mono">
                            <Shield size={12} /> AKTIF
                        </span>
                    )}
                </td>
                <td className="p-4 text-right">
                  {p.role !== 'admin' && (
                    <div className="flex justify-end gap-2">
                       {p.role === 'pending' ? (
                           <button 
                             disabled={!!processing}
                             onClick={() => updateRole(p.uid, 'staff')}
                             className="flex items-center gap-2 bg-stone-900 text-white px-4 py-2 rounded-lg text-[10px] font-mono hover:bg-stone-800 disabled:opacity-50"
                           >
                            {processing === p.uid ? <Loader2 className="animate-spin" size={12} /> : <UserCheck size={12} />}
                            SETUJUI AKSES
                           </button>
                       ) : (
                           <button 
                             disabled={!!processing}
                             onClick={() => updateRole(p.uid, 'pending')}
                             className="flex items-center gap-2 border border-red-200 text-red-600 px-4 py-2 rounded-lg text-[10px] font-mono hover:bg-red-50 disabled:opacity-50"
                           >
                            {processing === p.uid ? <Loader2 className="animate-spin" size={12} /> : <UserX size={12} />}
                            CABUT AKSES
                           </button>
                       )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
