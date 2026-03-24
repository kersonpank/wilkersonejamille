import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy, addDoc, serverTimestamp, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db, auth, loginWithGoogle, logout, handleFirestoreError, OperationType } from '../lib/firebase';
import { Gift } from '../components/GiftCard';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { Link2, Plus, Trash2, LogOut, Image as ImageIcon } from 'lucide-react';
import { GoogleGenAI, Type } from '@google/genai';

export function Admin() {
  const [user, setUser] = useState(auth.currentUser);
  const [gifts, setGifts] = useState<Gift[]>([]);
  const [loading, setLoading] = useState(true);
  const [giftToDelete, setGiftToDelete] = useState<string | null>(null);

  // Form state
  const [linkInput, setLinkInput] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  
  const [formData, setFormData] = useState({
    title: '',
    price: '',
    description: '',
    imageUrl: '',
    originalLink: '',
    status: 'available' as 'available' | 'reserved' | 'gifted',
  });

  const [activeTab, setActiveTab] = useState<'gifts' | 'payments'>('gifts');
  const [contributions, setContributions] = useState<any[]>([]);

  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged((u) => {
      setUser(u);
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const qGifts = query(collection(db, 'gifts'), orderBy('createdAt', 'desc'));
    const unsubscribeGifts = onSnapshot(
      qGifts,
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

    const qContributions = query(collection(db, 'contributions'), orderBy('createdAt', 'desc'));
    const unsubscribeContributions = onSnapshot(
      qContributions,
      (snapshot) => {
        const fetchedContributions = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setContributions(fetchedContributions);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'contributions');
      }
    );

    return () => {
      unsubscribeGifts();
      unsubscribeContributions();
    };
  }, [user]);

  const handleExtractData = async () => {
    if (!linkInput.trim()) return;
    
    setIsExtracting(true);
    try {
      // Fetch image from our backend proxy
      const extractImagePromise = fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: linkInput })
      }).then(res => res.json()).catch(() => ({ imageUrl: '' }));

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const aiPromise = ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Acesse a URL e extraia as informações reais do produto: ${linkInput}. 
        Retorne um JSON com: 
        - title (string): Nome do produto.
        - price (number): Preço numérico do produto.
        - description (string): Breve descrição do produto.
        - imageUrl (string): A URL real e absoluta da imagem do produto. Procure especificamente pela tag <meta property="og:image">, <meta name="twitter:image">, ou a imagem principal do produto no HTML. NÃO INVENTE URLs, NÃO use picsum ou placeholders. Se não encontrar a URL real da imagem, retorne uma string vazia "".`,
        config: {
          tools: [{ urlContext: {} }],
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING, description: "O nome do produto" },
              price: { type: Type.NUMBER, description: "O preço do produto em BRL" },
              description: { type: Type.STRING, description: "Uma breve descrição do produto" },
              imageUrl: { type: Type.STRING, description: "URL da imagem do produto" },
            },
            required: ["title", "price", "description", "imageUrl"],
          },
        },
      });

      const [imageResult, aiResponse] = await Promise.all([extractImagePromise, aiPromise]);

      const data = JSON.parse(aiResponse.text || '{}');
      
      setFormData({
        title: data.title || '',
        price: data.price ? data.price.toString() : '',
        description: data.description || '',
        imageUrl: imageResult.imageUrl || data.imageUrl || '',
        originalLink: linkInput,
        status: 'available',
      });
      
      toast.success('Dados extraídos com sucesso! Revise antes de salvar.');
    } catch (error) {
      console.error('Erro ao extrair dados:', error);
      toast.error('Falha ao extrair dados do link. Preencha manualmente.');
    } finally {
      setIsExtracting(false);
    }
  };

  const handleSaveGift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      await addDoc(collection(db, 'gifts'), {
        title: formData.title,
        price: parseFloat(formData.price),
        description: formData.description,
        imageUrl: formData.imageUrl,
        originalLink: formData.originalLink,
        status: formData.status,
        createdAt: serverTimestamp(),
        authorUid: user.uid,
      });

      toast.success('Presente salvo na vitrine!');
      setFormData({
        title: '',
        price: '',
        description: '',
        imageUrl: '',
        originalLink: '',
        status: 'available',
      });
      setLinkInput('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'gifts');
    }
  };

  const handleDelete = (id: string) => {
    setGiftToDelete(id);
  };

  const confirmDelete = async () => {
    if (!giftToDelete) return;
    try {
      await deleteDoc(doc(db, 'gifts', giftToDelete));
      toast.success('Presente removido.');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `gifts/${giftToDelete}`);
    } finally {
      setGiftToDelete(null);
    }
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, 'gifts', id), { status: newStatus });
      toast.success('Status atualizado.');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `gifts/${id}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-nude)]">
        <div className="w-8 h-8 border-4 border-[var(--color-sage)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-nude)] p-4">
        <div className="max-w-md w-full bg-white p-8 rounded-3xl shadow-sm border border-[var(--color-nude-dark)] text-center">
          <h2 className="font-serif text-3xl text-[var(--color-ink)] mb-2">Painel dos Noivos</h2>
          <p className="text-[var(--color-ink-light)] mb-8">Faça login para gerenciar sua lista de presentes.</p>
          <button
            onClick={loginWithGoogle}
            className="w-full py-3 bg-[var(--color-ink)] text-white rounded-full font-medium hover:bg-black transition-colors"
          >
            Entrar com Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-nude)] pb-20">
      {/* Header */}
      <header className="bg-white border-b border-[var(--color-nude-dark)] sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <h1 className="font-serif text-xl text-[var(--color-ink)]">Painel dos Noivos - W&J</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-[var(--color-ink-light)] hidden sm:inline-block">{user.email}</span>
            <button
              onClick={logout}
              className="p-2 text-[var(--color-ink-light)] hover:text-red-500 transition-colors"
              title="Sair"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 mt-8">
        <div className="flex gap-4 mb-8 border-b border-[var(--color-nude-dark)]">
          <button
            onClick={() => setActiveTab('gifts')}
            className={`pb-4 px-2 font-medium text-sm transition-colors relative ${
              activeTab === 'gifts' ? 'text-[var(--color-ink)]' : 'text-[var(--color-ink-light)] hover:text-[var(--color-ink)]'
            }`}
          >
            Presentes
            {activeTab === 'gifts' && (
              <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--color-ink)]" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('payments')}
            className={`pb-4 px-2 font-medium text-sm transition-colors relative ${
              activeTab === 'payments' ? 'text-[var(--color-ink)]' : 'text-[var(--color-ink-light)] hover:text-[var(--color-ink)]'
            }`}
          >
            Pagamentos
            {activeTab === 'payments' && (
              <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--color-ink)]" />
            )}
          </button>
        </div>

        {activeTab === 'gifts' ? (
          <div className="grid lg:grid-cols-[1fr_400px] gap-12">
            {/* Left Column: Add Gift Form */}
            <div className="space-y-8">
              <section className="bg-white p-8 rounded-3xl shadow-sm border border-[var(--color-nude-dark)]">
                <h2 className="font-serif text-2xl text-[var(--color-ink)] mb-6">Adicionar Novo Presente</h2>
                
                <div className="mb-8">
                  <label className="block text-sm font-medium text-[var(--color-ink)] mb-2">
                    Cole aqui o link do produto (Amazon, Magalu, Mercado Livre...)
                  </label>
                  <div className="flex gap-3">
                    <div className="relative flex-1">
                      <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="url"
                        value={linkInput}
                        onChange={(e) => setLinkInput(e.target.value)}
                        placeholder="https://..."
                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-[var(--color-nude-dark)] focus:outline-none focus:ring-2 focus:ring-[var(--color-sage)] bg-gray-50/50"
                      />
                    </div>
                    <button
                      onClick={handleExtractData}
                      disabled={!linkInput.trim() || isExtracting}
                      className="px-6 py-3 bg-[var(--color-sage)] text-white rounded-xl font-medium hover:bg-[var(--color-sage-dark)] transition-colors disabled:opacity-50 whitespace-nowrap"
                    >
                      {isExtracting ? 'Buscando...' : 'Buscar Dados'}
                    </button>
                  </div>
                </div>

                <form onSubmit={handleSaveGift} className="space-y-6 border-t border-[var(--color-nude-dark)] pt-8">
                  <div className="grid sm:grid-cols-2 gap-6">
                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium text-[var(--color-ink)] mb-2">Nome do Produto *</label>
                      <input
                        type="text"
                        required
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border border-[var(--color-nude-dark)] focus:outline-none focus:ring-2 focus:ring-[var(--color-sage)] bg-gray-50/50"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-[var(--color-ink)] mb-2">Preço (R$) *</label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={formData.price}
                        onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border border-[var(--color-nude-dark)] focus:outline-none focus:ring-2 focus:ring-[var(--color-sage)] bg-gray-50/50"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-[var(--color-ink)] mb-2">Status</label>
                      <select
                        value={formData.status}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                        className="w-full px-4 py-3 rounded-xl border border-[var(--color-nude-dark)] focus:outline-none focus:ring-2 focus:ring-[var(--color-sage)] bg-gray-50/50 appearance-none"
                      >
                        <option value="available">Disponível</option>
                        <option value="reserved">Reservado</option>
                        <option value="gifted">Presenteado</option>
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium text-[var(--color-ink)] mb-2">URL da Imagem *</label>
                      <input
                        type="url"
                        required
                        value={formData.imageUrl}
                        onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border border-[var(--color-nude-dark)] focus:outline-none focus:ring-2 focus:ring-[var(--color-sage)] bg-gray-50/50"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium text-[var(--color-ink)] mb-2">Descrição</label>
                      <textarea
                        rows={3}
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border border-[var(--color-nude-dark)] focus:outline-none focus:ring-2 focus:ring-[var(--color-sage)] bg-gray-50/50 resize-none"
                      />
                    </div>
                  </div>

                  {/* Image Preview */}
                  {formData.imageUrl && (
                    <div className="mt-6">
                      <p className="text-sm font-medium text-[var(--color-ink)] mb-2">Preview da Imagem</p>
                      <div className="w-32 h-32 rounded-xl overflow-hidden border border-[var(--color-nude-dark)] bg-gray-50">
                        <img src={formData.imageUrl} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      </div>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={!formData.title || !formData.price || !formData.imageUrl}
                    className="w-full py-4 bg-[var(--color-ink)] text-white rounded-xl font-medium tracking-wide hover:bg-black transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <Plus className="w-5 h-5" /> Salvar na Vitrine
                  </button>
                </form>
              </section>
            </div>

            {/* Right Column: Gift List */}
            <div className="space-y-6">
              <h2 className="font-serif text-2xl text-[var(--color-ink)]">Presentes Cadastrados ({gifts.length})</h2>
              
              <div className="space-y-4 max-h-[800px] overflow-y-auto pr-2">
                {gifts.map((gift) => (
                  <div key={gift.id} className="bg-white p-4 rounded-2xl shadow-sm border border-[var(--color-nude-dark)] flex gap-4">
                    <div className="w-20 h-20 rounded-lg overflow-hidden bg-gray-50 shrink-0">
                      {gift.imageUrl ? (
                        <img src={gift.imageUrl} alt={gift.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-300">
                          <ImageIcon className="w-8 h-8" />
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0 flex flex-col justify-between">
                      <div>
                        <h4 className="font-medium text-[var(--color-ink)] text-sm truncate">{gift.title}</h4>
                        <p className="text-[var(--color-sage-dark)] font-medium mt-1 text-sm">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(gift.price)}
                        </p>
                      </div>
                      
                      <div className="flex items-center justify-between mt-2">
                        <select
                          value={gift.status}
                          onChange={(e) => handleStatusChange(gift.id, e.target.value)}
                          className="text-xs bg-gray-50 border border-[var(--color-nude-dark)] rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[var(--color-sage)]"
                        >
                          <option value="available">Disponível</option>
                          <option value="reserved">Reservado</option>
                          <option value="gifted">Presenteado</option>
                        </select>
                        
                        <button
                          onClick={() => handleDelete(gift.id)}
                          className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                          title="Remover"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                
                {gifts.length === 0 && (
                  <div className="text-center py-12 text-[var(--color-ink-light)] border-2 border-dashed border-[var(--color-nude-dark)] rounded-2xl">
                    Nenhum presente cadastrado ainda.
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="grid sm:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-[var(--color-nude-dark)]">
                <p className="text-sm text-[var(--color-ink-light)] mb-2">Total Arrecadado (Aprovado)</p>
                <p className="font-serif text-3xl text-[var(--color-sage-dark)]">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                    contributions.filter(c => c.status === 'approved').reduce((acc, curr) => acc + curr.amount, 0)
                  )}
                </p>
              </div>
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-[var(--color-nude-dark)]">
                <p className="text-sm text-[var(--color-ink-light)] mb-2">Total Pendente</p>
                <p className="font-serif text-3xl text-yellow-600">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                    contributions.filter(c => c.status === 'pending' || c.status === 'in_process').reduce((acc, curr) => acc + curr.amount, 0)
                  )}
                </p>
              </div>
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-[var(--color-nude-dark)]">
                <p className="text-sm text-[var(--color-ink-light)] mb-2">Total de Contribuições</p>
                <p className="font-serif text-3xl text-[var(--color-ink)]">
                  {contributions.length}
                </p>
              </div>
            </div>

            <div className="bg-white rounded-3xl p-8 shadow-sm border border-[var(--color-nude-dark)] mb-8">
            <h3 className="font-serif text-xl text-[var(--color-ink)] mb-4">Configuração do Mercado Pago</h3>
            <div className="space-y-6">
              <div>
                <h4 className="font-medium text-[var(--color-ink)] mb-2">1. Credenciais de Produção</h4>
                <p className="text-sm text-[var(--color-ink-light)] mb-2">
                  Para receber pagamentos reais, você precisa configurar as variáveis de ambiente no painel do AI Studio (Settings &gt; Secrets):
                </p>
                <ul className="list-disc list-inside text-sm text-gray-700 space-y-1 ml-2">
                  <li><strong>VITE_MERCADOPAGO_PUBLIC_KEY</strong>: Sua Public Key de produção</li>
                  <li><strong>MERCADOPAGO_ACCESS_TOKEN</strong>: Seu Access Token de produção</li>
                </ul>
              </div>

              <div className="border-t border-gray-200 pt-6">
                <h4 className="font-medium text-[var(--color-ink)] mb-2">2. Webhook (Atualização Automática)</h4>
                <p className="text-sm text-[var(--color-ink-light)] mb-4">
                  Para que os status dos pagamentos sejam atualizados automaticamente, configure o Webhook no painel do Mercado Pago.
                </p>
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                  <p className="text-sm font-medium text-gray-700 mb-2">URL de Produção para o Webhook:</p>
                  <code className="block bg-gray-100 p-3 rounded-lg text-sm text-gray-800 break-all select-all">
                    {window.location.origin}/api/webhook/mercadopago
                  </code>
                  <p className="text-xs text-gray-500 mt-3">
                    1. Acesse o painel do Mercado Pago Developers &gt; Suas integrações &gt; Webhooks.<br/>
                    2. Adicione a URL acima.<br/>
                    3. Selecione os eventos: <strong>Pagamentos (payment.created, payment.updated)</strong>.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-3xl shadow-sm border border-[var(--color-nude-dark)] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-[var(--color-nude-dark)]">
                      <th className="p-4 text-sm font-medium text-[var(--color-ink-light)]">Convidado</th>
                      <th className="p-4 text-sm font-medium text-[var(--color-ink-light)]">Mensagem</th>
                      <th className="p-4 text-sm font-medium text-[var(--color-ink-light)]">Valor</th>
                      <th className="p-4 text-sm font-medium text-[var(--color-ink-light)]">Método</th>
                      <th className="p-4 text-sm font-medium text-[var(--color-ink-light)]">Status</th>
                      <th className="p-4 text-sm font-medium text-[var(--color-ink-light)]">Data</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-nude-dark)]">
                    {contributions.map((c) => (
                      <tr key={c.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="p-4 text-sm text-[var(--color-ink)] font-medium">{c.guestName}</td>
                        <td className="p-4 text-sm text-[var(--color-ink-light)] max-w-xs truncate" title={c.message}>{c.message || '-'}</td>
                        <td className="p-4 text-sm font-medium text-[var(--color-sage-dark)]">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(c.amount)}
                        </td>
                        <td className="p-4 text-sm text-[var(--color-ink-light)] capitalize">{c.paymentMethod?.replace('_', ' ')}</td>
                        <td className="p-4 text-sm">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            c.status === 'approved' ? 'bg-green-100 text-green-700' :
                            c.status === 'pending' || c.status === 'in_process' ? 'bg-yellow-100 text-yellow-700' :
                            c.status === 'rejected' || c.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {c.status || 'Desconhecido'}
                          </span>
                        </td>
                        <td className="p-4 text-sm text-[var(--color-ink-light)]">
                          {c.createdAt?.toDate ? new Date(c.createdAt.toDate()).toLocaleDateString('pt-BR') : '-'}
                        </td>
                      </tr>
                    ))}
                    {contributions.length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-[var(--color-ink-light)]">
                          Nenhuma contribuição recebida ainda.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Delete Confirmation Modal */}
      {giftToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <h3 className="text-xl font-serif text-[var(--color-ink)] mb-2">Remover Presente</h3>
            <p className="text-[var(--color-ink-light)] mb-6">Tem certeza que deseja remover este presente da lista? Esta ação não pode ser desfeita.</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setGiftToDelete(null)}
                className="px-4 py-2 text-[var(--color-ink)] hover:bg-gray-100 rounded-lg font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition-colors"
              >
                Remover
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
