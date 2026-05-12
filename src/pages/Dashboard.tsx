import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, limit, orderBy, where, getCountFromServer, writeBatch, doc as firestoreDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useNavigate } from 'react-router-dom';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { 
  Users, 
  TrendingUp, 
  Package, 
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  ListRestart,
  CheckCircle2
} from 'lucide-react';
import { motion } from 'motion/react';
import { Item, Member, Transaction, Saving, Loan } from '../types';

export default function Dashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState<any[]>([]);
  const [stats, setStats] = useState({
    memberCount: 0,
    itemCount: 0,
    totalSavings: 0,
    activeLoans: 0
  });
  const [recentActivities, setRecentActivities] = useState<any[]>([]);
  const [criticalItems, setCriticalItems] = useState<Item[]>([]);
  const [cashBalance, setCashBalance] = useState({
    debit: 0,
    credit: 0,
    balance: 0
  });

  const [repairing, setRepairing] = useState(false);
  const [repairSuccess, setRepairSuccess] = useState(false);
  const [inspectCard, setInspectCard] = useState('');
  const [inspectedMember, setInspectedMember] = useState<any>(null);

  const handleInspect = async () => {
    if (!inspectCard) return;
    try {
      const q = query(collection(db, 'members'), where('cardNumber', '==', inspectCard.trim()));
      const snap = await getDocs(q);
      if (snap.empty) {
        alert("Nomor kartu tidak ditemukan");
        setInspectedMember(null);
      } else {
        const data = snap.docs[0].data();
        setInspectedMember(data);
      }
    } catch (e) {
      alert("Error inspecting card");
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleRepairData = async () => {
    setRepairing(true);
    try {
      const snap = await getDocs(collection(db, 'members'));
      const batch = writeBatch(db);
      let count = 0;
      
      snap.docs.forEach((d, idx) => {
        const data = d.data();
        const updates: any = {};
        let needsUpdate = false;

        if (!data.cardNumber) {
          updates.cardNumber = (1000 + idx).toString();
          needsUpdate = true;
        }
        if (!data.password) {
          updates.password = '12345';
          needsUpdate = true;
        }
        if (!data.email) {
          updates.email = '';
          needsUpdate = true;
        }
        if (!data.birthDate) {
          updates.birthDate = '';
          needsUpdate = true;
        }

        if (needsUpdate) {
          batch.update(firestoreDoc(db, 'members', d.id), updates);
          count++;
        }
      });

      if (count > 0) {
        await batch.commit();
        alert(`Berhasil memperbarui ${count} data anggota.`);
      }
      setRepairSuccess(true);
      setTimeout(() => setRepairSuccess(false), 3000);
      fetchDashboardData();
    } catch (error) {
      alert("Gagal melakukan perbaikan data");
    } finally {
      setRepairing(false);
    }
  };

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // 1. Get fundamental counts
      const [memberSnap, itemSnap] = await Promise.all([
        getCountFromServer(collection(db, 'members')),
        getCountFromServer(collection(db, 'items'))
      ]);

      // 2. Get Savings, Transactions, Loans & Repayments
      const [savingsSnap, allTransactionsSnap, loansSnap, repaymentsSnap] = await Promise.all([
        getDocs(collection(db, 'savings')),
        getDocs(collection(db, 'transactions')),
        getDocs(collection(db, 'loans')),
        getDocs(collection(db, 'repayments'))
      ]);

      const totalSavings = savingsSnap.docs.reduce((acc, doc) => acc + (doc.data().amount || 0), 0);
      const totalSales = allTransactionsSnap.docs
        .filter(doc => doc.data().type === 'sale')
        .reduce((acc, doc) => acc + (doc.data().totalAmount || 0), 0);
      
      const totalRepayments = repaymentsSnap.docs.reduce((acc, doc) => acc + (doc.data().amount || 0), 0);
      
      const totalPurchases = allTransactionsSnap.docs
        .filter(doc => doc.data().type === 'purchase')
        .reduce((acc, doc) => acc + (doc.data().totalAmount || 0), 0);
      
      const totalDisbursements = loansSnap.docs
        .filter(doc => doc.data().status === 'active' || doc.data().status === 'completed')
        .reduce((acc, doc) => acc + (doc.data().amount || 0), 0);

      const debit = totalSavings + totalSales + totalRepayments;
      const credit = totalPurchases + totalDisbursements;

      setCashBalance({
        debit,
        credit,
        balance: debit - credit
      });

      // 3. Get Active Loans
      const activeLoansCount = loansSnap.docs.filter(d => d.data().status === 'active').length;

      setStats({
        memberCount: memberSnap.data().count,
        itemCount: itemSnap.data().count,
        totalSavings,
        activeLoans: activeLoansCount
      });

      // 4. Recent Activities (from transactions)
      const txnSnap = await getDocs(query(
        collection(db, 'transactions'), 
        orderBy('date', 'desc'), 
        limit(5)
      ));
      
      const membersSnap = await getDocs(collection(db, 'members'));
      const membersMap = Object.fromEntries(membersSnap.docs.map(d => [d.id, d.data().name]));

      const activities = txnSnap.docs.map(doc => {
        const data = doc.data() as Transaction;
        return {
          id: doc.id,
          type: data.type.toUpperCase(),
          target: data.type === 'sale' ? (membersMap[data.memberId!] || 'UMUM') : 'Restock Barang',
          amount: data.totalAmount,
          date: new Date(data.date),
          payment: data.paymentMethod
        };
      });
      setRecentActivities(activities);

      // 5. Critical Stock Items (stock <= 10)
      const lowStockSnap = await getDocs(query(
        collection(db, 'items'),
        where('stock', '<=', 10),
        limit(5)
      ));
      setCriticalItems(lowStockSnap.docs.map(d => ({ id: d.id, ...d.data() } as Item)));

      // 6. Chart Data Transformation
      // Get all transactions and savings to group by month
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
      const last6Months = [];
      const now = new Date();
      
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        last6Months.push({ 
          name: months[d.getMonth()], 
          monthIndex: d.getMonth(), 
          year: d.getFullYear(),
          revenue: 0, 
          savings: 0 
        });
      }

      // Group Transactions (Sales)
      const allTxnsSnap = await getDocs(query(collection(db, 'transactions'), where('type', '==', 'sale')));
      allTxnsSnap.docs.forEach(doc => {
        const data = doc.data();
        const date = new Date(data.date);
        const monthData = last6Months.find(m => m.monthIndex === date.getMonth() && m.year === date.getFullYear());
        if (monthData) monthData.revenue += (data.totalAmount || 0);
      });

      // Group Savings
      savingsSnap.docs.forEach(doc => {
        const data = doc.data();
        const date = new Date(data.date);
        const monthData = last6Months.find(m => m.monthIndex === date.getMonth() && m.year === date.getFullYear());
        if (monthData) monthData.savings += (data.amount || 0);
      });

      setChartData(last6Months);

    } catch (error) {
      console.error("Dashboard error:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="animate-spin text-[#141414]" size={32} />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <span className="font-serif italic text-sm opacity-50 block mb-1">Rangkuman Sistem</span>
          <h1 className="text-3xl sm:text-4xl font-serif italic tracking-tight">Overview Operasional</h1>
        </div>
        <div className="text-left sm:text-right font-mono text-[10px] space-y-1">
          <p>STATUS: ONLINE</p>
          <p>LAST SYNC: {new Date().toLocaleTimeString()}</p>
        </div>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Total Anggota', value: stats.memberCount, icon: Users, route: '/members' },
          { label: 'Aset Barang', value: stats.itemCount, icon: Package, route: '/inventory' },
          { label: 'Total Simpanan', value: `Rp ${stats.totalSavings.toLocaleString()}`, icon: TrendingUp, route: '/financials' },
          { label: 'Pinjaman Aktif', value: stats.activeLoans, icon: AlertCircle, route: '/financials' },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            onClick={() => navigate(stat.route)}
            className="p-6 border border-[#141414] bg-white rounded-xl flex flex-col justify-between h-40 group hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors cursor-pointer"
          >
            <div className="flex justify-between items-start">
              <div className="p-2 border border-[#141414] group-hover:border-[#E4E3E0] rounded-lg">
                <stat.icon size={20} />
              </div>
            </div>
            <div>
              <p className="text-[10px] font-mono uppercase opacity-50 tracking-wider mb-1">{stat.label}</p>
              <h2 className="text-3xl font-mono tracking-tighter truncate">{stat.value}</h2>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Chart Column */}
        <div className="lg:col-span-2 space-y-8">
          <div className="p-8 border border-[#141414] bg-white rounded-xl h-[400px]">
            <div className="flex justify-between items-center mb-8">
              <h3 className="font-serif italic text-xl">Arus Kas & Simpanan</h3>
              <div className="flex gap-4 font-mono text-[10px]">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-[#141414] rounded-full" />
                  <span>TRANSAKSI</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-stone-300 rounded-full" />
                  <span>SIMPANAN</span>
                </div>
              </div>
            </div>
            <ResponsiveContainer width="100%" height="80%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E4E3E0" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontFamily: 'monospace' }} 
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontFamily: 'monospace' }} 
                />
                <Tooltip 
                  cursor={{ fill: '#f5f5f5' }}
                  contentStyle={{ 
                    fontFamily: 'monospace', 
                    fontSize: '12px', 
                    borderRadius: '8px',
                    border: '1px solid #141414'
                  }}
                />
                <Bar dataKey="revenue" fill="#141414" radius={[4, 4, 0, 0]} />
                <Bar dataKey="savings" fill="#d1d5db" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Recent Activities */}
          <div className="border border-[#141414] bg-white rounded-xl overflow-hidden">
            <div className="p-6 border-b border-[#141414] flex justify-between items-center">
              <h3 className="font-serif italic text-xl">Aktivitas Terakhir</h3>
              <button onClick={() => navigate('/transactions')} className="text-[10px] font-mono border border-[#141414] px-4 py-2 rounded-full hover:bg-[#141414] hover:text-[#E4E3E0] transition-all">
                LIHAT SEMUA LOG
              </button>
            </div>
            <div className="divide-y divide-[#141414]">
              {recentActivities.length === 0 ? (
                <div className="p-12 text-center text-stone-400 italic font-serif">Belum ada aktivitas tercatat</div>
              ) : (
                recentActivities.map((item, i) => (
                  <div key={i} className="p-4 flex justify-between items-center hover:bg-[#f5f5f5] cursor-pointer group" onClick={() => navigate('/transactions')}>
                    <div className="flex gap-4 items-center">
                      <span className={`font-mono text-[10px] px-2 py-0.5 rounded border border-[#141414] ${item.type === 'SALE' ? 'bg-green-50 text-green-700' : 'bg-blue-50 text-blue-700'}`}>
                        {item.type}
                      </span>
                      <span className="text-sm font-medium">{item.target}</span>
                      <span className="font-mono text-[8px] opacity-40 uppercase">{item.payment}</span>
                    </div>
                    <div className="flex gap-8 items-center">
                      <span className={`font-mono text-sm font-bold ${item.type === 'SALE' ? 'text-green-600' : 'text-red-600'}`}>
                        {item.type === 'SALE' ? '+' : '-'}Rp {item.amount.toLocaleString()}
                      </span>
                      <span className="font-mono text-[10px] opacity-40">{item.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Side Column */}
        <div className="space-y-8">
          {/* Realtime Cash Balance Widget */}
          <div className="p-8 border border-[#141414] bg-[#141414] text-[#E4E3E0] rounded-xl shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <TrendingUp size={80} />
            </div>
            <div className="relative z-10">
              <span className="font-mono text-[8px] uppercase tracking-[0.2em] opacity-50 block mb-2">SALDO KAS REALTIME</span>
              <h3 className="text-3xl font-mono tracking-tighter mb-6">Rp {cashBalance.balance.toLocaleString()}</h3>
              
              <div className="space-y-3 pt-6 border-t border-[#E4E3E0]/10 font-mono text-[9px]">
                <div className="flex justify-between items-center">
                  <span className="opacity-40">TOTAL DEBIT (+)</span>
                  <span className="text-green-400 font-bold">Rp {cashBalance.debit.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="opacity-40">TOTAL KREDIT (-)</span>
                  <span className="text-red-400 font-bold">Rp {cashBalance.credit.toLocaleString()}</span>
                </div>
              </div>
              
              <button 
                onClick={() => navigate('/financials')}
                className="w-full mt-6 py-3 border border-[#E4E3E0]/20 rounded-lg text-[9px] hover:bg-[#E4E3E0] hover:text-[#141414] transition-all font-mono tracking-wider"
              >
                DETAIL BUKU KAS
              </button>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="p-6 border border-[#141414] bg-white rounded-xl">
            <h3 className="font-serif italic text-xl mb-6 text-[#141414]">Utilitas Data</h3>
            
            {/* Inspector Tool */}
            <div className="mb-8 p-4 bg-stone-50 border border-stone-200 rounded-lg space-y-4">
              <p className="text-[10px] font-mono uppercase opacity-60">Cek Kredensial Anggota</p>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  placeholder="No. Kartu"
                  value={inspectCard}
                  onChange={e => setInspectCard(e.target.value)}
                  className="flex-1 bg-white border border-stone-300 rounded px-3 py-2 font-mono text-[10px]"
                />
                <button 
                  onClick={handleInspect}
                  className="bg-[#141414] text-white px-4 py-2 rounded font-mono text-[8px] uppercase tracking-widest"
                >
                  Periksa
                </button>
              </div>
              {inspectedMember && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3 bg-white border border-stone-200 rounded text-[10px] font-mono leading-relaxed"
                >
                  <p className="font-bold text-[#141414] uppercase">{inspectedMember.name}</p>
                  <p>ID Kartu: {inspectedMember.cardNumber}</p>
                  <p>Password: <span className="bg-amber-100 px-1 font-bold">{inspectedMember.password}</span></p>
                  <button 
                    onClick={() => setInspectedMember(null)}
                    className="mt-2 text-red-500 underline"
                  >
                    Tutup
                  </button>
                </motion.div>
              )}
            </div>

            <button 
              onClick={handleRepairData}
              disabled={repairing}
              className="w-full text-left p-4 border border-orange-200 bg-orange-50 text-orange-800 rounded-lg text-[10px] font-mono tracking-widest hover:bg-orange-100 transition-all flex justify-between items-center group mb-8"
            >
              <div className="flex items-center gap-3">
                {repairing ? <Loader2 size={16} className="animate-spin" /> : (repairSuccess ? <CheckCircle2 size={16} className="text-green-600" /> : <ListRestart size={16} />)}
                <div>
                  <p>NORMALISASI DATA</p>
                  <p className="text-[8px] opacity-60">Generate Member Card & Password</p>
                </div>
              </div>
            </button>

            <h3 className="font-serif italic text-xl mb-6 text-[#141414]">Aksi Cepat</h3>
            <div className="space-y-3">
              {[
                { label: 'TAMBAH ANGGOTA BARU', route: '/members' },
                { label: 'INPUT SIMPANAN', route: '/financials' },
                { label: 'PENGAJUAN PINJAMAN', route: '/financials' },
                { label: 'KASIR PENJUALAN (POS)', route: '/pos' },
                { label: 'RESTOCK BARANG', route: '/inventory' }
              ].map((action, i) => (
                <button 
                  key={i}
                  onClick={() => navigate(action.route)}
                  className="w-full text-left p-4 border border-[#E4E3E0]/20 rounded-lg text-[10px] font-mono tracking-widest hover:bg-[#E4E3E0] hover:text-[#141414] transition-all flex justify-between items-center group"
                >
                  {action.label}
                  <ArrowUpRight size={14} className="opacity-0 group-hover:opacity-100 transition-all transform group-hover:translate-x-1 group-hover:-translate-y-1" />
                </button>
              ))}
            </div>
          </div>

          {/* Critical Stats */}
          <div className="p-6 border border-[#141414] bg-white rounded-xl">
            <h3 className="font-serif italic text-sm mb-4 opacity-50">Stok Kritis (≤ 10)</h3>
            <div className="space-y-4">
              {criticalItems.length === 0 ? (
                <p className="text-[10px] font-mono italic text-stone-400">Semua stok aman</p>
              ) : (
                criticalItems.map((item, i) => (
                  <div key={i} className="space-y-2 cursor-pointer group" onClick={() => navigate('/inventory')}>
                    <div className="flex justify-between font-mono text-[10px]">
                      <span className="font-bold group-hover:underline">{item.name}</span>
                      <span className="text-red-600 font-bold">{item.stock} {item.unit}</span>
                    </div>
                    <div className="h-1 bg-[#E4E3E0] rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-red-600" 
                        style={{ width: `${Math.min(100, (item.stock / 10) * 100)}%` }} 
                      />
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

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
