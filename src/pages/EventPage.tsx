import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { MapPin, Calendar, Clock, Gift, CheckCircle, Users, Heart } from 'lucide-react';

interface Event {
  id: string;
  slug: string;
  title: string;
  headline: string;
  imageUrl: string;
  location: string;
  date: string;
  time: string;
}

export function EventPage() {
  const { slug } = useParams<{ slug: string }>();
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [showRsvpForm, setShowRsvpForm] = useState(false);
  const [rsvpDone, setRsvpDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ firstName: '', lastName: '', whatsapp: '' });

  useEffect(() => {
    if (!slug) return;
    const fetchEvent = async () => {
      const q = query(collection(db, 'events'), where('slug', '==', slug));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const doc = snap.docs[0];
        setEvent({ id: doc.id, ...doc.data() } as Event);
      }
      setLoading(false);
    };
    fetchEvent();
  }, [slug]);

  useEffect(() => {
    if (!event) return;
    const pageUrl = window.location.href;
    const setMeta = (attr: string, key: string, content: string) => {
      let el = document.querySelector(`meta[${attr}="${key}"]`);
      if (!el) { el = document.createElement('meta'); el.setAttribute(attr, key); document.head.appendChild(el); }
      el.setAttribute('content', content);
    };
    document.title = `${event.title} — Wilkerson & Jamille`;
    setMeta('property', 'og:title', `${event.title} — Wilkerson & Jamille`);
    setMeta('property', 'og:description', event.headline);
    setMeta('property', 'og:image', event.imageUrl);
    setMeta('property', 'og:image:width', '1200');
    setMeta('property', 'og:image:height', '630');
    setMeta('property', 'og:url', pageUrl);
    setMeta('property', 'og:type', 'website');
    setMeta('name', 'twitter:card', 'summary_large_image');
    setMeta('name', 'twitter:title', `${event.title} — Wilkerson & Jamille`);
    setMeta('name', 'twitter:description', event.headline);
    setMeta('name', 'twitter:image', event.imageUrl);
    return () => { document.title = 'Wilkerson & Jamille'; };
  }, [event]);

  const formatDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString('pt-BR', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
  };

  const formatPhone = (value: string) => {
    const d = value.replace(/\D/g, '').slice(0, 11);
    if (d.length <= 2) return d;
    if (d.length <= 6) return `(${d.slice(0,2)}) ${d.slice(2)}`;
    if (d.length <= 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
    return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
  };

  const handleRsvp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!event) return;
    setSubmitting(true);
    try {
      await addDoc(collection(db, 'rsvps'), {
        eventId: event.id,
        eventSlug: event.slug,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        whatsapp: form.whatsapp.trim(),
        createdAt: serverTimestamp(),
      });
      setRsvpDone(true);
      setShowRsvpForm(false);
      toast.success('Presença confirmada! Até lá 🎉');
    } catch {
      toast.error('Erro ao confirmar presença. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-nude)]">
        <div className="w-8 h-8 border-4 border-[var(--color-sage)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--color-nude)] text-center px-6">
        <p className="font-serif text-4xl text-[var(--color-ink)] mb-4">Evento não encontrado</p>
        <p className="text-[var(--color-ink-light)] mb-8">O link pode estar incorreto ou o evento foi removido.</p>
        <Link to="/" className="px-6 py-3 bg-[var(--color-ink)] text-white rounded-full font-medium hover:bg-black transition-colors">
          Ir para o início
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-nude)] flex flex-col">
      {/* Hero */}
      <div className="relative h-[60vh] min-h-[400px] overflow-hidden">
        <img
          src={event.imageUrl}
          alt={event.title}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-8 lg:p-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <p className="text-white/70 uppercase tracking-[0.2em] text-xs mb-3">Wilkerson & Jamille</p>
            <h1 className="font-serif text-2xl sm:text-4xl lg:text-6xl text-white leading-tight mb-2">{event.title}</h1>
          </motion.div>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-2xl mx-auto w-full px-6 py-16 flex flex-col gap-12">
        {/* Headline */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-center"
        >
          <p className="text-xl lg:text-2xl text-[var(--color-ink-light)] leading-relaxed font-light">
            {event.headline}
          </p>
        </motion.section>

        {/* Info cards */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid sm:grid-cols-3 gap-4"
        >
          <div className="bg-white rounded-2xl p-5 flex flex-col items-center gap-2 shadow-sm border border-[var(--color-nude-dark)] text-center">
            <Calendar className="w-5 h-5 text-[var(--color-sage-dark)]" />
            <p className="text-xs text-[var(--color-ink-light)] uppercase tracking-widest">Data</p>
            <p className="font-medium text-[var(--color-ink)] text-sm capitalize">{formatDate(event.date)}</p>
          </div>
          <div className="bg-white rounded-2xl p-5 flex flex-col items-center gap-2 shadow-sm border border-[var(--color-nude-dark)] text-center">
            <Clock className="w-5 h-5 text-[var(--color-sage-dark)]" />
            <p className="text-xs text-[var(--color-ink-light)] uppercase tracking-widest">Horário</p>
            <p className="font-medium text-[var(--color-ink)]">{event.time}h</p>
          </div>
          <div className="bg-white rounded-2xl p-5 flex flex-col items-center gap-2 shadow-sm border border-[var(--color-nude-dark)] text-center">
            <MapPin className="w-5 h-5 text-[var(--color-sage-dark)]" />
            <p className="text-xs text-[var(--color-ink-light)] uppercase tracking-widest">Local</p>
            <p className="font-medium text-[var(--color-ink)] text-sm">{event.location}</p>
          </div>
        </motion.section>

        {/* RSVP Section */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-3xl p-8 shadow-sm border border-[var(--color-nude-dark)] text-center"
        >
          {rsvpDone ? (
            <div className="flex flex-col items-center gap-4">
              <CheckCircle className="w-12 h-12 text-[var(--color-sage-dark)]" />
              <p className="font-serif text-2xl text-[var(--color-ink)]">Presença confirmada!</p>
              <p className="text-[var(--color-ink-light)]">Mal podemos esperar para te ver por lá.</p>
              <div className="w-full border-t border-[var(--color-nude-dark)] pt-4 mt-2 text-center">
                <p className="text-sm text-[var(--color-ink-light)] mb-3">Que tal já escolher um presente para o casal?</p>
                <Link
                  to="/presentes"
                  className="inline-block px-6 py-3 bg-[var(--color-sage-dark)] text-white rounded-full font-medium hover:opacity-90 transition-opacity text-sm"
                >
                  Ver Lista de Presentes
                </Link>
              </div>
            </div>
          ) : (
            <>
              <Users className="w-8 h-8 text-[var(--color-sage-dark)] mx-auto mb-3" />
              <h2 className="font-serif text-2xl text-[var(--color-ink)] mb-2">Confirmar Presença</h2>
              <p className="text-[var(--color-ink-light)] mb-6 text-sm">
                Deixe seu nome para que possamos te esperar com alegria.
              </p>

              <AnimatePresence>
                {showRsvpForm ? (
                  <motion.form
                    key="form"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    onSubmit={handleRsvp}
                    className="space-y-4 text-left"
                  >
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-[var(--color-ink)] mb-1">Nome *</label>
                        <input
                          required
                          value={form.firstName}
                          onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))}
                          placeholder="Seu nome"
                          className="w-full px-4 py-3 rounded-xl border border-[var(--color-nude-dark)] focus:outline-none focus:ring-2 focus:ring-[var(--color-sage)] bg-gray-50/50"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-[var(--color-ink)] mb-1">Sobrenome *</label>
                        <input
                          required
                          value={form.lastName}
                          onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))}
                          placeholder="Seu sobrenome"
                          className="w-full px-4 py-3 rounded-xl border border-[var(--color-nude-dark)] focus:outline-none focus:ring-2 focus:ring-[var(--color-sage)] bg-gray-50/50"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[var(--color-ink)] mb-1">WhatsApp *</label>
                      <input
                        required
                        type="tel"
                        value={form.whatsapp}
                        onChange={e => setForm(f => ({ ...f, whatsapp: formatPhone(e.target.value) }))}
                        placeholder="(11) 99999-9999"
                        inputMode="numeric"
                        className="w-full px-4 py-3 rounded-xl border border-[var(--color-nude-dark)] focus:outline-none focus:ring-2 focus:ring-[var(--color-sage)] bg-gray-50/50"
                      />
                    </div>
                    <div className="flex gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => setShowRsvpForm(false)}
                        className="flex-1 py-3 border border-[var(--color-nude-dark)] rounded-full font-medium text-[var(--color-ink)] hover:bg-gray-50 transition-colors"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={submitting}
                        className="flex-1 py-3 bg-[var(--color-ink)] text-white rounded-full font-medium hover:bg-black transition-colors disabled:opacity-50"
                      >
                        {submitting ? 'Confirmando...' : 'Confirmar'}
                      </button>
                    </div>
                  </motion.form>
                ) : (
                  <motion.button
                    key="btn"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    onClick={() => setShowRsvpForm(true)}
                    className="px-8 py-4 bg-[var(--color-ink)] text-white rounded-full font-medium hover:bg-black transition-colors"
                  >
                    Confirmar Presença
                  </motion.button>
                )}
              </AnimatePresence>
            </>
          )}
        </motion.section>

        {/* CTA Lista de Presentes */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="text-center"
        >
          <div className="bg-[var(--color-sage)]/10 rounded-3xl p-8 border border-[var(--color-sage)]/20">
            <Gift className="w-8 h-8 text-[var(--color-sage-dark)] mx-auto mb-3" />
            <h3 className="font-serif text-xl text-[var(--color-ink)] mb-2">Lista de Presentes</h3>
            <p className="text-[var(--color-ink-light)] text-sm mb-6">
              Quer presentear o casal? Confira a lista de presentes e escolha algo especial.
            </p>
            <Link
              to="/presentes"
              className="inline-block px-8 py-4 bg-[var(--color-sage-dark)] text-white rounded-full font-medium hover:opacity-90 transition-opacity"
            >
              Ver Lista de Presentes
            </Link>
          </div>
        </motion.section>
      </main>

      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="max-w-2xl mx-auto w-full px-6 pb-16"
      >
        <div className="relative rounded-3xl overflow-hidden">
          <div className="absolute inset-0 bg-[var(--color-ink)]" />
          <div className="relative px-4 sm:px-8 py-8 sm:py-10 text-center">
            <Heart className="w-7 h-7 text-white/60 mx-auto mb-4" />
            <h3 className="font-serif text-2xl text-white mb-2">Wilkerson & Jamille</h3>
            <p className="text-white/70 text-sm leading-relaxed mb-6 max-w-xs mx-auto">
              De passeios inesquecíveis a um novo lar. Conheça um pouco mais da nossa história.
            </p>
            <Link
              to="/"
              onClick={() => window.scrollTo({ top: 0 })}
              className="inline-block px-7 py-3 bg-white text-[var(--color-ink)] rounded-full font-medium text-sm hover:bg-[var(--color-nude)] transition-colors"
            >
              Nossa História →
            </Link>
          </div>
        </div>
      </motion.section>

      <footer className="py-10 text-center border-t border-[var(--color-nude-dark)]">
        <p className="font-serif text-xl text-[var(--color-ink)]">W & J</p>
        <p className="text-sm text-[var(--color-ink-light)] mt-1">Com amor, Wilkerson & Jamille.</p>
      </footer>
    </div>
  );
}
