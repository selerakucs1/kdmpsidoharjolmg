import React, { useState, useEffect } from 'react';
import { 
  collection, 
  getDocs, 
  query, 
  orderBy, 
  addDoc, 
  runTransaction, 
  doc 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Item, Member, Transaction as PaymentTransaction, Loan } from '../types';
import { 
  ShoppingCart, 
  User, 
  Trash2, 
  Minus, 
  Plus, 
  CreditCard, 
  Wallet,
  CheckCircle,
  Loader2,
  Search
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface CartItem extends Item {
  qty: number;
}

export default function POS() {
  const [items, setItems] = useState<Item[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedMember, setSelectedMember] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'credit'>('cash');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [itemSnap, memberSnap] = await Promise.all([
        getDocs(query(collection(db, 'items'), orderBy('name'))),
        getDocs(query(collection(db, 'members'), orderBy('name')))
      ]);
      setItems(itemSnap.docs.map(d => ({ id: d.id, ...d.data() } as Item)));
      setMembers(memberSnap.docs.map(d => ({ id: d.id, ...d.data() } as Member)));
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const addToCart = (item: Item) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        return prev.map(i => i.id === item.id ? { ...i, qty: i.qty + 1 } : i);
      }
      return [...prev, { ...item, qty: 1 }];
    });
  };

  const updateQty = (id: string, delta: number) => {
    setCart(prev => prev.map(i => {
      if (i.id === id) {
        const newQty = Math.max(1, i.qty + delta);
        return { ...i, qty: newQty };
      }
      return i;
    }));
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(i => i.id !== id));
  };

  const total = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);

  const handleSubmit = async () => {
    if (cart.length === 0) return;
    if (paymentMethod === 'credit' && !selectedMember) {
      alert('Pilih anggota untuk transaksi kredit');
      return;
    }

    setProcessing(true);
    try {
      await runTransaction(db, async (transaction) => {
        // 1. Verify stocks and prepare item updates
        for (const cartItem of cart) {
          const itemRef = doc(db, 'items', cartItem.id!);
          const itemDoc = await transaction.get(itemRef);
          if (!itemDoc.exists()) throw new Error("Item not found");
          const currentStock = itemDoc.data().stock;
          if (currentStock < cartItem.qty) {
            throw new Error(`Stok ${cartItem.name} tidak mencukupi`);
          }
          transaction.update(itemRef, { stock: currentStock - cartItem.qty });
        }

        // 2. Create Transaction Record
        const txRef = doc(collection(db, 'transactions'));
        const txnData: PaymentTransaction = {
          date: new Date().toISOString(),
          type: 'sale',
          paymentMethod,
          memberId: selectedMember || undefined,
          totalAmount: total,
          items: cart.map(i => ({ itemId: i.id!, name: i.name, qty: i.qty, price: i.price }))
        };
        transaction.set(txRef, txnData);

        // 3. If credit, create Loan Record
        if (paymentMethod === 'credit') {
          const loanRef = doc(collection(db, 'loans'));
          const loanData: Loan = {
            memberId: selectedMember,
            date: new Date().toISOString(),
            amount: total,
            interest: 0,
            totalPayable: total,
            durationMonths: 1, // Default to 1 month for simple goods loan
            remainingAmount: total,
            status: 'active',
            type: 'goods'
          };
          transaction.set(loanRef, loanData);
        }
      });

      setCart([]);
      setSelectedMember('');
      setPaymentMethod('cash');
      alert('Transaksi Berhasil!');
      fetchData(); // Refresh stocks
    } catch (error: any) {
      alert(error.message);
    } finally {
      setProcessing(false);
    }
  };

  const filteredItems = items.filter(i => 
    i.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    i.category?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="h-full flex overflow-hidden">
      {/* Items Section */}
      <div className="flex-1 p-8 space-y-6 overflow-auto border-r border-[#141414]">
        <header>
          <span className="font-serif italic text-sm opacity-50 block mb-1">Kasir</span>
          <h1 className="text-4xl font-serif italic tracking-tight">Katalog Barang</h1>
        </header>

        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
          <input 
            type="text" 
            placeholder="Cari atau scan barcode..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white border border-[#141414] rounded-xl py-4 pl-12 pr-4 font-mono text-sm focus:outline-none shadow-sm"
          />
        </div>

        <div className="grid grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
          {filteredItems.map(item => (
            <button
              key={item.id}
              onClick={() => addToCart(item)}
              disabled={item.stock <= 0}
              className="group p-4 bg-white border border-[#141414] rounded-xl text-left hover:bg-[#141414] hover:text-white transition-all disabled:opacity-50 disabled:grayscale relative overflow-hidden"
            >
              <div className="flex justify-between items-start mb-4">
                <span className="text-[10px] font-mono opacity-50 uppercase">{item.category}</span>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded border border-[#141414] group-hover:border-white/20 ${
                  item.stock < 10 ? 'bg-red-50 text-red-600' : 'bg-stone-50 text-stone-600'
                }`}>
                  STOK: {item.stock}
                </span>
              </div>
              <h3 className="font-serif italic text-lg leading-tight mb-2">{item.name}</h3>
              <p className="font-mono text-sm">Rp {item.price.toLocaleString('id-ID')}</p>
              
              <div className="absolute bottom-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity translate-y-2 group-hover:translate-y-0">
                <Plus size={16} />
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Cart Section */}
      <div className="w-[400px] bg-white flex flex-col shadow-2xl">
        <div className="p-6 border-b border-[#141414] flex justify-between items-center bg-[#141414] text-[#E4E3E0]">
          <h2 className="font-serif italic text-xl flex items-center gap-2">
            <ShoppingCart size={20} />
            Keranjang
          </h2>
          <span className="font-mono text-[10px] opacity-60">{cart.length} ITEMS</span>
        </div>

        <div className="flex-1 overflow-auto p-6 space-y-4">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-stone-300 space-y-4">
              <ShoppingCart size={48} strokeWidth={1} />
              <p className="font-serif italic text-lg">Belum ada barang</p>
            </div>
          ) : (
            cart.map(item => (
              <motion.div 
                layout
                key={item.id} 
                className="flex gap-4 p-3 border border-[#141414]/5 rounded-xl hover:bg-stone-50 transition-colors group"
              >
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium truncate">{item.name}</h4>
                  <p className="text-[10px] font-mono opacity-50">Rp {item.price.toLocaleString()} x {item.qty}</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center border border-[#141414] rounded-lg overflow-hidden bg-white">
                    <button onClick={() => updateQty(item.id!, -1)} className="p-1 px-2 hover:bg-stone-100"><Minus size={12} /></button>
                    <span className="w-8 text-center font-mono text-xs">{item.qty}</span>
                    <button onClick={() => updateQty(item.id!, 1)} className="p-1 px-2 hover:bg-stone-100"><Plus size={12} /></button>
                  </div>
                  <button onClick={() => removeFromCart(item.id!)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button>
                </div>
              </motion.div>
            ))
          )}
        </div>

        <div className="p-6 border-t border-[#141414] space-y-6 bg-[#E4E3E0]/30">
          {/* Member Selection */}
          <div className="space-y-2">
            <label className="text-[10px] font-mono uppercase opacity-50 flex items-center gap-2">
              <User size={12} />
              Anggota Pembeli
            </label>
            <select 
              value={selectedMember}
              onChange={(e) => setSelectedMember(e.target.value)}
              className="w-full bg-white border border-[#141414] rounded-xl px-4 py-3 font-sans text-sm outline-none"
            >
              <option value="">PELANGGAN UMUM (CASH ONLY)</option>
              {members.map(m => (
                <option key={m.id} value={m.id}>{m.name.toUpperCase()}</option>
              ))}
            </select>
          </div>

          {/* Payment Method */}
          <div className="space-y-2">
            <label className="text-[10px] font-mono uppercase opacity-50">Metode Pembayaran</label>
            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={() => setPaymentMethod('cash')}
                className={`flex items-center justify-center gap-2 p-3 border border-[#141414] rounded-xl text-[10px] font-mono tracking-widest transition-all ${
                  paymentMethod === 'cash' ? 'bg-[#141414] text-white shadow-lg scale-105' : 'bg-white hover:bg-stone-100'
                }`}
              >
                <Wallet size={14} />
                TUNAI
              </button>
              <button 
                disabled={!selectedMember}
                onClick={() => setPaymentMethod('credit')}
                className={`flex items-center justify-center gap-2 p-3 border border-[#141414] rounded-xl text-[10px] font-mono tracking-widest transition-all disabled:opacity-40 ${
                  paymentMethod === 'credit' ? 'bg-[#141414] text-white shadow-lg scale-105' : 'bg-white hover:bg-stone-100'
                }`}
              >
                <CreditCard size={14} />
                KREDIT
              </button>
            </div>
          </div>

          {/* Checkout Info */}
          <div className="space-y-3 pt-4 border-t border-[#141414]/10">
            <div className="flex justify-between items-center text-stone-500 font-mono text-[10px]">
              <span>SUBTOTAL</span>
              <span>Rp {total.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-end">
              <span className="font-serif italic text-lg leading-none">Total Tagihan</span>
              <span className="text-3xl font-mono tracking-tighter leading-none">Rp {total.toLocaleString()}</span>
            </div>
          </div>

          <button
            disabled={cart.length === 0 || processing}
            onClick={handleSubmit}
            className="w-full bg-[#141414] text-[#E4E3E0] py-5 rounded-2xl font-mono text-[12px] tracking-widest hover:bg-[#2a2a2a] transition-all flex items-center justify-center gap-3 shadow-xl active:scale-95 disabled:grayscale"
          >
            {processing ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              <>
                <CheckCircle size={20} />
                PROSES TRANSAKSI
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
