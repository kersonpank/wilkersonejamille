import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { GiftCard, Gift } from '../components/GiftCard';
import { CartSidebar } from '../components/CartSidebar';
import { CheckoutModal } from '../components/CheckoutModal';
import { toast } from 'sonner';
import { ShoppingBag } from 'lucide-react';
import { Link } from 'react-router-dom';

export function Gifts() {
  const [gifts, setGifts] = useState<Gift[]>([]);
  const [cart, setCart] = useState<Gift[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'gifts'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetchedGifts = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Gift[];
        setGifts(fetchedGifts);
        setLoading(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'gifts');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const handleSelectGift = (gift: Gift) => {
    if (cart.find((item) => item.id === gift.id)) {
      toast.info('Este presente já está no seu carrinho.');
      return;
    }
    setCart([...cart, gift]);
    setIsCartOpen(true);
  };

  const handleRemoveFromCart = (id: string) => {
    setCart(cart.filter((item) => item.id !== id));
  };

  const handleCheckoutSubmit = async (data: { name: string; message: string; method: string; paymentId: string; status: string; netAmount?: number | null; amounts?: Record<string, number> }) => {
    try {
      for (const item of cart) {
        const contribution: Record<string, any> = {
          giftId: item.id,
          guestName: data.name,
          message: data.message,
          amount: data.amounts?.[item.id] ?? item.price,
          paymentMethod: data.method,
          paymentId: data.paymentId,
          status: data.status,
          createdAt: serverTimestamp(),
        };
        if (data.netAmount != null) contribution.netAmount = data.netAmount;
        await addDoc(collection(db, 'contributions'), contribution);
      }

      toast.success('Obrigado pelo presente! Sua contribuição foi registrada com sucesso.', {
        duration: 5000,
      });

      // Se o pagamento já veio aprovado (PIX imediato, alguns cartões),
      // dispara a notificação direto — sem depender do webhook assíncrono do Mercado Pago
      if (data.status === 'approved') {
        fetch('/api/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paymentId: data.paymentId }),
        }).catch(() => { /* falha silenciosa — não afeta o fluxo do usuário */ });
      }

      setCart([]);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'contributions');
    }
  };

  return (
    <div className="min-h-screen bg-[var(--color-nude)] flex flex-col">
      {/* Header / Nav */}
      <header className="fixed top-0 left-0 right-0 z-30 bg-[var(--color-nude)]/80 backdrop-blur-md border-b border-[var(--color-nude-dark)]">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link to="/" className="font-serif text-2xl tracking-wide text-[var(--color-ink)]">W & J</Link>
          
          <nav className="hidden md:flex items-center gap-8">
            <Link to="/" className="text-[var(--color-ink)] hover:text-[var(--color-sage-dark)] font-medium transition-colors">Home</Link>
            <Link to="/presentes" className="text-[var(--color-sage-dark)] font-medium transition-colors">Lista de Presentes</Link>
          </nav>

          <button
            onClick={() => setIsCartOpen(true)}
            className="relative p-2 text-[var(--color-ink)] hover:text-[var(--color-sage-dark)] transition-colors"
          >
            <ShoppingBag className="w-6 h-6" />
            {cart.length > 0 && (
              <span className="absolute top-0 right-0 w-5 h-5 bg-[var(--color-terracotta)] text-white text-xs rounded-full flex items-center justify-center transform translate-x-1 -translate-y-1">
                {cart.length}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow pt-24 pb-16 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-10 sm:mb-16">
            <h2 className="font-serif text-3xl lg:text-5xl text-[var(--color-ink)] mb-4">Lista de Presentes</h2>
            <p className="text-base sm:text-lg text-[var(--color-ink-light)] max-w-2xl mx-auto">
              Escolha um item com carinho para nos presentear e fazer parte da construção do nosso lar.
            </p>
          </div>

          {loading ? (
            <div className="flex justify-center py-20">
              <div className="w-8 h-8 border-4 border-[var(--color-sage)] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : gifts.length === 0 ? (
            <div className="text-center py-20 text-[var(--color-ink-light)]">
              <p>A lista de presentes está sendo preparada.</p>
              <p>Volte em breve!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
              {gifts.map((gift) => (
                <GiftCard key={gift.id} gift={gift} onSelect={handleSelectGift} />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="py-12 bg-white text-center border-t border-[var(--color-nude-dark)] mt-auto">
        <p className="font-serif text-2xl text-[var(--color-ink)] mb-4">W & J</p>
        <p className="text-sm text-[var(--color-ink-light)]">
          Com amor, Wilkerson & Jamille.
        </p>
      </footer>

      <CartSidebar
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cartItems={cart}
        onRemove={handleRemoveFromCart}
        onCheckout={() => {
          setIsCartOpen(false);
          setIsCheckoutOpen(true);
        }}
      />

      <CheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => { setIsCheckoutOpen(false); setIsCartOpen(false); }}
        cartItems={cart}
        onSubmit={handleCheckoutSubmit}
      />
    </div>
  );
}
