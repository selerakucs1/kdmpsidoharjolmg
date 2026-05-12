import { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Transaction } from '../types';
import { History, ShoppingCart, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';

export default function Transactions() {
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTxns();
  }, []);

  const fetchTxns = async () => {
    try {
      const q = query(collection(db, 'transactions'), orderBy('date', 'desc'));
      const snapshot = await getDocs(q);
      setTxns(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction)));
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 sm:p-8 space-y-8">
      <header>
        <span className="font-serif italic text-sm opacity-50 block mb-1 text-left">Log Sistem</span>
        <h1 className="text-3xl sm:text-4xl font-serif italic tracking-tight text-left">Riwayat Transaksi</h1>
      </header>

      <div className="bg-white border border-[#141414] rounded-xl overflow-x-auto no-scrollbar">
        <table className="w-full text-left min-w-[800px]">
          <thead>
            <tr className="bg-stone-50 border-b border-[#141414] font-mono text-[10px] opacity-40 uppercase">
              <th className="p-4">Timestamp</th>
              <th className="p-4">ID Transaksi</th>
              <th className="p-4">Tipe</th>
              <th className="p-4">Metode</th>
              <th className="p-4">Detail Barang</th>
              <th className="p-4 text-right">Total</th>
            </tr>
          </thead>
          <tbody className="font-mono text-xs divide-y divide-[#141414]/10">
            {loading ? (
              [...Array(10)].map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td colSpan={6} className="p-4 h-12 bg-stone-50" />
                </tr>
              ))
            ) : txns.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-12 text-center text-stone-400 italic">Belum ada data transaksi</td>
              </tr>
            ) : (
              txns.map(t => (
                <tr key={t.id} className="hover:bg-stone-50 group">
                  <td className="p-4 opacity-50">{new Date(t.date).toLocaleString()}</td>
                  <td className="p-4">{t.id?.slice(0, 8)}</td>
                  <td className="p-4">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded border border-[#141414] ${
                      t.type === 'purchase' ? 'bg-orange-50' : 'bg-green-50'
                    }`}>
                      {t.type === 'purchase' ? <ArrowDownCircle size={10} /> : <ArrowUpCircle size={10} />}
                      {t.type.toUpperCase()}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-0.5 rounded border border-[#141414] ${t.paymentMethod === 'credit' ? 'bg-red-50 text-red-600' : 'bg-white'}`}>
                      {t.paymentMethod?.toUpperCase() || 'CASH'}
                    </span>
                  </td>
                  <td className="p-4 text-[10px]">
                    <div className="max-w-[200px] truncate">
                      {t.items?.map(i => `${i.name || i.itemId} (${i.qty})`).join(', ') || '-'}
                    </div>
                  </td>
                  <td className="p-4 text-right font-bold">
                    Rp {t.totalAmount.toLocaleString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
