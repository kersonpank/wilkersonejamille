import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import { Gift } from './GiftCard';
import { initMercadoPago, Payment } from '@mercadopago/sdk-react';

// Initialize Mercado Pago with the provided Public Key
initMercadoPago(import.meta.env.VITE_MERCADOPAGO_PUBLIC_KEY);

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  cartItems: Gift[];
  onSubmit: (data: { name: string; message: string; method: string; paymentId: string; status: string; netAmount?: number | null }) => void;
}

export function CheckoutModal({ isOpen, onClose, cartItems, onSubmit }: CheckoutModalProps) {
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [isPaymentReady, setIsPaymentReady] = useState(false);

  const total = cartItems.reduce((acc, item) => acc + item.price, 0);

  const handlePaymentSubmit = async (param: any) => {
    return new Promise<void>((resolve, reject) => {
      fetch("/api/process_payment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(param.formData),
      })
        .then((response) => response.json())
        .then((response) => {
          if (response.error) {
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
            resolve();
          }
        })
        .catch((error) => {
          console.error(error);
          reject();
        });
    });
  };

  const onError = async (error: any) => {
    console.error(error);
  };

  const onReady = async () => {
    setIsPaymentReady(true);
  };

  const initialization = {
    amount: total,
  };

  const customization = {
    paymentMethods: {
      creditCard: "all",
      debitCard: "all",
      bankTransfer: "all",
      mercadoPago: "all",
    },
    visual: {
      style: {
        theme: "default",
      },
    },
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
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
                <h2 className="font-serif text-2xl text-[var(--color-ink)]">Finalizar Presente</h2>
                <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                  <X className="w-5 h-5 text-[var(--color-ink-light)]" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto flex-1">
                <div className="mb-8 bg-[var(--color-nude)] p-4 rounded-2xl border border-[var(--color-nude-dark)]">
                  <p className="text-sm text-[var(--color-ink-light)] mb-2">Resumo ({cartItems.length} itens)</p>
                  <div className="flex justify-between items-end">
                    <span className="font-serif text-3xl text-[var(--color-sage-dark)]">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(total)}
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
                      initialization={initialization}
                      customization={customization as any}
                      onSubmit={handlePaymentSubmit}
                      onReady={onReady}
                      onError={onError}
                    />
                  </div>
                ) : (
                  <div className="text-center p-4 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                    <p className="text-sm text-gray-500">Preencha seu nome para prosseguir com o pagamento.</p>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
