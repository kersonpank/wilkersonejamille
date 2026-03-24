import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Trash2 } from 'lucide-react';
import { Gift } from './GiftCard';

interface CartSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  cartItems: Gift[];
  onRemove: (id: string) => void;
  onCheckout: () => void;
}

export function CartSidebar({ isOpen, onClose, cartItems, onRemove, onCheckout }: CartSidebarProps) {
  const total = cartItems.reduce((acc, item) => acc + item.price, 0);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 h-full w-full max-w-md bg-[var(--color-nude)] shadow-2xl z-50 flex flex-col border-l border-[var(--color-nude-dark)]"
          >
            <div className="flex items-center justify-between p-6 border-b border-[var(--color-nude-dark)] bg-white">
              <h2 className="font-serif text-2xl text-[var(--color-ink)]">Seus Presentes</h2>
              <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                <X className="w-5 h-5 text-[var(--color-ink-light)]" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {cartItems.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-4 text-[var(--color-ink-light)]">
                  <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm">
                    <span className="text-2xl">🎁</span>
                  </div>
                  <p>Seu carrinho está vazio.</p>
                </div>
              ) : (
                cartItems.map((item) => (
                  <div key={item.id} className="flex gap-4 bg-white p-4 rounded-xl shadow-sm border border-[var(--color-nude-dark)]">
                    <div className="w-20 h-20 rounded-lg overflow-hidden bg-gray-50 shrink-0">
                      <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </div>
                    <div className="flex-1 flex flex-col justify-between">
                      <div>
                        <h4 className="font-medium text-[var(--color-ink)] line-clamp-2 text-sm">{item.title}</h4>
                        <p className="text-[var(--color-sage-dark)] font-medium mt-1">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.price)}
                        </p>
                      </div>
                      <button
                        onClick={() => onRemove(item.id)}
                        className="text-xs text-red-400 hover:text-red-600 self-start flex items-center gap-1 mt-2 transition-colors"
                      >
                        <Trash2 className="w-3 h-3" /> Remover
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {cartItems.length > 0 && (
              <div className="p-6 bg-white border-t border-[var(--color-nude-dark)] shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
                <div className="flex justify-between items-center mb-6">
                  <span className="text-[var(--color-ink-light)]">Subtotal</span>
                  <span className="font-serif text-2xl text-[var(--color-ink)]">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(total)}
                  </span>
                </div>
                <button
                  onClick={onCheckout}
                  className="w-full py-4 bg-[var(--color-ink)] text-white rounded-full font-medium tracking-wide hover:bg-black transition-colors"
                >
                  Avançar para Checkout
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
