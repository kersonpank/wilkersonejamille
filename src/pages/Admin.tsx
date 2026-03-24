import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy, addDoc, serverTimestamp, deleteDoc, doc, updateDoc, setDoc, getDoc, getDocs, where } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, auth, storage, loginWithGoogle, logout, handleFirestoreError, OperationType } from '../lib/firebase';
import { Gift } from '../components/GiftCard';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { Link2, Plus, Trash2, LogOut, Image as ImageIcon, AlertTriangle, Bell, Calendar, MapPin, Clock, Users, ExternalLink } from 'lucide-react';
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

  const [activeTab, setActiveTab] = useState<'gifts' | 'payments' | 'events'>('gifts');
  const [giftsSubTab, setGiftsSubTab] = useState<'manage' | 'contributors'>('manage');
  const [contributions, setContributions] = useState<any[]>([]);
  const [isClearingHistory, setIsClearingHistory] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Events state
  const [events, setEvents] = useState<any[]>([]);
  const [rsvps, setRsvps] = useState<any[]>([]);
  const [selectedEventForRsvp, setSelectedEventForRsvp] = useState<string | null>(null);
  const [eventToDelete, setEventToDelete] = useState<string | null>(null);
  const [isCreatingEvent, setIsCreatingEvent] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [eventImageFile, setEventImageFile] = useState<File | null>(null);
  const [eventForm, setEventForm] = useState({
    slug: '', title: '', headline: '', imageUrl: '', location: '', date: '', time: '',
  });

  // Webhook notification state
  const [webhookUrl, setWebhookUrl] = useState('');
  const [isSavingWebhook, setIsSavingWebhook] = useState(false);

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

  useEffect(() => {
    if (!user) return;

    const qEvents = query(collection(db, 'events'), orderBy('createdAt', 'desc'));
    const unsubEvents = onSnapshot(qEvents, (snap) => {
      setEvents(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const qRsvps = query(collection(db, 'rsvps'), orderBy('createdAt', 'desc'));
    const unsubRsvps = onSnapshot(qRsvps, (snap) => {
      setRsvps(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    getDoc(doc(db, 'settings', 'notifications')).then(snap => {
      if (snap.exists()) setWebhookUrl(snap.data()?.webhookUrl ?? '');
    });

    return () => {
      unsubEvents();
      unsubRsvps();
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

  const handleClearHistory = async () => {
    setIsClearingHistory(true);
    try {
      for (const c of contributions) {
        await deleteDoc(doc(db, 'contributions', c.id));
      }
      toast.success(`${contributions.length} registro(s) apagado(s).`);
      setShowClearConfirm(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'contributions');
    } finally {
      setIsClearingHistory(false);
    }
  };

  const slugify = (text: string) =>
    text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

  const handleEventImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setEventImageFile(file);
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsCreatingEvent(true);
    try {
      let imageUrl = eventForm.imageUrl;
      if (eventImageFile) {
        setIsUploadingImage(true);
        const storageRef = ref(storage, `events/${eventForm.slug}-${Date.now()}`);
        await uploadBytes(storageRef, eventImageFile);
        imageUrl = await getDownloadURL(storageRef);
        setIsUploadingImage(false);
      }
      // Check slug uniqueness
      const existing = await getDocs(query(collection(db, 'events'), where('slug', '==', eventForm.slug)));
      if (!existing.empty) {
        toast.error('Já existe um evento com este slug. Escolha outro.');
        return;
      }
      await addDoc(collection(db, 'events'), {
        slug: eventForm.slug,
        title: eventForm.title,
        headline: eventForm.headline,
        imageUrl,
        location: eventForm.location,
        date: eventForm.date,
        time: eventForm.time,
        createdAt: serverTimestamp(),
        authorUid: user.uid,
      });
      toast.success('Evento criado!');
      setEventForm({ slug: '', title: '', headline: '', imageUrl: '', location: '', date: '', time: '' });
      setEventImageFile(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'events');
    } finally {
      setIsCreatingEvent(false);
      setIsUploadingImage(false);
    }
  };

  const confirmDeleteEvent = async () => {
    if (!eventToDelete) return;
    try {
      await deleteDoc(doc(db, 'events', eventToDelete));
      toast.success('Evento removido.');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `events/${eventToDelete}`);
    } finally {
      setEventToDelete(null);
    }
  };

  const handleSaveWebhookUrl = async () => {
    setIsSavingWebhook(true);
    try {
      await setDoc(doc(db, 'settings', 'notifications'), { webhookUrl });
      toast.success('URL de notificação salva!');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'settings/notifications');
    } finally {
      setIsSavingWebhook(false);
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
          <button
            onClick={() => setActiveTab('events')}
            className={`pb-4 px-2 font-medium text-sm transition-colors relative ${
              activeTab === 'events' ? 'text-[var(--color-ink)]' : 'text-[var(--color-ink-light)] hover:text-[var(--color-ink)]'
            }`}
          >
            Eventos
            {events.length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 bg-[var(--color-sage)] text-white text-xs rounded-full">{events.length}</span>
            )}
            {activeTab === 'events' && (
              <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--color-ink)]" />
            )}
          </button>
        </div>

        {activeTab === 'events' ? (
          <div className="grid lg:grid-cols-[400px_1fr] gap-12">
            {/* Create Event Form */}
            <section className="bg-white p-8 rounded-3xl shadow-sm border border-[var(--color-nude-dark)] self-start">
              <h2 className="font-serif text-2xl text-[var(--color-ink)] mb-6">Criar Novo Evento</h2>
              <form onSubmit={handleCreateEvent} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--color-ink)] mb-1">Título *</label>
                  <input
                    required
                    value={eventForm.title}
                    onChange={e => {
                      const title = e.target.value;
                      setEventForm(f => ({ ...f, title, slug: slugify(title) }));
                    }}
                    placeholder="Ex: Chá de Cozinha"
                    className="w-full px-4 py-3 rounded-xl border border-[var(--color-nude-dark)] focus:outline-none focus:ring-2 focus:ring-[var(--color-sage)] bg-gray-50/50 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--color-ink)] mb-1">Slug (URL) *</label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[var(--color-ink-light)] shrink-0">…/</span>
                    <input
                      required
                      value={eventForm.slug}
                      onChange={e => setEventForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))}
                      placeholder="cha-de-cozinha"
                      className="flex-1 px-4 py-3 rounded-xl border border-[var(--color-nude-dark)] focus:outline-none focus:ring-2 focus:ring-[var(--color-sage)] bg-gray-50/50 text-sm font-mono"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--color-ink)] mb-1">Subtítulo / Descrição curta *</label>
                  <input
                    required
                    value={eventForm.headline}
                    onChange={e => setEventForm(f => ({ ...f, headline: e.target.value }))}
                    placeholder="Uma tarde especial para celebrar com amor…"
                    className="w-full px-4 py-3 rounded-xl border border-[var(--color-nude-dark)] focus:outline-none focus:ring-2 focus:ring-[var(--color-sage)] bg-gray-50/50 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--color-ink)] mb-1">Foto do Evento</label>
                  <label className="flex items-center gap-3 px-4 py-3 rounded-xl border border-dashed border-[var(--color-nude-dark)] cursor-pointer hover:border-[var(--color-sage)] transition-colors bg-gray-50/50">
                    <ImageIcon className="w-5 h-5 text-[var(--color-ink-light)]" />
                    <span className="text-sm text-[var(--color-ink-light)]">
                      {eventImageFile ? eventImageFile.name : 'Escolher imagem…'}
                    </span>
                    <input type="file" accept="image/*" className="sr-only" onChange={handleEventImageChange} />
                  </label>
                  {isUploadingImage && <p className="text-xs text-[var(--color-sage-dark)] mt-1">Enviando imagem…</p>}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-ink)] mb-1">Data *</label>
                    <input
                      required
                      type="date"
                      value={eventForm.date}
                      onChange={e => setEventForm(f => ({ ...f, date: e.target.value }))}
                      className="w-full px-4 py-3 rounded-xl border border-[var(--color-nude-dark)] focus:outline-none focus:ring-2 focus:ring-[var(--color-sage)] bg-gray-50/50 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-ink)] mb-1">Horário *</label>
                    <input
                      required
                      type="time"
                      value={eventForm.time}
                      onChange={e => setEventForm(f => ({ ...f, time: e.target.value }))}
                      className="w-full px-4 py-3 rounded-xl border border-[var(--color-nude-dark)] focus:outline-none focus:ring-2 focus:ring-[var(--color-sage)] bg-gray-50/50 text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--color-ink)] mb-1">Local *</label>
                  <input
                    required
                    value={eventForm.location}
                    onChange={e => setEventForm(f => ({ ...f, location: e.target.value }))}
                    placeholder="Rua das Flores, 123 – São Paulo"
                    className="w-full px-4 py-3 rounded-xl border border-[var(--color-nude-dark)] focus:outline-none focus:ring-2 focus:ring-[var(--color-sage)] bg-gray-50/50 text-sm"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isCreatingEvent}
                  className="w-full py-4 bg-[var(--color-ink)] text-white rounded-xl font-medium hover:bg-black transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Plus className="w-5 h-5" />
                  {isCreatingEvent ? 'Criando…' : 'Criar Evento'}
                </button>
              </form>
            </section>

            {/* Event List */}
            <div className="space-y-4">
              <h2 className="font-serif text-2xl text-[var(--color-ink)]">Eventos Criados ({events.length})</h2>
              {events.length === 0 ? (
                <div className="text-center py-16 text-[var(--color-ink-light)] border-2 border-dashed border-[var(--color-nude-dark)] rounded-2xl">
                  Nenhum evento criado ainda.
                </div>
              ) : (
                events.map(ev => {
                  const evRsvps = rsvps.filter(r => r.eventId === ev.id);
                  return (
                    <div key={ev.id} className="bg-white rounded-2xl shadow-sm border border-[var(--color-nude-dark)] overflow-hidden">
                      <div className="flex gap-4 p-4">
                        {ev.imageUrl && (
                          <div className="w-20 h-20 rounded-xl overflow-hidden bg-gray-50 shrink-0">
                            <img src={ev.imageUrl} alt={ev.title} className="w-full h-full object-cover" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h3 className="font-medium text-[var(--color-ink)] truncate">{ev.title}</h3>
                              <p className="text-xs text-[var(--color-ink-light)] mt-0.5">/{ev.slug}</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <a
                                href={`/${ev.slug}`}
                                target="_blank"
                                rel="noreferrer"
                                className="p-1.5 text-[var(--color-ink-light)] hover:text-[var(--color-sage-dark)] hover:bg-gray-50 rounded-md transition-colors"
                                title="Ver página"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </a>
                              <button
                                onClick={() => setEventToDelete(ev.id)}
                                className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                                title="Remover"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-3 mt-2 text-xs text-[var(--color-ink-light)]">
                            <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{ev.date}</span>
                            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{ev.time}h</span>
                            <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{ev.location}</span>
                          </div>
                        </div>
                      </div>
                      {/* RSVP section */}
                      <div className="border-t border-[var(--color-nude-dark)] px-4 py-3">
                        <button
                          onClick={() => setSelectedEventForRsvp(selectedEventForRsvp === ev.id ? null : ev.id)}
                          className="flex items-center gap-2 text-sm font-medium text-[var(--color-sage-dark)] hover:text-[var(--color-ink)] transition-colors"
                        >
                          <Users className="w-4 h-4" />
                          {evRsvps.length} confirmação(ões) de presença
                          <span className="text-xs text-[var(--color-ink-light)]">{selectedEventForRsvp === ev.id ? '▲' : '▼'}</span>
                        </button>
                        {selectedEventForRsvp === ev.id && (
                          <div className="mt-3 space-y-2">
                            {evRsvps.length === 0 ? (
                              <p className="text-xs text-[var(--color-ink-light)] py-2">Nenhuma confirmação ainda.</p>
                            ) : (
                              evRsvps.map(r => (
                                <div key={r.id} className="flex items-center justify-between text-sm py-1.5 border-b border-gray-50 last:border-0">
                                  <span className="font-medium text-[var(--color-ink)]">{r.firstName} {r.lastName}</span>
                                  <span className="text-[var(--color-ink-light)]">{r.whatsapp}</span>
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        ) : activeTab === 'gifts' ? (
          <div>
            {/* Sub-tabs */}
            <div className="flex gap-6 mb-8 border-b border-[var(--color-nude-dark)]">
              <button
                onClick={() => setGiftsSubTab('manage')}
                className={`pb-3 text-sm font-medium transition-colors relative ${giftsSubTab === 'manage' ? 'text-[var(--color-ink)]' : 'text-[var(--color-ink-light)] hover:text-[var(--color-ink)]'}`}
              >
                Gerenciar Lista
                {giftsSubTab === 'manage' && <motion.div layoutId="giftsSubTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--color-sage-dark)]" />}
              </button>
              <button
                onClick={() => setGiftsSubTab('contributors')}
                className={`pb-3 text-sm font-medium transition-colors relative ${giftsSubTab === 'contributors' ? 'text-[var(--color-ink)]' : 'text-[var(--color-ink-light)] hover:text-[var(--color-ink)]'}`}
              >
                Presenteadores
                {contributions.filter(c => c.status === 'approved').length > 0 && (
                  <span className="ml-2 px-1.5 py-0.5 bg-[var(--color-sage)] text-white text-xs rounded-full">
                    {contributions.filter(c => c.status === 'approved').length}
                  </span>
                )}
                {giftsSubTab === 'contributors' && <motion.div layoutId="giftsSubTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--color-sage-dark)]" />}
              </button>
            </div>

            {giftsSubTab === 'contributors' ? (
              <div className="space-y-4">
                {contributions.filter(c => c.status === 'approved').length === 0 ? (
                  <div className="text-center py-16 text-[var(--color-ink-light)] border-2 border-dashed border-[var(--color-nude-dark)] rounded-2xl">
                    Nenhum presente confirmado ainda.
                  </div>
                ) : (
                  contributions
                    .filter(c => c.status === 'approved')
                    .map(c => {
                      const gift = gifts.find(g => g.id === c.giftId);
                      return (
                        <div key={c.id} className="bg-white rounded-2xl p-4 shadow-sm border border-[var(--color-nude-dark)] flex gap-4 items-center">
                          {gift?.imageUrl && (
                            <div className="w-16 h-16 rounded-xl overflow-hidden bg-gray-50 shrink-0">
                              <img src={gift.imageUrl} alt={gift.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-[var(--color-ink)] truncate">{gift?.title ?? `Presente #${c.giftId}`}</p>
                            <p className="text-sm text-[var(--color-ink-light)] mt-0.5">
                              de <strong>{c.guestName}</strong>
                              {c.message && <span className="italic"> — "{c.message}"</span>}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-serif text-lg text-[var(--color-sage-dark)]">
                              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(c.amount)}
                            </p>
                            {c.netAmount != null && (
                              <p className="text-xs text-green-600">
                                líquido: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(c.netAmount)}
                              </p>
                            )}
                            <p className="text-xs text-[var(--color-ink-light)] mt-0.5">
                              {c.createdAt?.toDate ? new Date(c.createdAt.toDate()).toLocaleDateString('pt-BR') : ''}
                            </p>
                          </div>
                        </div>
                      );
                    })
                )}
              </div>
            ) : (
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
            )}
          </div>
        ) : (
          <div className="space-y-8">
            {/* Environment indicator + clear button */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
              {import.meta.env.VITE_MERCADOPAGO_PUBLIC_KEY?.startsWith('TEST-') ? (
                <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-xl text-sm font-medium">
                  <span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" />
                  Modo Sandbox (Teste) — pagamentos não são reais
                </div>
              ) : (
                <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-xl text-sm font-medium">
                  <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                  Modo Produção — pagamentos reais
                </div>
              )}
              {contributions.length > 0 && (
                <button
                  onClick={() => setShowClearConfirm(true)}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-red-500 border border-red-200 rounded-xl hover:bg-red-50 transition-colors"
                >
                  <AlertTriangle className="w-4 h-4" />
                  Limpar histórico
                </button>
              )}
            </div>

            <div className="grid sm:grid-cols-4 gap-6">
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-[var(--color-nude-dark)]">
                <p className="text-sm text-[var(--color-ink-light)] mb-2">Total Cobrado (Aprovado)</p>
                <p className="font-serif text-2xl text-[var(--color-sage-dark)]">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                    contributions.filter(c => c.status === 'approved').reduce((acc, curr) => acc + curr.amount, 0)
                  )}
                </p>
              </div>
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-[var(--color-nude-dark)]">
                <p className="text-sm text-[var(--color-ink-light)] mb-2">Recebido Líquido (após taxas)</p>
                <p className="font-serif text-2xl text-green-700">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                    contributions.filter(c => c.status === 'approved' && c.netAmount != null).reduce((acc, curr) => acc + curr.netAmount, 0)
                  )}
                </p>
              </div>
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-[var(--color-nude-dark)]">
                <p className="text-sm text-[var(--color-ink-light)] mb-2">Total Pendente</p>
                <p className="font-serif text-2xl text-yellow-600">
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
                  Para receber pagamentos reais, você precisa configurar as variáveis de ambiente no painel do Railway (seu serviço &gt; Variables):
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

          {/* Webhook Notification Config */}
          <div className="bg-white rounded-3xl p-8 shadow-sm border border-[var(--color-nude-dark)]">
            <div className="flex items-center gap-3 mb-4">
              <Bell className="w-5 h-5 text-[var(--color-sage-dark)]" />
              <h3 className="font-serif text-xl text-[var(--color-ink)]">Notificação de Pagamento Aprovado</h3>
            </div>
            <p className="text-sm text-[var(--color-ink-light)] mb-4">
              Quando um pagamento for aprovado, o sistema enviará um POST com os dados para a URL abaixo.
            </p>
            <div className="flex gap-3">
              <input
                type="url"
                value={webhookUrl}
                onChange={e => setWebhookUrl(e.target.value)}
                placeholder="https://..."
                className="flex-1 px-4 py-3 rounded-xl border border-[var(--color-nude-dark)] focus:outline-none focus:ring-2 focus:ring-[var(--color-sage)] bg-gray-50/50 text-sm"
              />
              <button
                onClick={handleSaveWebhookUrl}
                disabled={isSavingWebhook}
                className="px-6 py-3 bg-[var(--color-ink)] text-white rounded-xl font-medium hover:bg-black transition-colors disabled:opacity-50 whitespace-nowrap text-sm"
              >
                {isSavingWebhook ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>

          <div className="bg-white rounded-3xl shadow-sm border border-[var(--color-nude-dark)] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-[var(--color-nude-dark)]">
                      <th className="p-4 text-sm font-medium text-[var(--color-ink-light)]">Convidado</th>
                      <th className="p-4 text-sm font-medium text-[var(--color-ink-light)]">Mensagem</th>
                      <th className="p-4 text-sm font-medium text-[var(--color-ink-light)]">Cobrado</th>
                      <th className="p-4 text-sm font-medium text-[var(--color-ink-light)]">Líquido</th>
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
                        <td className="p-4 text-sm font-medium text-green-700">
                          {c.netAmount != null
                            ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(c.netAmount)
                            : <span className="text-gray-400">—</span>}
                        </td>
                        <td className="p-4 text-sm text-[var(--color-ink-light)] capitalize">{c.paymentMethod?.replace('_', ' ')}</td>
                        <td className="p-4 text-sm">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            c.status === 'approved' ? 'bg-green-100 text-green-700' :
                            c.status === 'pending' || c.status === 'in_process' ? 'bg-yellow-100 text-yellow-700' :
                            c.status === 'rejected' || c.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {{
                              approved: 'Aprovado',
                              pending: 'Pendente',
                              in_process: 'Em processamento',
                              rejected: 'Rejeitado',
                              cancelled: 'Cancelado',
                            }[c.status as string] || c.status || 'Desconhecido'}
                          </span>
                        </td>
                        <td className="p-4 text-sm text-[var(--color-ink-light)]">
                          {c.createdAt?.toDate ? new Date(c.createdAt.toDate()).toLocaleDateString('pt-BR') : '-'}
                        </td>
                      </tr>
                    ))}
                    {contributions.length === 0 && (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-[var(--color-ink-light)]">
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

      {/* Clear History Confirmation Modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <div className="flex items-center gap-3 mb-3">
              <AlertTriangle className="w-6 h-6 text-red-500 shrink-0" />
              <h3 className="text-xl font-serif text-[var(--color-ink)]">Limpar Histórico</h3>
            </div>
            <p className="text-[var(--color-ink-light)] mb-6">
              Todos os <strong>{contributions.length} registro(s)</strong> de pagamento serão apagados permanentemente. Use apenas para limpar dados de teste.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowClearConfirm(false)}
                disabled={isClearingHistory}
                className="px-4 py-2 text-[var(--color-ink)] hover:bg-gray-100 rounded-lg font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleClearHistory}
                disabled={isClearingHistory}
                className="px-4 py-2 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {isClearingHistory ? 'Apagando...' : 'Apagar tudo'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Event Confirmation Modal */}
      {eventToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <h3 className="text-xl font-serif text-[var(--color-ink)] mb-2">Remover Evento</h3>
            <p className="text-[var(--color-ink-light)] mb-6">Tem certeza que deseja remover este evento? As confirmações de presença não serão apagadas automaticamente.</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setEventToDelete(null)}
                className="px-4 py-2 text-[var(--color-ink)] hover:bg-gray-100 rounded-lg font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDeleteEvent}
                className="px-4 py-2 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition-colors"
              >
                Remover
              </button>
            </div>
          </div>
        </div>
      )}

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
