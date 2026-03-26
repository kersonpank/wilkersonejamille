import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, CheckCircle, ChevronDown } from 'lucide-react';
import { Gift } from './GiftCard';
import { initMercadoPago, Payment, StatusScreen } from '@mercadopago/sdk-react';

initMercadoPago(import.meta.env.VITE_MERCADOPAGO_PUBLIC_KEY, { locale: 'pt-BR' });

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  cartItems: Gift[];
  onSubmit: (data: {
    name: string;
    message: string;
    method: string;
    paymentId: string;
    status: string;
    netAmount?: number | null;
  }) => void;
  partialSelections: Record<string, number>;
  onPartialChange: (giftId: string, parts: number) => void;
}

export function CheckoutModal({ isOpen, onClose, cartItems, onSubmit, partialSelections, onPartialChange }: CheckoutModalProps) {
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [confirmedPaymentId, setConfirmedPaymentId] = useState<string | null>(null);
  const [confirmedStatus, setConfirmedStatus] = useState<string>('');
  const [expandedPartial, setExpandedPartial] = useState<string | null>(null);

  const effectivePrice = (item: Gift) => {
    const sel = partialSelections[item.id];
    if (item.allowPartial && item.totalParts && sel && sel > 0) {
      return (item.price / item.totalParts) * sel;
    }
    return item.price;
  };

  const total = cartItems.reduce((acc, item) => acc + effectivePrice(item), 0);

  const handleClose = () => {
    setConfirmedPaymentId(null);
    setConfirmedStatus('');
    setName('');
    setMessage('');
    setExpandedPartial(null);
    onClose();
  };

  const handlePaymentSubmit = async (param: any) => {
    return new Promise<void>((resolve, reject) => {
      fetch("/api/process_payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(param.formData),
      })
        .then((res) => res.json())
        .then((response) => {
          if (response.error) {
            console.error("Payment error:", response.detail);
            reject();
          } else {
            onSubmit({
              name,
              message,
              method: param.formData.payment_method_id,
              paymentId: String(response.id),
              status: response.status,
              netAmount: response.net_received_amount ?? null,
            });
            setConfirmedPaymentId(String(response.id));
            setConfirmedStatus(response.status);
            resolve();
          }
        })
        .catch((error) => {
          console.error(error);
          reject();
        });
    });
  };

  const initialization = { amount: total };

  const customization = {
    paymentMethods: {
      creditCard: "all",
      debitCard: "all",
      bankTransfer: "all",
      mercadoPago: "all",
    },
    visual: { style: { theme: "default" } },
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={confirmedPaymentId ? undefined : handleClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-md z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="flex items-center justify-between p-6 border-b border-[var(--color-nude-dark)]">
                <h2 className="font-serif text-2xl text-[var(--color-ink)]">
                  {confirmedPaymentId ? 'Status do Pagamento' : 'Finalizar Presente'}
                </h2>
                <button onClick={handleClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                  <X className="w-5 h-5 text-[var(--color-ink-light)]" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto flex-1">
                {confirmedPaymentId ? (
                  <div>
                    <StatusScreen
                      initialization={{ paymentId: confirmedPaymentId }}
                      onReady={() => {}}
                      onError={(error) => console.error('StatusScreen error:', error)}
                    />
                    <button
                      onClick={handleClose}
                      className="w-full mt-4 py-3 bg-[var(--color-ink)] text-white rounded-full font-medium hover:bg-black transition-colors flex items-center justify-center gap-2"
                    >
                      <CheckCircle className="w-4 h-4" />
                      {confirmedStatus === 'approved' ? 'Pagamento confirmado — Fechar' : 'Fechar'}
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Summary */}
                    <div className="mb-6 bg-[var(--color-nude)] p-4 rounded-2xl border border-[var(--color-nude-dark)] space-y-3">
                      <p className="text-sm text-[var(--color-ink-light)]">Resumo ({cartItems.length} {cartItems.length === 1 ? 'item' : 'itens'})</p>

                      {cartItems.map((item) => {
                        const sel = partialSelections[item.id];
                        const isPartial = !!(sel && sel > 0);
                        const hasPartialOption = !!(item.allowPartial && item.totalParts && item.totalParts > 1);
                        const isExpanded = expandedPartial === item.id;

                        return (
                          <div key={item.id}>
                            <div className="flex items-start justify-between gap-2">
                              <span className="text-sm text-[var(--color-ink)] line-clamp-1 flex-1">{item.title}</span>
                              <span className="text-sm font-medium text-[var(--color-sage-dark)] shrink-0">
                                {fmt(effectivePrice(item))}
                                {isPartial && (
                                  <span className="ml-1 text-xs text-[var(--color-ink-light)]">
                                    ({sel}/{item.totalParts})
                                  </span>
                                )}
                              </span>
                            </div>

                            {/* Partial option button — only for eligible items */}
                            {hasPartialOption && (
                              <div className="mt-1.5">
                                {!isExpanded ? (
                                  <button
                                    onClick={() => setExpandedPartial(item.id)}
                                    className="text-xs text-[var(--color-ink-light)] hover:text-[var(--color-sage-dark)] flex items-center gap-1 transition-colors"
                                  >
                                    <ChevronDown className="w-3 h-3" />
                                    {isPartial
                                      ? `Alterar contribuição parcial`
                                      : `Contribuir com uma parte deste presente`}
                                  </button>
                                ) : (
                                  <div className="mt-2 p-3 bg-white rounded-xl border border-[var(--color-nude-dark)] space-y-1.5">
                                    <p className="text-xs font-medium text-[var(--color-ink)] mb-2">
                                      Escolha quantas partes deseja presentear:
                                    </p>

                                    {/* Full gift option */}
                                    <button
                                      onClick={() => { onPartialChange(item.id, 0); setExpandedPartial(null); }}
                                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm border transition-colors ${
                                        !isPartial
                                          ? 'border-[var(--color-sage)] bg-[var(--color-sage)]/10 text-[var(--color-sage-dark)] font-medium'
                                          : 'border-[var(--color-nude-dark)] hover:border-[var(--color-sage)] text-[var(--color-ink)]'
                                      }`}
                                    >
                                      <span>Presente completo</span>
                                      <span className="font-medium">{fmt(item.price)}</span>
                                    </button>

                                    {/* Partial options: 1 to totalParts-1 */}
                                    {Array.from({ length: item.totalParts! - 1 }, (_, i) => i + 1).map((n) => {
                                      const partPrice = (item.price / item.totalParts!) * n;
                                      const isSelected = sel === n;
                                      return (
                                        <button
                                          key={n}
                                          onClick={() => { onPartialChange(item.id, n); setExpandedPartial(null); }}
                                          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm border transition-colors ${
                                            isSelected
                                              ? 'border-[var(--color-sage)] bg-[var(--color-sage)]/10 text-[var(--color-sage-dark)] font-medium'
                                              : 'border-[var(--color-nude-dark)] hover:border-[var(--color-sage)] text-[var(--color-ink)]'
                                          }`}
                                        >
                                          <span>{n}/{item.totalParts} {n === 1 ? 'parte' : 'partes'}</span>
                                          <span className="font-medium">{fmt(partPrice)}</span>
                                        </button>
                                      );
                                    })}

                                    <button
                                      onClick={() => setExpandedPartial(null)}
                                      className="w-full text-xs text-center text-[var(--color-ink-light)] hover:text-[var(--color-ink)] py-1 transition-colors"
                                    >
                                      Cancelar
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}

                      <div className="flex justify-between items-end pt-2 border-t border-[var(--color-nude-dark)]">
                        <span className="text-sm text-[var(--color-ink-light)]">Total</span>
                        <span className="font-serif text-3xl text-[var(--color-sage-dark)]">
                          {fmt(total)}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-6 mb-8">
                      <div>
                        <label htmlFor="name" className="block text-sm font-medium text-[var(--color-ink)] mb-2">
                          Seu Nome *
                        </label>
                        <input
                          type="text"
                          id="name"
                          required
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className="w-full px-4 py-3 rounded-xl border border-[var(--color-nude-dark)] focus:outline-none focus:ring-2 focus:ring-[var(--color-sage)] bg-gray-50/50 transition-all"
                          placeholder="Como os noivos devem te chamar?"
                        />
                      </div>

                      <div>
                        <label htmlFor="message" className="block text-sm font-medium text-[var(--color-ink)] mb-2">
                          Deixe uma mensagem para Wilkerson & Jamille
                        </label>
                        <textarea
                          id="message"
                          rows={3}
                          value={message}
                          onChange={(e) => setMessage(e.target.value)}
                          className="w-full px-4 py-3 rounded-xl border border-[var(--color-nude-dark)] focus:outline-none focus:ring-2 focus:ring-[var(--color-sage)] bg-gray-50/50 transition-all resize-none"
                          placeholder="Deseje felicidades ao casal..."
                        />
                      </div>
                    </div>

                    {name.trim() ? (
                      <div className="mt-4">
                        <Payment
                          key={total}
                          initialization={initialization}
                          customization={customization as any}
                          onSubmit={handlePaymentSubmit}
                          onReady={() => {}}
                          onError={(error) => console.error(error)}
                        />
                      </div>
                    ) : (
                      <div className="text-center p-4 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                        <p className="text-sm text-gray-500">Preencha seu nome para prosseguir com o pagamento.</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
