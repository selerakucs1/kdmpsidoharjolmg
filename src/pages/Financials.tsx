import React, { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, query, orderBy, Timestamp, doc, runTransaction } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { Saving, Loan, Member } from '../types';
import { Wallet, Landmark, ArrowRight, Plus, Search, FileText, X, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Error Handler helper
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  alert(`Gagal: ${errInfo.error}`);
  throw new Error(JSON.stringify(errInfo));
}

export default function Financials() {
  const [activeTab, setActiveTab] = useState<'savings' | 'loans'>('savings');
  const [savings, setSavings] = useState<Saving[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [cashFlow, setCashFlow] = useState({
    debit: 0,
    credit: 0,
    balance: 0
  });
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  
  const [showAddSaving, setShowAddSaving] = useState(false);
  const [showAddLoan, setShowAddLoan] = useState(false);

  // Form states
  const [newSaving, setNewSaving] = useState<Partial<Saving>>({
    memberId: '',
    amount: 0,
    type: 'wajib'
  });

  const [newLoan, setNewLoan] = useState<Partial<Loan>>({
    memberId: '',
    amount: 0,
    durationMonths: 12,
    interest: 1.5, // 1.5% per month as default
    type: 'cash'
  });

  const getMonthlyInstallment = () => {
    if (!newLoan.amount || !newLoan.durationMonths) return 0;
    const interestPerMonth = (newLoan.amount * (newLoan.interest || 0) / 100);
    const principalPerMonth = (newLoan.amount / newLoan.durationMonths);
    return principalPerMonth + interestPerMonth;
  };

  useEffect(() => {
    fetchData();
    fetchMembers();
    calculateCashFlow();
  }, [activeTab]);

  const fetchMembers = async () => {
    const snapshot = await getDocs(query(collection(db, 'members'), orderBy('name')));
    setMembers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Member)));
  };

  const calculateCashFlow = async () => {
    try {
      const [savingsSnap, transactionsSnap, loansSnap] = await Promise.all([
        getDocs(collection(db, 'savings')),
        getDocs(collection(db, 'transactions')),
        getDocs(query(collection(db, 'loans'), orderBy('date', 'desc')))
      ]);

      const totalSavings = savingsSnap.docs.reduce((acc, doc) => acc + (doc.data().amount || 0), 0);
      const totalSales = transactionsSnap.docs
        .filter(doc => doc.data().type === 'sale')
        .reduce((acc, doc) => acc + (doc.data().totalAmount || 0), 0);
      
      const totalPurchases = transactionsSnap.docs
        .filter(doc => doc.data().type === 'purchase')
        .reduce((acc, doc) => acc + (doc.data().totalAmount || 0), 0);
      
      const totalDisbursements = loansSnap.docs
        .filter(doc => doc.data().status === 'active' || doc.data().status === 'completed')
        .reduce((acc, doc) => acc + (doc.data().amount || 0), 0);

      const debit = totalSavings + totalSales;
      const credit = totalPurchases + totalDisbursements;

      setCashFlow({
        debit,
        credit,
        balance: debit - credit
      });
    } catch (error) {
      console.error("Cash flow error:", error);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'savings') {
        const q = query(collection(db, 'savings'), orderBy('date', 'desc'));
        const snapshot = await getDocs(q);
        setSavings(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Saving)));
      } else {
        const q = query(collection(db, 'loans'), orderBy('date', 'desc'));
        const snapshot = await getDocs(q);
        setLoans(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Loan)));
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateLoanStatus = async (loanId: string, status: 'active' | 'rejected') => {
    setProcessing(true);
    try {
      const loanRef = doc(db, 'loans', loanId);
      await runTransaction(db, async (transaction) => {
        const loanDoc = await transaction.get(loanRef);
        if (!loanDoc.exists()) throw new Error("Loan not found");
        
        transaction.update(loanRef, { 
          status,
          updatedAt: new Date().toISOString()
        });
      });
      fetchData();
      calculateCashFlow();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'loans');
    } finally {
      setProcessing(false);
    }
  };

  const handleSaveSaving = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcessing(true);
    try {
      const data = {
        ...newSaving,
        date: new Date().toISOString(),
      };
      await addDoc(collection(db, 'savings'), data);
      setShowAddSaving(false);
      setNewSaving({ memberId: '', amount: 0, type: 'wajib' });
      fetchData();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'savings');
    } finally {
      setProcessing(false);
    }
  };

  const handleSaveLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcessing(true);
    try {
      const totalInterestAmount = (newLoan.amount! * (newLoan.interest || 0) / 100) * newLoan.durationMonths!;
      const totalPayable = newLoan.amount! + totalInterestAmount;
      const data = {
        ...newLoan,
        date: new Date().toISOString(),
        totalPayable,
        remainingAmount: totalPayable,
        status: 'pending'
      };
      await addDoc(collection(db, 'loans'), data);
      setShowAddLoan(false);
      setNewLoan({ memberId: '', amount: 0, durationMonths: 12, interest: 1.5, type: 'cash' });
      fetchData();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'loans');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <header className="flex justify-between items-end">
        <div>
          <span className="font-serif italic text-sm opacity-50 block mb-1">Manajemen Keuangan</span>
          <h1 className="text-4xl font-serif italic tracking-tight">Simpan Pinjam</h1>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={() => activeTab === 'savings' ? setShowAddSaving(true) : setShowAddLoan(true)}
            className="flex items-center gap-2 bg-[#141414] text-[#E4E3E0] px-6 py-3 rounded-full font-mono text-[10px] tracking-widest hover:scale-105 transition-all shadow-lg"
          >
            <Plus size={16} />
            {activeTab === 'savings' ? 'INPUT SIMPANAN' : 'PENGAJUAN PINJAMAN'}
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex border-b border-[#141414]">
        <button 
          onClick={() => setActiveTab('savings')}
          className={`px-8 py-4 font-serif italic text-lg transition-all relative ${
            activeTab === 'savings' ? 'text-[#141414]' : 'text-stone-400 opacity-50'
          }`}
        >
          Tabungan Anggota
          {activeTab === 'savings' && <motion.div layoutId="fin-underline" className="absolute bottom-0 left-0 right-0 h-1 bg-[#141414]" />}
        </button>
        <button 
          onClick={() => setActiveTab('loans')}
          className={`px-8 py-4 font-serif italic text-lg transition-all relative ${
            activeTab === 'loans' ? 'text-[#141414]' : 'text-stone-400 opacity-50'
          }`}
        >
          Pinjaman & Angsuran
          {activeTab === 'loans' && <motion.div layoutId="fin-underline" className="absolute bottom-0 left-0 right-0 h-1 bg-[#141414]" />}
        </button>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Table View */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white border border-[#141414] rounded-xl overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-stone-100 border-b border-[#141414] text-[10px] font-mono opacity-50 uppercase">
                  <th className="p-4">Tanggal</th>
                  <th className="p-4">Nama Anggota</th>
                  <th className="p-4">Keterangan/Tipe</th>
                  <th className="p-4">Tenor/Bunga</th>
                  <th className="p-4 text-right">Pokok</th>
                  <th className="p-4 text-right">Angsuran/Bln</th>
                </tr>
              </thead>
              <tbody className="text-xs font-mono">
                {activeTab === 'savings' ? (
                  savings.map(s => (
                    <tr key={s.id} className="border-b border-[#141414]/10 hover:bg-stone-50">
                      <td className="p-4 opacity-50">{new Date(s.date).toLocaleDateString()}</td>
                      <td className="p-4 font-bold font-sans">
                        {members.find(m => m.id === s.memberId)?.name || '...'}
                      </td>
                      <td className="p-4 uppercase">{s.type}</td>
                      <td className="p-4 text-right font-bold">Rp {s.amount.toLocaleString()}</td>
                    </tr>
                  ))
                ) : (
                  loans.map(l => (
                    <tr key={l.id} className="border-b border-[#141414]/10 hover:bg-stone-50">
                      <td className="p-4 opacity-50">{new Date(l.date).toLocaleDateString()}</td>
                      <td className="p-4 font-bold font-sans">
                        {members.find(m => m.id === l.memberId)?.name || '...'}
                      </td>
                      <td className="p-4 uppercase flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          {l.type} 
                          <span className={`text-[8px] px-1.5 py-0.5 rounded border border-[#141414] ${
                            l.status === 'active' ? 'bg-green-50 text-green-700' : 
                            l.status === 'pending' ? 'bg-orange-50 text-orange-700' :
                            'bg-red-50 text-red-700'
                          }`}>{l.status.toUpperCase()}</span>
                        </div>
                        {l.status === 'pending' && (
                          <div className="flex gap-2 mt-2">
                            <button 
                              disabled={processing}
                              onClick={() => handleUpdateLoanStatus(l.id, 'active')}
                              className="px-2 py-1 bg-[#141414] text-white rounded text-[8px] hover:bg-stone-800 transition-colors"
                            >
                              SETUJUI
                            </button>
                            <button 
                              disabled={processing}
                              onClick={() => handleUpdateLoanStatus(l.id, 'rejected')}
                              className="px-2 py-1 border border-red-600 text-red-600 rounded text-[8px] hover:bg-red-50 transition-colors"
                            >
                              TOLAK
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="p-4">
                        {l.durationMonths} Bln / {l.interest}%
                      </td>
                      <td className="p-4 text-right font-bold">Rp {l.amount.toLocaleString()}</td>
                      <td className="p-4 text-right font-bold text-blue-600">
                        Rp {(l.totalPayable / l.durationMonths).toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Info Column */}
        <div className="space-y-6">
          {/* Arus Kas Widget */}
          <div className="p-8 bg-[#141414] text-[#E4E3E0] rounded-xl shadow-xl">
            <h3 className="font-serif italic text-xl mb-6">Buku Kas (Arus Kas)</h3>
            <div className="space-y-4 font-mono text-[10px]">
              <div className="flex justify-between border-b border-[#E4E3E0]/20 pb-2">
                <span className="opacity-60">TOTAL DEBIT (MASUK)</span>
                <span className="text-green-400 font-bold">+ Rp {cashFlow.debit.toLocaleString()}</span>
              </div>
              <div className="flex justify-between border-b border-[#E4E3E0]/20 pb-2">
                <span className="opacity-60">TOTAL KREDIT (KELUAR)</span>
                <span className="text-red-400 font-bold">- Rp {cashFlow.credit.toLocaleString()}</span>
              </div>
              <div className="flex justify-between pt-4">
                <span className="text-sm font-serif italic">Saldo Akhir Realtime</span>
                <span className={`text-lg font-bold ${cashFlow.balance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  Rp {cashFlow.balance.toLocaleString()}
                </span>
              </div>
            </div>
            <div className="mt-6 pt-6 border-t border-[#E4E3E0]/10 text-[8px] opacity-40 uppercase tracking-widest text-center">
              Pembaruan otomatis via cloud firestore
            </div>
          </div>

          <div className="p-8 border border-[#141414] bg-white rounded-xl">
            <h3 className="font-serif italic text-xl mb-4 text-[#141414]">Ringkasan Tabungan</h3>
            <div className="space-y-4 font-mono text-[10px] text-[#141414]">
              <div className="flex justify-between border-b border-[#141414]/10 pb-2">
                <span>SIMPANAN POKOK</span>
                <span>Rp {savings.filter(s => s.type === 'pokok').reduce((a, b) => a + b.amount, 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between border-b border-[#141414]/10 pb-2">
                <span>SIMPANAN WAJIB</span>
                <span>Rp {savings.filter(s => s.type === 'wajib').reduce((a, b) => a + b.amount, 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between border-b border-[#141414]/10 pb-2">
                <span>SIMPANAN SUKARELA</span>
                <span>Rp {savings.filter(s => s.type === 'sukarela').reduce((a, b) => a + b.amount, 0).toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Saving Modal */}
      <AnimatePresence>
        {showAddSaving && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-[#141414]/40 backdrop-blur-sm" onClick={() => setShowAddSaving(false)} />
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-white max-w-lg w-full rounded-2xl shadow-2xl border border-[#141414] z-10 overflow-hidden">
              <div className="p-6 border-b border-[#141414] flex justify-between items-center">
                <h3 className="font-serif italic text-xl">Input Simpanan</h3>
                <button onClick={() => setShowAddSaving(false)}><X size={20}/></button>
              </div>
              <form onSubmit={handleSaveSaving} className="p-6 space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-mono uppercase opacity-50">Nama Anggota</label>
                  <select required value={newSaving.memberId} onChange={e => setNewSaving({...newSaving, memberId: e.target.value})} className="w-full border border-[#141414] rounded-lg p-3 font-sans">
                    <option value="">Pilih Anggota</option>
                    {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono uppercase opacity-50">Tipe Simpanan</label>
                    <select value={newSaving.type} onChange={e => setNewSaving({...newSaving, type: e.target.value as any})} className="w-full border border-[#141414] rounded-lg p-3 font-mono text-xs">
                      <option value="pokok">POKOK</option>
                      <option value="wajib">WAJIB</option>
                      <option value="sukarela">SUKARELA</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono uppercase opacity-50">Jumlah (Rp)</label>
                    <input required type="number" value={newSaving.amount} onChange={e => setNewSaving({...newSaving, amount: Number(e.target.value)})} className="w-full border border-[#141414] rounded-lg p-3 font-mono text-sm" />
                  </div>
                </div>
                <button disabled={processing} type="submit" className="w-full bg-[#141414] text-white py-4 rounded-xl font-mono text-[10px] tracking-widest mt-4">
                  {processing ? <Loader2 className="animate-spin mx-auto" /> : 'SIMPAN DATA'}
                </button>
              </form>
            </motion.div>
          </div>
        )}

        {showAddLoan && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-[#141414]/40 backdrop-blur-sm" onClick={() => setShowAddLoan(false)} />
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-white max-w-lg w-full rounded-2xl shadow-2xl border border-[#141414] z-10 overflow-hidden">
              <div className="p-6 border-b border-[#141414] flex justify-between items-center">
                <h3 className="font-serif italic text-xl">Pengajuan Pinjaman</h3>
                <button onClick={() => setShowAddLoan(false)}><X size={20}/></button>
              </div>
              <form onSubmit={handleSaveLoan} className="p-6 space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-mono uppercase opacity-50">Nama Anggota</label>
                  <select required value={newLoan.memberId} onChange={e => setNewLoan({...newLoan, memberId: e.target.value})} className="w-full border border-[#141414] rounded-lg p-3 font-sans">
                    <option value="">Pilih Anggota</option>
                    {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono uppercase opacity-50">Tipe Pinjaman</label>
                    <select value={newLoan.type} onChange={e => setNewLoan({...newLoan, type: e.target.value as any})} className="w-full border border-[#141414] rounded-lg p-3 font-mono text-xs">
                      <option value="cash">TUNAI</option>
                      <option value="goods">BARANG</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono uppercase opacity-50">Jumlah Pinjaman (Rp)</label>
                    <input required type="number" value={newLoan.amount} onChange={e => setNewLoan({...newLoan, amount: Number(e.target.value)})} className="w-full border border-[#141414] rounded-lg p-3 font-mono text-sm" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono uppercase opacity-50">Masa Angsuran (Bulan)</label>
                    <input required type="number" value={newLoan.durationMonths} onChange={e => setNewLoan({...newLoan, durationMonths: Number(e.target.value)})} className="w-full border border-[#141414] rounded-lg p-3 font-mono text-sm" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono uppercase opacity-50">Bunga Per Bulan (%)</label>
                    <input required type="number" step="0.01" value={newLoan.interest} onChange={e => setNewLoan({...newLoan, interest: Number(e.target.value)})} className="w-full border border-[#141414] rounded-lg p-3 font-mono text-sm" />
                  </div>
                </div>

                {newLoan.amount! > 0 && (
                  <div className="p-4 bg-stone-50 border border-[#141414]/10 rounded-xl space-y-2">
                    <div className="flex justify-between text-[10px] font-mono uppercase opacity-60">
                      <span>Cicilan Pokok / Bln</span>
                      <span>Rp {(newLoan.amount! / (newLoan.durationMonths || 1)).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-[10px] font-mono uppercase opacity-60">
                      <span>Bunga / Bln</span>
                      <span>Rp {(newLoan.amount! * (newLoan.interest || 0) / 100).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm font-bold border-t border-[#141414]/10 pt-2">
                      <span className="font-serif italic">Total Angsuran Per Bulan</span>
                      <span>Rp {getMonthlyInstallment().toLocaleString()}</span>
                    </div>
                    <div className="text-[10px] font-mono text-stone-400 mt-2 italic">
                      * Total pengembalian: Rp {(getMonthlyInstallment() * (newLoan.durationMonths || 1)).toLocaleString()}
                    </div>
                  </div>
                )}
                <button disabled={processing} type="submit" className="w-full bg-[#141414] text-white py-4 rounded-xl font-mono text-[10px] tracking-widest mt-4">
                   {processing ? <Loader2 className="animate-spin mx-auto" /> : 'AJUKAN PINJAMAN'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
