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
import AlertModal from '../components/AlertModal';
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
  X,
  FileText,
  Printer,
  Search,
  AlertTriangle
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
  const [printData, setPrintData] = useState<any>(null);
  const [showCartMobile, setShowCartMobile] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedMember, setSelectedMember] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'credit'>('cash');
  const [searchTerm, setSearchTerm] = useState('');
  const [alertConfig, setAlertConfig] = useState<{ show: boolean; title: string; message: string; type: 'success' | 'error' | 'warning' }>({
    show: false,
    title: '',
    message: '',
    type: 'success'
  });

  const showAlert = (title: string, message: string, type: 'success' | 'error' | 'warning' = 'success') => {
    setAlertConfig({ show: true, title, message, type });
  };

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
        if (existing.qty + 1 > item.stock) {
          showAlert('Stok Terbatas', `Stok tidak cukup! Maksimal stok ${item.name} adalah ${item.stock}`, 'warning');
          return prev;
        }
        return prev.map(i => i.id === item.id ? { ...i, qty: i.qty + 1 } : i);
      }
      if (item.stock <= 0) {
        showAlert('Stok Habis', `Stok ${item.name} sudah tidak tersedia!`, 'error');
        return prev;
      }
      return [...prev, { ...item, qty: 1 }];
    });
  };

  const updateQty = (id: string, delta: number) => {
    setCart(prev => {
      const itemInCart = prev.find(i => i.id === id);
      if (!itemInCart) return prev;

      const itemInCatalog = items.find(i => i.id === id);
      const maxStock = itemInCatalog?.stock ?? itemInCart.stock;

      const newQty = itemInCart.qty + delta;

      if (newQty > maxStock) {
        showAlert('Batas Stok', `Maksimal stok yang tersedia untuk ${itemInCart.name} adalah ${maxStock}`, 'warning');
        return prev;
      }

      if (newQty < 1) return prev;

      return prev.map(i => i.id === id ? { ...i, qty: newQty } : i);
    });
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(i => i.id !== id));
  };

  const total = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);

  const handleSubmit = async () => {
    if (cart.length === 0) return;
    if (paymentMethod === 'credit' && !selectedMember) {
      showAlert('Aksi Diperlukan', 'Silakan pilih anggota terlebih dahulu untuk transaksi kredit.', 'warning');
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

      const memberName = selectedMember ? members.find(m => m.id === selectedMember)?.name : 'UMUM';
      setPrintData({
        date: new Date().toISOString(),
        total,
        items: [...cart],
        memberName,
        paymentMethod,
        id: Math.random().toString(36).substr(2, 9).toUpperCase()
      });

      setCart([]);
      setSelectedMember('');
      setPaymentMethod('cash');
      showAlert('Berhasil', 'Transaksi telah berhasil diproses!', 'success');
      fetchData(); // Refresh stocks
    } catch (error: any) {
      showAlert('Gagal', error.message, 'error');
    } finally {
      setProcessing(false);
    }
  };

  const filteredItems = items.filter(i => 
    i.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    i.category?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="h-full flex flex-col lg:flex-row overflow-hidden relative">
      {/* Mobile Cart Toggle */}
      <button 
        onClick={() => setShowCartMobile(true)}
        className="lg:hidden fixed bottom-6 right-6 z-30 bg-[#141414] text-white p-4 rounded-full shadow-2xl flex items-center gap-3 animate-bounce"
      >
        <ShoppingCart size={24} />
        {cart.length > 0 && (
          <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded-full absolute -top-2 -right-2">
            {cart.length}
          </span>
        )}
      </button>

      {/* Items Section */}
      <div className="flex-1 p-4 sm:p-8 space-y-6 overflow-auto border-r border-[#141414] no-scrollbar">
        <header className="flex justify-between items-center text-left">
          <div>
            <span className="font-serif italic text-sm opacity-50 block mb-1">Kasir</span>
            <h1 className="text-3xl sm:text-4xl font-serif italic tracking-tight">Katalog Barang</h1>
          </div>
        </header>

        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
          <input 
            type="text" 
            placeholder="Cari atau scan barcode..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white border border-[#141414] rounded-xl py-3 sm:py-4 pl-12 pr-4 font-mono text-sm focus:outline-none shadow-sm"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 pb-20 lg:pb-0">
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
              <h3 className="font-serif italic text-base sm:text-lg leading-tight mb-2 tracking-tight">{item.name}</h3>
              <p className="font-mono text-sm">Rp {item.price.toLocaleString('id-ID')}</p>
              
              <div className="absolute bottom-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity translate-y-2 group-hover:translate-y-0">
                <Plus size={16} />
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Cart Section (Sidebar on Desktop, Modal on Mobile) */}
      <AnimatePresence>
        {(showCartMobile || window.innerWidth >= 1024) && (
          <motion.div 
            initial={window.innerWidth < 1024 ? { x: '100%' } : {}}
            animate={window.innerWidth < 1024 ? { x: 0 } : {}}
            exit={window.innerWidth < 1024 ? { x: '100%' } : {}}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className={`fixed inset-0 z-50 lg:relative lg:z-0 lg:flex lg:w-[400px] flex-col bg-white shadow-2xl ${showCartMobile ? 'flex' : 'hidden lg:flex'}`}
          >
            <div className="p-6 border-b border-[#141414] flex justify-between items-center bg-[#141414] text-[#E4E3E0]">
              <div className="flex items-center gap-4">
                <button onClick={() => setShowCartMobile(false)} className="lg:hidden p-2 hover:bg-white/10 rounded-full">
                  <X size={24} />
                </button>
                <h2 className="font-serif italic text-xl flex items-center gap-2">
                  <ShoppingCart size={20} />
                  Keranjang
                </h2>
              </div>
              <span className="font-mono text-[10px] opacity-60 uppercase">{cart.length} ITEMS</span>
            </div>

            <div className="flex-1 overflow-auto p-4 sm:p-6 space-y-4 no-scrollbar">
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
                  <span className="text-2xl sm:text-3xl font-mono tracking-tighter leading-none">Rp {total.toLocaleString()}</span>
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
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {printData && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 print:p-0 print:static">
            <div className="absolute inset-0 bg-white z-40 print:hidden" />
            <div className="print-area bg-white max-w-sm w-full p-8 relative z-50 print:p-0 print:shadow-none border border-dashed border-[#141414]/20">
              <button 
                onClick={() => setPrintData(null)}
                className="absolute top-4 right-4 p-2 hover:bg-stone-100 rounded-full print:hidden"
              >
                <X size={20} />
              </button>
              
              <div className="text-center space-y-2 mb-8 border-b-2 border-[#141414] pb-6">
                <h2 className="text-xl font-serif italic font-bold">KOPERASI MERAH PUTIH</h2>
                <p className="text-[10px] font-mono opacity-60 uppercase">Nota Penjualan</p>
                <p className="text-[10px] font-mono opacity-60">Telp: 085732252888</p>
              </div>

              <div className="mb-8">
                <div className="flex justify-between items-center mb-4 text-[10px] font-mono whitespace-nowrap overflow-hidden">
                   <span>{new Date(printData.date).toLocaleString()}</span>
                   <span>#{printData.id}</span>
                </div>
                
                <div className="space-y-2 text-xs font-mono">
                  <div className="flex justify-between border-b border-[#141414]/10 pb-2 mb-2">
                    <span className="opacity-50 uppercase">Item</span>
                    <span className="opacity-50 uppercase">Total</span>
                  </div>
                  {printData.items.map((item: any, idx: number) => (
                    <div key={idx} className="flex justify-between gap-4">
                      <div className="flex-1">
                        <p>{item.name}</p>
                        <p className="text-[10px] opacity-50">{item.qty} x Rp {item.price.toLocaleString()}</p>
                      </div>
                      <span className="font-bold">Rp {(item.qty * item.price).toLocaleString()}</span>
                    </div>
                  ))}
                  
                  <div className="mt-6 pt-4 border-t-2 border-[#141414]">
                    <div className="flex justify-between items-end">
                      <span className="font-bold">TOTAL</span>
                      <span className="text-xl font-bold">Rp {printData.total.toLocaleString()}</span>
                    </div>
                    <div className="mt-2 text-[10px] opacity-60 uppercase">
                      PEMBAYARAN: {printData.paymentMethod}
                    </div>
                    <div className="text-[10px] opacity-60 uppercase">
                      PEMBELI: {printData.memberName}
                    </div>
                  </div>
                </div>
              </div>

              <div className="text-center space-y-2 mt-12 pt-8 border-t border-dashed border-[#141414]">
                 <p className="text-[10px] font-mono opacity-60">TERIMA KASIH ATAS KUNJUNGANNYA</p>
                 <p className="text-[10px] font-mono opacity-60">Barang yang sudah dibeli tidak dapat ditukar/dikembalikan</p>
              </div>

              <div className="mt-8 pt-4 border-t border-[#141414]/10 text-center print:hidden">
                <button 
                  onClick={() => window.print()}
                  className="w-full bg-[#141414] text-white py-3 rounded-lg font-mono text-[10px] tracking-widest flex items-center justify-center gap-2"
                >
                  <Printer size={14} />
                  CETAK NOTA
                </button>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      <AlertModal 
        show={alertConfig.show} 
        title={alertConfig.title} 
        message={alertConfig.message} 
        type={alertConfig.type} 
        onClose={() => setAlertConfig(prev => ({ ...prev, show: false }))} 
      />
    </div>
  );
}
