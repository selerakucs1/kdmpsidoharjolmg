import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where, orderBy, doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Member, Saving, Loan } from '../types';
import { User, Wallet, Landmark, History, Save, Loader2, MapPin, Phone, Calendar, Mail, CreditCard, DollarSign } from 'lucide-react';
import { motion } from 'motion/react';

export default function MemberPortal({ member }: { member: Member | null }) {
  const [profile, setProfile] = useState<Member | null>(member);
  const [savings, setSavings] = useState<Saving[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (member?.id) {
      fetchMemberData();
    }
  }, [member?.id]);

  const fetchMemberData = async () => {
    if (!member?.id) return;
    setLoading(true);
    try {
      const [savingsSnap, loansSnap, repaymentsSnap, transSnap] = await Promise.all([
        getDocs(query(collection(db, 'savings'), where('memberId', '==', member.id))),
        getDocs(query(collection(db, 'loans'), where('memberId', '==', member.id))),
        getDocs(query(collection(db, 'repayments'), where('memberId', '==', member.id))),
        getDocs(query(collection(db, 'transactions'), where('memberId', '==', member.id)))
      ]);

      const sData = savingsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Saving));
      const lData = loansSnap.docs.map(d => ({ id: d.id, ...d.data() } as Loan));
      
      const reps = repaymentsSnap.docs.map(d => ({ id: d.id, ...d.data(), activityType: 'repayment' }));
      const trans = transSnap.docs.map(d => ({ id: d.id, ...d.data(), activityType: 'purchase' }));
      const svs = sData.map(d => ({ ...d, activityType: 'saving' }));
      const lns = lData.map(d => ({ ...d, activityType: 'loan' }));

      setSavings(sData);
      setLoans(lData);
      
      const combined = [...reps, ...trans, ...svs, ...lns].sort((a: any, b: any) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      setActivities(combined);
    } catch (error) {
      console.error("Error fetching member portal data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.id) return;
    setSaving(true);
    try {
      const { name, cardNumber, id, ...updateData } = profile;
      await updateDoc(doc(db, 'members', profile.id), updateData);
      alert("Profil berhasil diperbarui");
    } catch (error) {
      alert("Gagal memperbarui profil");
    } finally {
      setSaving(false);
    }
  };

  if (!member) return <div className="p-8 text-center text-stone-500 font-serif italic">Data anggota tidak ditemukan. Silakan login kembali.</div>;
  if (loading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-stone-400" /></div>;

  const totalSaving = savings.reduce((acc, s) => acc + s.amount, 0);
  const totalDebt = loans.filter(l => l.status === 'active').reduce((acc, l) => acc + (l.remainingAmount ?? l.totalPayable), 0);

  if (!profile) return null;

  return (
    <div className="p-4 sm:p-8 space-y-8 max-w-6xl mx-auto">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-serif italic tracking-tight">{member.name}</h1>
          <p className="text-[10px] font-mono opacity-60 uppercase mt-1">NO. KARTU: {member.cardNumber}</p>
        </div>
      </header>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="bg-[#141414] text-[#E4E3E0] p-8 rounded-3xl shadow-xl space-y-6"
        >
          <div className="flex justify-between items-start">
            <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center">
              <Wallet className="text-green-400" />
            </div>
            <span className="font-mono text-[10px] opacity-40 uppercase">Total Tabungan</span>
          </div>
          <div>
            <h2 className="text-4xl font-mono tracking-tighter">Rp {totalSaving.toLocaleString()}</h2>
            <div className="mt-4 grid grid-cols-3 gap-2 text-[8px] font-mono opacity-50">
              <div className="flex flex-col">
                <span>POKOK</span>
                <span className="text-white">Rp {savings.filter(s => s.type === 'pokok').reduce((a, b) => a + b.amount, 0).toLocaleString()}</span>
              </div>
              <div className="flex flex-col">
                <span>WAJIB</span>
                <span className="text-white">Rp {savings.filter(s => s.type === 'wajib').reduce((a, b) => a + b.amount, 0).toLocaleString()}</span>
              </div>
              <div className="flex flex-col">
                <span>SUKARELA</span>
                <span className="text-white">Rp {savings.filter(s => s.type === 'sukarela').reduce((a, b) => a + b.amount, 0).toLocaleString()}</span>
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="bg-white border-2 border-[#141414] p-8 rounded-3xl shadow-lg space-y-6"
        >
          <div className="flex justify-between items-start">
            <div className="w-12 h-12 bg-stone-100 rounded-2xl flex items-center justify-center">
              <CreditCard className="text-red-500" />
            </div>
            <span className="font-mono text-[10px] opacity-40 uppercase">Total Kewajiban (Hutang)</span>
          </div>
          <div>
            <h2 className="text-4xl font-mono tracking-tighter text-red-600">Rp {totalDebt.toLocaleString()}</h2>
            <div className="mt-4 flex flex-wrap gap-4">
              {loans.filter(l => l.status === 'active').map(l => (
                <div key={l.id} className="flex flex-col font-mono text-[8px] bg-stone-50 p-2 rounded border border-stone-200">
                   <span className="opacity-50 uppercase">{l.type === 'cash' ? 'Pinjaman Tunai' : 'Kredit Barang'}</span>
                   <span className="text-stone-900 font-bold">Sisa: Rp {(l.remainingAmount ?? l.totalPayable).toLocaleString()}</span>
                </div>
              ))}
              {loans.filter(l => l.status === 'active').length === 0 && (
                <span className="font-serif italic text-xs text-stone-400">Tidak ada pinjaman aktif</span>
              )}
            </div>
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Profile Update */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white border border-[#141414] p-8 rounded-3xl shadow-sm">
            <h3 className="font-serif italic text-xl mb-6 flex items-center gap-2">
              <User size={20} />
              Update Profil
            </h3>
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-mono uppercase opacity-50">Nama Lengkap (Terkunci)</label>
                <input disabled value={profile.name} className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 font-sans text-sm opacity-60 cursor-not-allowed" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-mono uppercase opacity-50">No. Kartu (Terkunci)</label>
                <input disabled value={profile.cardNumber} className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 font-mono text-sm opacity-60 cursor-not-allowed" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-mono uppercase opacity-50">Nomor HP</label>
                <input 
                  type="text" 
                  value={profile.phone || ''} 
                  onChange={e => setProfile({...profile, phone: e.target.value})}
                  className="w-full border border-[#141414]/20 rounded-xl p-3 font-mono text-sm focus:border-[#141414] outline-none" 
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-mono uppercase opacity-50">Email</label>
                <input 
                  type="email" 
                  value={profile.email || ''} 
                  onChange={e => setProfile({...profile, email: e.target.value})}
                  className="w-full border border-[#141414]/20 rounded-xl p-3 font-mono text-sm focus:border-[#141414] outline-none" 
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-mono uppercase opacity-50">Tanggal Lahir</label>
                <input 
                  type="date" 
                  value={profile.birthDate || ''} 
                  onChange={e => setProfile({...profile, birthDate: e.target.value})}
                  className="w-full border border-[#141414]/20 rounded-xl p-3 font-mono text-sm focus:border-[#141414] outline-none" 
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-mono uppercase opacity-50">Alamat</label>
                <textarea 
                  value={profile.address || ''} 
                  onChange={e => setProfile({...profile, address: e.target.value})}
                  className="w-full border border-[#141414]/20 rounded-xl p-3 font-sans text-sm h-24 resize-none focus:border-[#141414] outline-none" 
                />
              </div>
              <button 
                disabled={saving}
                type="submit" 
                className="w-full bg-[#141414] text-white py-4 rounded-xl font-mono text-[10px] tracking-widest hover:scale-[1.02] transition-all flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 className="animate-spin" size={14} /> : <><Save size={14} /> SIMPAN PERUBAHAN</>}
              </button>
            </form>
          </div>
        </div>

        {/* Activities */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-[#141414] rounded-3xl shadow-sm overflow-hidden flex flex-col h-full">
            <div className="p-8 border-b border-[#141414] flex justify-between items-center">
              <h3 className="font-serif italic text-xl flex items-center gap-2">
                <History size={20} />
                Riwayat Transaksi
              </h3>
              <span className="font-mono text-[10px] opacity-40 uppercase tracking-widest">{activities.length} Aktivitas</span>
            </div>
            <div className="flex-1 overflow-auto p-4 sm:p-8 space-y-4 no-scrollbar max-h-[700px]">
              {activities.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-stone-300">
                  <History size={40} strokeWidth={1} />
                  <p className="font-serif italic text-lg mt-2">Belum ada riwayat</p>
                </div>
              ) : (
                activities.map((act, idx) => (
                  <div key={idx} className="flex gap-4 p-4 hover:bg-stone-50 transition-colors border-b border-stone-100 last:border-0 rounded-xl">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                      act.activityType === 'saving' ? 'bg-green-100 text-green-600' :
                      act.activityType === 'repayment' ? 'bg-blue-100 text-blue-600' :
                      act.activityType === 'loan' ? 'bg-amber-100 text-amber-600' :
                      'bg-orange-100 text-orange-600'
                    }`}>
                      {act.activityType === 'saving' ? <Landmark size={18} /> : 
                       act.activityType === 'repayment' ? <Wallet size={18} /> : 
                       act.activityType === 'loan' ? <DollarSign size={18} /> :
                       <CreditCard size={18} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start mb-1">
                        <h4 className="text-sm font-bold capitalize">
                          {act.activityType === 'saving' ? `Setoran Tabungan ${act.type}` : 
                           act.activityType === 'repayment' ? `Angsuran ${act.type === 'cash' ? 'Tunai' : 'Barang'} ${act.installmentNumber ? `#${act.installmentNumber}/${act.totalInstallments || '?'}` : ''}` : 
                           act.activityType === 'loan' ? `Pencairan Pinjaman ${act.type === 'cash' ? 'Tunai' : 'Barang'}` :
                           act.paymentMethod === 'credit' ? 'Belanja Kredit (Piutang)' : 'Belanja Tunai'}
                        </h4>
                        <span className={`text-sm font-mono font-bold ${
                          act.activityType === 'saving' || act.activityType === 'repayment' ? 'text-green-600' : 
                          act.activityType === 'loan' ? 'text-blue-600' : 'text-red-600'
                        }`}>
                          {act.activityType === 'saving' || act.activityType === 'repayment' || act.activityType === 'loan' ? '+' : '-'} Rp {(act.amount || act.totalAmount || 0).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <div className="flex flex-wrap gap-4 text-[10px] font-mono opacity-50 uppercase font-bold">
                          <span className="flex items-center gap-1"><Calendar size={10} /> {new Date(act.date).toLocaleDateString('id-ID')}</span>
                          {act.status && <span className="text-green-600 border border-green-200 px-1 rounded">{act.status}</span>}
                        </div>
                        {act.notes && <p className="text-[10px] font-sans italic opacity-70">Ket: {act.notes}</p>}
                        {act.items && (
                          <div className="mt-1 p-2 bg-stone-50 rounded border border-stone-100">
                             <p className="text-[9px] font-mono opacity-40 uppercase mb-1">Detail Item</p>
                             <div className="space-y-1">
                               {act.items.map((i: any, iidx: number) => (
                                 <div key={iidx} className="flex justify-between text-[10px]">
                                   <span className="opacity-70">{i.name} x{i.qty}</span>
                                   <span className="font-mono">Rp {(i.price * i.qty).toLocaleString()}</span>
                                 </div>
                               ))}
                             </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
