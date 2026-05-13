import React, { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, query, orderBy, doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Member, Saving, Loan } from '../types';
import { Plus, Search, MoreHorizontal, UserPlus, Phone, MapPin, Loader2, CheckCircle, XCircle, UserCheck, UserMinus, ChevronDown, ChevronUp, Wallet, ArrowDownCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import AlertModal from '../components/AlertModal';

export default function Members() {
  const [members, setMembers] = useState<Member[]>([]);
  const [savings, setSavings] = useState<Saving[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [processing, setProcessing] = useState<string | null>(null);
  const [alertConfig, setAlertConfig] = useState({ show: false, title: '', message: '', type: 'success' as any });

  const showAlert = (title: string, message: string, type: any = 'success') => {
    setAlertConfig({ show: true, title, message, type });
  };

  const [newMember, setNewMember] = useState<Partial<Member>>({
    name: '',
    address: '',
    phone: '',
    cardNumber: '',
    birthDate: '',
    email: '',
    password: '12345',
    status: 'active'
  });

  useEffect(() => {
    fetchMembers();
  }, []);

  const fetchMembers = async () => {
    setLoading(true);
    try {
      const [membersSnap, savingsSnap, loansSnap] = await Promise.all([
        getDocs(query(collection(db, 'members'), orderBy('name', 'asc'))),
        getDocs(collection(db, 'savings')),
        getDocs(collection(db, 'loans'))
      ]);
      
      setMembers(membersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Member)));
      setSavings(savingsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Saving)));
      setLoans(loansSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Loan)));
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const docData = {
        ...newMember,
        joinDate: new Date().toISOString(),
      };
      await addDoc(collection(db, 'members'), docData);
      setShowAddModal(false);
      showAlert("Berhasil", "Anggota baru telah berhasil ditambahkan ke sistem.", "success");
      setNewMember({ 
        name: '', 
        address: '', 
        phone: '', 
        cardNumber: '',
        birthDate: '',
        email: '',
        password: '12345',
        status: 'active' 
      });
      fetchMembers();
    } catch (error) {
      showAlert("Kesalahan", "Gagal menambahkan anggota baru", "error");
    } finally {
      setLoading(false);
    }
  };

  const toggleStatus = async (memberId: string, currentStatus: string) => {
    setProcessing(memberId);
    try {
      const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
      await updateDoc(doc(db, 'members', memberId), { status: newStatus });
      fetchMembers();
      showAlert("Berhasil", `Status anggota berhasil diubah menjadi ${newStatus}.`, "success");
    } catch (error) {
      showAlert("Kesalahan", "Gagal mengubah status anggota: " + (error instanceof Error ? error.message : "Error"), "error");
    } finally {
      setProcessing(null);
    }
  };

  const filteredMembers = members.filter(m => {
    const matchesSearch = m.name.toLowerCase().includes(search.toLowerCase()) || m.phone?.includes(search);
    const matchesStatus = statusFilter === 'all' || m.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <span className="font-serif italic text-sm opacity-50 block mb-1">Manajemen Data</span>
          <h1 className="text-3xl sm:text-4xl font-serif italic tracking-tight">Database Anggota</h1>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="w-full sm:w-auto flex items-center justify-center gap-2 bg-[#141414] text-[#E4E3E0] px-6 py-3 rounded-full font-mono text-[10px] tracking-widest hover:scale-105 transition-all shadow-lg"
        >
          <UserPlus size={16} />
          TAMBAH ANGGOTA
        </button>
      </header>

      {/* Toolbar */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
          <input 
            type="text" 
            placeholder="Cari nama atau nomor telepon..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white border border-[#141414] rounded-xl py-3 pl-12 pr-4 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-[#141414]"
          />
        </div>
        <div className="flex border border-[#141414] bg-white rounded-xl overflow-hidden font-mono text-[10px]">
          <button 
            onClick={() => setStatusFilter('all')}
            className={`flex-1 px-4 sm:px-6 py-3 transition-colors ${statusFilter === 'all' ? 'bg-[#141414] text-white' : 'hover:bg-stone-50'}`}
          >
            SEMUA
          </button>
          <button 
            onClick={() => setStatusFilter('active')}
            className={`flex-1 px-4 sm:px-6 py-3 border-l border-[#141414] transition-colors ${statusFilter === 'active' ? 'bg-[#141414] text-white' : 'hover:bg-stone-50'}`}
          >
            AKTIF
          </button>
          <button 
            onClick={() => setStatusFilter('inactive')}
            className={`flex-1 px-4 sm:px-6 py-3 border-l border-[#141414] transition-colors ${statusFilter === 'inactive' ? 'bg-[#141414] text-white' : 'hover:bg-stone-50'}`}
          >
            NON
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-[#141414] rounded-xl overflow-hidden shadow-sm overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[600px]">
          <thead>
            <tr className="border-b border-[#141414] bg-stone-50 font-serif italic text-xs opacity-50">
              <th className="p-4 font-normal">NAMA ANGGOTA</th>
              <th className="p-4 font-normal">SIMPANAN & HUTANG</th>
              <th className="p-4 font-normal text-center">STATUS</th>
              <th className="p-4 font-normal text-right">AKSI</th>
            </tr>
          </thead>
          <tbody className="font-mono text-xs divide-y divide-stone-100">
            {loading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td colSpan={4} className="p-4 h-12 bg-stone-50/50" />
                </tr>
              ))
            ) : filteredMembers.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-12 text-center text-stone-400 italic">Data anggota tidak ditemukan</td>
              </tr>
            ) : (
              filteredMembers.map((member) => {
                const memberSavings = savings.filter(s => s.memberId === member.id);
                const memberLoans = loans.filter(l => l.memberId === member.id);
                
                const totalSaving = memberSavings.reduce((acc, s) => acc + s.amount, 0);
                const totalDebt = memberLoans
                  .filter(l => l.status === 'active')
                  .reduce((acc, l) => acc + (l.remainingAmount ?? l.totalPayable), 0);

                return (
                  <React.Fragment key={member.id}>
                    <tr className={`hover:bg-stone-50 group cursor-pointer ${expandedId === member.id ? 'bg-stone-50' : ''}`} onClick={() => setExpandedId(expandedId === member.id ? null : member.id)}>
                      <td className="p-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-[#141414] text-sm font-sans">{member.name}</span>
                          <span className="text-[10px] opacity-40 uppercase">ID: {member.id?.slice(0, 8)}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex gap-6">
                          <div className="flex flex-col">
                            <span className="text-[8px] opacity-40 uppercase">Total Simpanan</span>
                            <span className="text-green-600 font-bold">Rp {totalSaving.toLocaleString()}</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[8px] opacity-40 uppercase">Total Hutang</span>
                            <span className="text-red-500 font-bold">Rp {totalDebt.toLocaleString()}</span>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase ${
                          member.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {member.status === 'active' ? <CheckCircle size={10} /> : <XCircle size={10} />}
                          {member.status === 'active' ? 'Aktif' : 'Nonaktif'}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex justify-end gap-2" onClick={e => e.stopPropagation()}>
                          <button 
                            disabled={!!processing}
                            onClick={() => toggleStatus(member.id!, member.status)}
                            className={`p-2 rounded-lg transition-all border ${
                              member.status === 'active' 
                              ? 'text-red-500 hover:bg-red-50 border-transparent hover:border-red-100' 
                              : 'text-green-500 hover:bg-green-50 border-transparent hover:border-green-100'
                            } disabled:opacity-50`}
                          >
                            {processing === member.id ? <Loader2 size={16} className="animate-spin" /> : (
                              member.status === 'active' ? <UserMinus size={16} /> : <UserCheck size={16} />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                    <AnimatePresence>
                      {expandedId === member.id && (
                        <tr>
                          <td colSpan={4} className="p-0 bg-stone-50 border-b border-[#141414]/5">
                            <motion.div 
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="p-4 sm:p-8 grid grid-cols-1 sm:grid-cols-2 gap-8 border-t border-[#141414]/5">
                                {/* Savings Breakdown */}
                                <div className="space-y-4">
                                  <h4 className="font-serif italic text-sm border-b border-[#141414] pb-2">Rincian Tabungan</h4>
                                  <div className="space-y-2 font-mono text-[10px]">
                                    <div className="flex justify-between">
                                      <span className="opacity-50">POKOK</span>
                                      <span>Rp {memberSavings.filter(s => s.type === 'pokok').reduce((a, b) => a + b.amount, 0).toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="opacity-50">WAJIB</span>
                                      <span>Rp {memberSavings.filter(s => s.type === 'wajib').reduce((a, b) => a + b.amount, 0).toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="opacity-50">SUKARELA</span>
                                      <span>Rp {memberSavings.filter(s => s.type === 'sukarela').reduce((a, b) => a + b.amount, 0).toLocaleString()}</span>
                                    </div>
                                  </div>
                                </div>
                                {/* Loans Breakdown */}
                                <div className="space-y-4">
                                  <h4 className="font-serif italic text-sm border-b border-[#141414] pb-2">Rincian Hutang Aktif</h4>
                                  <div className="space-y-2 font-mono text-[10px]">
                                    <div className="flex justify-between">
                                      <span className="opacity-50">PINJAMAN TUNAI</span>
                                      <span>Rp {memberLoans.filter(l => l.type === 'cash' && l.status === 'active').reduce((a, b) => a + (b.remainingAmount ?? b.totalPayable), 0).toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="opacity-50">KREDIT BARANG</span>
                                      <span>Rp {memberLoans.filter(l => l.type === 'goods' && l.status === 'active').reduce((a, b) => a + (b.remainingAmount ?? b.totalPayable), 0).toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between pt-2 border-t border-[#141414]/10 text-xs font-bold text-red-600">
                                      <span className="font-serif italic">Total Hutang</span>
                                      <span>Rp {totalDebt.toLocaleString()}</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          </td>
                        </tr>
                      )}
                    </AnimatePresence>
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Add Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-[#141414]/40 backdrop-blur-sm"
              onClick={() => setShowAddModal(false)}
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-[#E4E3E0] max-w-lg w-full rounded-2xl shadow-2xl border border-[#141414] overflow-hidden relative z-10"
            >
              <div className="p-8 border-b border-[#141414] bg-white">
                <h2 className="font-serif italic text-2xl">Registrasi Anggota Baru</h2>
                <p className="text-[10px] font-mono opacity-50 uppercase mt-1 tracking-widest">Silahkan lengkapi data administratif dibawah ini</p>
              </div>
              <form onSubmit={handleAddMember} className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-mono uppercase tracking-widest opacity-60">Nama Lengkap</label>
                  <input 
                    required
                    type="text" 
                    value={newMember.name}
                    onChange={e => setNewMember({...newMember, name: e.target.value})}
                    className="w-full bg-white border border-[#141414] rounded-xl px-4 py-3 font-sans focus:outline-none focus:ring-1 focus:ring-[#141414]"
                    placeholder="Contoh: Ahmad Sulaiman"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-mono uppercase tracking-widest opacity-60">Nomor Telepon</label>
                    <input 
                      type="text" 
                      value={newMember.phone}
                      onChange={e => setNewMember({...newMember, phone: e.target.value})}
                      className="w-full bg-white border border-[#141414] rounded-xl px-4 py-3 font-mono text-sm focus:outline-none focus:ring-1 focus:ring-[#141414]"
                      placeholder="0812XXX"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-mono uppercase tracking-widest opacity-60">No. Kartu Anggota</label>
                    <input 
                      required
                      type="text" 
                      value={newMember.cardNumber}
                      onChange={e => setNewMember({...newMember, cardNumber: e.target.value})}
                      className="w-full bg-white border border-[#141414] rounded-xl px-4 py-3 font-mono text-sm focus:outline-none focus:ring-1 focus:ring-[#141414]"
                      placeholder="Kartu Anggota"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-mono uppercase tracking-widest opacity-60">Email</label>
                    <input 
                      type="email" 
                      value={newMember.email}
                      onChange={e => setNewMember({...newMember, email: e.target.value})}
                      className="w-full bg-white border border-[#141414] rounded-xl px-4 py-3 font-mono text-sm focus:outline-none focus:ring-1 focus:ring-[#141414]"
                      placeholder="email@contoh.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-mono uppercase tracking-widest opacity-60">Tanggal Lahir</label>
                    <input 
                      type="date" 
                      value={newMember.birthDate}
                      onChange={e => setNewMember({...newMember, birthDate: e.target.value})}
                      className="w-full bg-white border border-[#141414] rounded-xl px-4 py-3 font-mono text-sm focus:outline-none focus:ring-1 focus:ring-[#141414]"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-mono uppercase tracking-widest opacity-60">Alamat Rumah</label>
                  <textarea 
                    value={newMember.address}
                    onChange={e => setNewMember({...newMember, address: e.target.value})}
                    className="w-full bg-white border border-[#141414] rounded-xl px-4 py-3 font-sans h-24 focus:outline-none focus:ring-1 focus:ring-[#141414] resize-none"
                    placeholder="Dusun Sidoharjo RT 01/RW 02..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-mono uppercase tracking-widest opacity-60">Password Login</label>
                    <input 
                      type="text" 
                      value={newMember.password}
                      onChange={e => setNewMember({...newMember, password: e.target.value})}
                      className="w-full bg-white border border-[#141414] rounded-xl px-4 py-3 font-mono text-sm focus:outline-none focus:ring-1 focus:ring-[#141414]"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-mono uppercase tracking-widest opacity-60">Status Awal</label>
                    <select 
                      value={newMember.status}
                      onChange={e => setNewMember({...newMember, status: e.target.value as any})}
                      className="w-full bg-white border border-[#141414] rounded-xl px-4 py-3 font-mono text-sm focus:outline-none focus:ring-1 focus:ring-[#141414]"
                    >
                      <option value="active">AKTIF</option>
                      <option value="inactive">NONAKTIF</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-4 pt-4">
                  <button 
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 py-4 border border-[#141414] rounded-xl font-mono text-[10px] tracking-widest hover:bg-stone-200 transition-all"
                  >
                    BATALKAN
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 py-4 bg-[#141414] text-[#E4E3E0] rounded-xl font-mono text-[10px] tracking-widest hover:scale-[1.02] transition-all shadow-lg"
                  >
                    SIMPAN DATA
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      
      <AlertModal 
        show={alertConfig.show} 
        title={alertConfig.title} 
        message={alertConfig.message} 
        type={alertConfig.type} 
        onClose={() => setAlertConfig({...alertConfig, show: false})} 
      />
    </div>
  );
}
