import React, { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, query, orderBy, runTransaction, doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Item, Supplier } from '../types';
import { Plus, Search, Package, Truck, Tag, DollarSign, Box } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function Inventory() {
  const [activeTab, setActiveTab] = useState<'items' | 'suppliers'>('items');
  const [items, setItems] = useState<Item[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // New Item State
  const [newItem, setNewItem] = useState<Partial<Item>>({
    name: '',
    category: 'Sembako',
    unit: 'kg',
    price: 0,
    stock: 0,
  });

  // New Supplier State
  const [newSupplier, setNewSupplier] = useState<Partial<Supplier>>({
    name: '',
    phone: '',
    address: ''
  });

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'items') {
        const q = query(collection(db, 'items'), orderBy('name', 'asc'));
        const snapshot = await getDocs(q);
        setItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Item)));
      } else {
        const q = query(collection(db, 'suppliers'), orderBy('name', 'asc'));
        const snapshot = await getDocs(q);
        setSuppliers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Supplier)));
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (activeTab === 'items') {
        if (editingId) {
          await updateDoc(doc(db, 'items', editingId), newItem);
        } else {
          await addDoc(collection(db, 'items'), newItem);
        }
      } else {
        if (editingId) {
          await updateDoc(doc(db, 'suppliers', editingId), newSupplier);
        } else {
          await addDoc(collection(db, 'suppliers'), newSupplier);
        }
      }
      setShowAddModal(false);
      setEditingId(null);
      fetchData();
      setNewItem({ name: '', category: 'Sembako', unit: 'kg', price: 0, stock: 0 });
      setNewSupplier({ name: '', phone: '', address: '' });
    } catch (error) {
       alert("Gagal menyimpan data: " + (error instanceof Error ? error.message : "Error"));
    } finally {
      setLoading(false);
    }
  };

  const openEdit = (data: any) => {
    setEditingId(data.id);
    if (activeTab === 'items') {
      setNewItem({
        name: data.name,
        category: data.category,
        unit: data.unit,
        price: data.price,
        stock: data.stock,
      });
    } else {
      setNewSupplier({
        name: data.name,
        phone: data.phone,
        address: data.address,
      });
    }
    setShowAddModal(true);
  };

  const [showRestockModal, setShowRestockModal] = useState(false);
  const [restockData, setRestockData] = useState({ itemId: '', qty: 0, supplierId: '', price: 0 });

  const handleRestock = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await runTransaction(db, async (transaction) => {
        const itemRef = doc(db, 'items', restockData.itemId);
        const itemDoc = await transaction.get(itemRef);
        if (!itemDoc.exists()) throw new Error("Item not found");
        
        const newStock = (itemDoc.data().stock || 0) + restockData.qty;
        transaction.update(itemRef, { stock: newStock });
        
        const txnRef = doc(collection(db, 'transactions'));
        transaction.set(txnRef, {
          date: new Date().toISOString(),
          type: 'purchase',
          paymentMethod: 'cash',
          supplierId: restockData.supplierId,
          totalAmount: restockData.price * restockData.qty,
          items: [{ itemId: restockData.itemId, qty: restockData.qty, price: restockData.price }]
        });
      });
      setShowRestockModal(false);
      fetchData();
    } catch (error) {
      alert("Gagal restock: " + (error instanceof Error ? error.message : "Error"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <span className="font-serif italic text-sm opacity-50 block mb-1">Manajemen Stok</span>
          <h1 className="text-3xl sm:text-4xl font-serif italic tracking-tight">Inventaris & Supplier</h1>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <button 
            onClick={() => setShowRestockModal(true)}
            className="flex items-center justify-center gap-2 border border-[#141414] text-[#141414] px-6 py-3 rounded-full font-mono text-[10px] tracking-widest hover:bg-[#141414] hover:text-white transition-all shadow-sm order-2 sm:order-1"
          >
            <Truck size={16} />
            RESTOCK
          </button>
          <button 
            onClick={() => {
              setEditingId(null);
              setNewItem({ name: '', category: 'Sembako', unit: 'kg', price: 0, stock: 0 });
              setNewSupplier({ name: '', phone: '', address: '' });
              setShowAddModal(true);
            }}
            className="flex items-center justify-center gap-2 bg-[#141414] text-[#E4E3E0] px-6 py-3 rounded-full font-mono text-[10px] tracking-widest hover:scale-105 transition-all shadow-lg order-1 sm:order-2"
          >
            <Plus size={16} />
            {activeTab === 'items' ? 'TAMBAH BARANG' : 'TAMBAH SUPPLIER'}
          </button>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="flex border-b border-[#141414]">
        <button 
          onClick={() => setActiveTab('items')}
          className={`px-8 py-4 font-serif italic text-lg transition-all relative ${
            activeTab === 'items' ? 'text-[#141414] opacity-100' : 'text-stone-400 opacity-50 hover:opacity-100'
          }`}
        >
          Daftar Barang
          {activeTab === 'items' && <motion.div layoutId="underline" className="absolute bottom-0 left-0 right-0 h-1 bg-[#141414]" />}
        </button>
        <button 
          onClick={() => setActiveTab('suppliers')}
          className={`px-8 py-4 font-serif italic text-lg transition-all relative ${
            activeTab === 'suppliers' ? 'text-[#141414] opacity-100' : 'text-stone-400 opacity-50 hover:opacity-100'
          }`}
        >
          Daftar Supplier
          {activeTab === 'suppliers' && <motion.div layoutId="underline" className="absolute bottom-0 left-0 right-0 h-1 bg-[#141414]" />}
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
          <input 
            type="text" 
            placeholder={`Cari ${activeTab === 'items' ? 'nama barang' : 'nama supplier'}...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white border border-[#141414] rounded-xl py-3 pl-12 pr-4 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-[#141414]"
          />
        </div>
      </div>

      {/* Grid Content */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {loading ? (
          [...Array(4)].map((_, i) => (
            <div key={i} className="h-48 bg-white border border-[#141414] rounded-xl animate-pulse" />
          ))
        ) : activeTab === 'items' ? (
          items.map(item => (
            <motion.div 
              layout
              key={item.id} 
              className="bg-white border border-[#141414] rounded-xl p-6 relative group hover:bg-[#141414] hover:text-white transition-colors"
            >
              <button 
                onClick={(e) => { e.stopPropagation(); openEdit(item); }}
                className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity bg-white text-[#141414] px-2 py-1 rounded text-[8px] font-mono border border-[#141414]"
              >
                EDIT
              </button>
              <div className="absolute top-4 left-4 text-[10px] font-mono opacity-40 uppercase">{item.category}</div>
              <div className="mb-4 mt-6">
                <Box size={24} className="mb-2" />
                <h3 className="font-bold text-lg leading-tight uppercase font-serif italic">{item.name}</h3>
                <p className="text-[10px] font-mono opacity-50 uppercase mt-1">Stok: {item.stock} {item.unit}</p>
              </div>
              <div className="pt-4 border-t border-dashed border-[#141414] group-hover:border-white/20 mt-auto">
                <p className="text-xl font-mono tracking-tighter">Rp {item.price?.toLocaleString('id-ID')}</p>
              </div>
            </motion.div>
          ))
        ) : (
          suppliers.map(supplier => (
            <motion.div 
              layout
              key={supplier.id} 
              className="bg-white border border-[#141414] rounded-xl p-6 relative group hover:bg-[#141414] hover:text-white transition-colors"
            >
              <button 
                onClick={(e) => { e.stopPropagation(); openEdit(supplier); }}
                className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity bg-white text-[#141414] px-2 py-1 rounded text-[8px] font-mono border border-[#141414]"
              >
                EDIT
              </button>
              <Truck size={24} className="mb-4 mt-4" />
              <h3 className="font-bold text-lg leading-tight uppercase font-serif italic mb-2">{supplier.name}</h3>
              <div className="space-y-1 opacity-60 font-mono text-[10px]">
                <p>{supplier.phone || 'No Phone'}</p>
                <p className="truncate">{supplier.address || 'No Address'}</p>
              </div>
            </motion.div>
          ))
        )}
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
              <div className="p-8 border-b border-[#141414] bg-white text-[#141414]">
                <h2 className="font-serif italic text-2xl">
                  {editingId ? (activeTab === 'items' ? 'Edit Barang' : 'Edit Supplier') : (activeTab === 'items' ? 'Input Barang Baru' : 'Daftarkan Supplier')}
                </h2>
              </div>
              <form onSubmit={handleAdd} className="p-8 space-y-6">
                {activeTab === 'items' ? (
                  <>
                    <div className="space-y-2">
                      <label className="text-[10px] font-mono uppercase opacity-60">Nama Barang</label>
                      <input 
                        required
                        type="text" 
                        value={newItem.name}
                        onChange={e => setNewItem({...newItem, name: e.target.value})}
                        className="w-full bg-white border border-[#141414] rounded-xl px-4 py-3"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-mono uppercase opacity-60">Harga Jual</label>
                        <input 
                          required
                          type="number" 
                          value={newItem.price}
                          onChange={e => setNewItem({...newItem, price: Number(e.target.value)})}
                          className="w-full bg-white border border-[#141414] rounded-xl px-4 py-3 font-mono"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-mono uppercase opacity-60">Stok Awal</label>
                        <input 
                          required
                          type="number" 
                          value={newItem.stock}
                          onChange={e => setNewItem({...newItem, stock: Number(e.target.value)})}
                          className="w-full bg-white border border-[#141414] rounded-xl px-4 py-3 font-mono"
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="space-y-2">
                      <label className="text-[10px] font-mono uppercase opacity-60">Nama Perusahaan/Supplier</label>
                      <input 
                        required
                        type="text" 
                        value={newSupplier.name}
                        onChange={e => setNewSupplier({...newSupplier, name: e.target.value})}
                        className="w-full bg-white border border-[#141414] rounded-xl px-4 py-3"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-mono uppercase opacity-60">Kontak Person / Telepon</label>
                      <input 
                        type="text" 
                        value={newSupplier.phone}
                        onChange={e => setNewSupplier({...newSupplier, phone: e.target.value})}
                        className="w-full bg-white border border-[#141414] rounded-xl px-4 py-3 font-mono"
                      />
                    </div>
                  </>
                )}
                <div className="flex gap-4 pt-4">
                  <button 
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 py-4 border border-[#141414] rounded-xl font-mono text-[10px]"
                  >
                    BATAL
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 py-4 bg-[#141414] text-[#E4E3E0] rounded-xl font-mono text-[10px]"
                  >
                    SIMPAN DATA
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Restock Modal */}
      <AnimatePresence>
        {showRestockModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-[#141414]/40 backdrop-blur-sm" onClick={() => setShowRestockModal(false)} />
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-white max-w-lg w-full rounded-2xl shadow-2xl border border-[#141414] z-10 overflow-hidden">
              <div className="p-8 border-b border-[#141414] bg-[#141414] text-white">
                <h2 className="font-serif italic text-2xl">Restock / Pembelian Barang</h2>
                <p className="text-[10px] font-mono opacity-50 uppercase mt-1">Stok akan bertambah otomatis dan tercatat di Log Transaksi</p>
              </div>
              <form onSubmit={handleRestock} className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-mono uppercase opacity-60">Pilih Barang</label>
                  <select required value={restockData.itemId} onChange={e => setRestockData({...restockData, itemId: e.target.value})} className="w-full border border-[#141414] rounded-xl p-3">
                    <option value="">Pilih...</option>
                    {items.map(i => <option key={i.id} value={i.id}>{i.name} (Stok: {i.stock})</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-mono uppercase opacity-60">Jumlah Masuk</label>
                    <input required type="number" value={restockData.qty} onChange={e => setRestockData({...restockData, qty: Number(e.target.value)})} className="w-full border border-[#141414] rounded-xl p-3 font-mono" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-mono uppercase opacity-60">Harga Beli p/Unit</label>
                    <input required type="number" value={restockData.price} onChange={e => setRestockData({...restockData, price: Number(e.target.value)})} className="w-full border border-[#141414] rounded-xl p-3 font-mono" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-mono uppercase opacity-60">Supplier</label>
                  <select required value={restockData.supplierId} onChange={e => setRestockData({...restockData, supplierId: e.target.value})} className="w-full border border-[#141414] rounded-xl p-3">
                    <option value="">Pilih Supplier...</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <button type="submit" className="w-full bg-[#141414] text-white py-4 rounded-xl font-mono text-[10px] tracking-widest mt-4">
                  PROSES PEMBELIAN
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
