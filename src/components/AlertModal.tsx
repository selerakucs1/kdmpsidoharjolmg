import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle, X, AlertTriangle, Loader2 } from 'lucide-react';

interface AlertModalProps {
  show: boolean;
  title: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  onClose: () => void;
}

export default function AlertModal({ show, title, message, type, onClose }: AlertModalProps) {
  return (
    <AnimatePresence>
      {show && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#141414]/60 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="bg-white rounded-[2rem] p-8 max-w-sm w-full border-2 border-[#141414] shadow-2xl text-center relative overflow-hidden"
          >
            <div className={`w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 ${
              type === 'success' ? 'bg-green-50 text-green-600' :
              type === 'error' ? 'bg-red-50 text-red-600' :
              type === 'warning' ? 'bg-amber-50 text-amber-600' :
              'bg-blue-50 text-blue-600'
            }`}>
              {type === 'success' ? <CheckCircle size={40} /> : 
               type === 'error' ? <X size={40} /> : 
               type === 'warning' ? <AlertTriangle size={40} /> :
               <Loader2 size={40} />}
            </div>
            <h3 className="font-serif italic text-2xl mb-2 text-[#141414]">{title}</h3>
            <p className="text-stone-500 text-xs mb-8 leading-relaxed font-medium px-4">{message}</p>
            <button 
              onClick={onClose}
              className="w-full py-4 bg-[#141414] text-white rounded-2xl font-mono text-[10px] tracking-widest shadow-xl hover:bg-stone-800 transition-all uppercase font-bold"
            >
              Mengerti
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
