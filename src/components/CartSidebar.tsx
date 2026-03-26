import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Trash2, Plus, ChevronDown } from 'lucide-react';
import { Gift } from './GiftCard';

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

interface CartSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  cartItems: Gift[];
  onRemove: (id: string) => void;
  onCheckout: () => void;
  partialSelections: Record<string, number>;
  onPartialChange: (giftId: string, parts: number) => void;
}

export function CartSidebar({ isOpen, onClose, cartItems, onRemove, onCheckout, partialSelections, onPartialChange }: CartSidebarProps) {
  const [expandedPartial, setExpandedPartial] = useState<string | null>(null);

  const effectivePrice = (item: Gift) => {
    const sel = partialSelections[item.id];
    if (item.allowPartial && item.totalParts && sel && sel > 0) {
      return (item.price / item.totalParts) * sel;
    }
    return item.price;
  };

  const total = cartItems.reduce((acc, item) => acc + effectivePrice(item), 0);

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

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {cartItems.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-4 text-[var(--color-ink-light)]">
                  <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm">
                    <span className="text-2xl">🎁</span>
                  </div>
                  <p>Seu carrinho está vazio.</p>
                </div>
              ) : (
                cartItems.map((item) => {
                  const sel = partialSelections[item.id];
                  const isPartial = !!(sel && sel > 0);
                  const hasPartialOption = !!(item.allowPartial && item.totalParts && item.totalParts > 1);
                  const isExpanded = expandedPartial === item.id;

                  return (
                    <div key={item.id} className="bg-white rounded-xl shadow-sm border border-[var(--color-nude-dark)] overflow-hidden">
                      <div className="flex gap-4 p-4">
                        <div className="w-20 h-20 rounded-lg overflow-hidden bg-gray-50 shrink-0">
                          <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        </div>
                        <div className="flex-1 flex flex-col justify-between min-w-0">
                          <div>
                            <h4 className="font-medium text-[var(--color-ink)] line-clamp-2 text-sm">{item.title}</h4>
                            <p className="text-[var(--color-sage-dark)] font-medium mt-1">
                              {fmt(effectivePrice(item))}
                              {isPartial && (
                                <span className="ml-1.5 text-xs text-[var(--color-ink-light)] font-normal">
                                  ({sel}/{item.totalParts} partes)
                                </span>
                              )}
                            </p>
                            {isPartial && (
                              <p className="text-xs text-[var(--color-ink-light)] line-through mt-0.5">
                                {fmt(item.price)}
                              </p>
                            )}
                          </div>
                          <button
                            onClick={() => onRemove(item.id)}
                            className="text-xs text-red-400 hover:text-red-600 self-start flex items-center gap-1 mt-2 transition-colors"
                          >
                            <Trash2 className="w-3 h-3" /> Remover
                          </button>
                        </div>
                      </div>

                      {/* Partial option — only for eligible items */}
                      {hasPartialOption && (
                        <div className="border-t border-[var(--color-nude-dark)]">
                          {!isExpanded ? (
                            <button
                              onClick={() => setExpandedPartial(item.id)}
                              className="w-full flex items-center gap-1.5 px-4 py-2.5 text-xs text-[var(--color-ink-light)] hover:text-[var(--color-sage-dark)] hover:bg-[var(--color-nude)] transition-colors"
                            >
                              <ChevronDown className="w-3.5 h-3.5 shrink-0" />
                              {isPartial
                                ? `Alterar: presenteando ${sel}/${item.totalParts} partes`
                                : 'Prefere contribuir com uma parte deste presente?'}
                            </button>
                          ) : (
                            <div className="p-3 bg-[var(--color-nude)]/60 space-y-1.5">
                              <p className="text-xs font-medium text-[var(--color-ink)] mb-2">
                                Quantas partes deseja presentear?
                              </p>

                              {/* Full gift */}
                              <button
                                onClick={() => { onPartialChange(item.id, 0); setExpandedPartial(null); }}
                                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs border transition-colors ${
                                  !isPartial
                                    ? 'border-[var(--color-sage)] bg-[var(--color-sage)]/10 text-[var(--color-sage-dark)] font-medium'
                                    : 'border-[var(--color-nude-dark)] bg-white hover:border-[var(--color-sage)] text-[var(--color-ink)]'
                                }`}
                              >
                                <span>Presente completo</span>
                                <span className="font-medium">{fmt(item.price)}</span>
                              </button>

                              {/* Partial options */}
                              {Array.from({ length: item.totalParts! - 1 }, (_, i) => i + 1).map((n) => {
                                const partPrice = (item.price / item.totalParts!) * n;
                                const isSelected = sel === n;
                                return (
                                  <button
                                    key={n}
                                    onClick={() => { onPartialChange(item.id, n); setExpandedPartial(null); }}
                                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs border transition-colors ${
                                      isSelected
                                        ? 'border-[var(--color-sage)] bg-[var(--color-sage)]/10 text-[var(--color-sage-dark)] font-medium'
                                        : 'border-[var(--color-nude-dark)] bg-white hover:border-[var(--color-sage)] text-[var(--color-ink)]'
                                    }`}
                                  >
                                    <span>{n}/{item.totalParts} {n === 1 ? 'parte' : 'partes'}</span>
                                    <span className="font-medium">{fmt(partPrice)}</span>
                                  </button>
                                );
                              })}

                              <button
                                onClick={() => setExpandedPartial(null)}
                                className="w-full text-center text-xs text-[var(--color-ink-light)] hover:text-[var(--color-ink)] py-1 transition-colors"
                              >
                                Cancelar
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {cartItems.length > 0 && (
              <div className="p-6 bg-white border-t border-[var(--color-nude-dark)] shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
                <div className="flex justify-between items-center mb-5">
                  <span className="text-[var(--color-ink-light)]">Subtotal</span>
                  <span className="font-serif text-2xl text-[var(--color-ink)]">
                    {fmt(total)}
                  </span>
                </div>

                {cartItems.length === 1 && (
                  <p className="text-xs text-[var(--color-ink-light)] text-center mb-3 leading-relaxed">
                    Cada presente faz parte da nossa história. 💛<br />
                    <span className="text-[var(--color-sage-dark)]">Quer tornar esse momento ainda mais especial?</span>
                  </p>
                )}

                <button
                  onClick={onClose}
                  className="w-full py-3 mb-3 flex items-center justify-center gap-2 rounded-full border border-[var(--color-nude-dark)] text-[var(--color-ink)] text-sm font-medium hover:border-[var(--color-sage)] hover:text-[var(--color-sage-dark)] transition-colors bg-[var(--color-nude)]"
                >
                  <Plus className="w-4 h-4" />
                  Adicionar outro presente
                </button>

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
