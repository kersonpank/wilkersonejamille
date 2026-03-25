import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// Descobre todas as fotos em src/assets/fotos/ automaticamente
const photoModules = import.meta.glob('../assets/fotos/*.{jpg,jpeg,png,webp,JPG,JPEG,PNG,WEBP}', { eager: true });
const PHOTOS: string[] = Object.values(photoModules).map((m: any) => m.default);
// Fallback se ainda não tiver nenhuma foto
if (PHOTOS.length === 0) PHOTOS.push('/nossa-foto.jpg');

function PhotoCarousel() {
  const [current, setCurrent] = useState(0);
  const [direction, setDirection] = useState(1);
  const total = PHOTOS.length;

  useEffect(() => {
    if (total <= 1) return;
    const id = setInterval(() => {
      setDirection(1);
      setCurrent(c => (c + 1) % total);
    }, 5000);
    return () => clearInterval(id);
  }, [total]);

  const go = (delta: number) => {
    setDirection(delta);
    setCurrent(c => (c + delta + total) % total);
  };

  return (
    <div className="relative h-[60vh] lg:h-[80vh] rounded-[2rem] overflow-hidden shadow-2xl bg-gray-100">
      <AnimatePresence initial={false} custom={direction} mode="sync">
        <motion.img
          key={current}
          src={PHOTOS[current]}
          alt={`Foto ${current + 1}`}
          custom={direction}
          variants={{
            enter: (d: number) => ({ x: d > 0 ? '100%' : '-100%', opacity: 0 }),
            center: { x: 0, opacity: 1 },
            exit: (d: number) => ({ x: d > 0 ? '-100%' : '100%', opacity: 0 }),
          }}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.5, ease: 'easeInOut' }}
          className="absolute inset-0 w-full h-full object-cover"
        />
      </AnimatePresence>

      <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent pointer-events-none" />

      {total > 1 && (
        <>
          <button
            onClick={() => go(-1)}
            className="absolute left-3 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/20 hover:bg-white/40 backdrop-blur-sm text-white transition-colors z-10"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={() => go(1)}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/20 hover:bg-white/40 backdrop-blur-sm text-white transition-colors z-10"
          >
            <ChevronRight className="w-5 h-5" />
          </button>

          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
            {PHOTOS.map((_, i) => (
              <button
                key={i}
                onClick={() => { setDirection(i > current ? 1 : -1); setCurrent(i); }}
                className={`w-1.5 h-1.5 rounded-full transition-all ${i === current ? 'bg-white w-4' : 'bg-white/50'}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function Home() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[var(--color-nude)] flex flex-col">
      {/* Header / Nav */}
      <header className="fixed top-0 left-0 right-0 z-30 bg-[var(--color-nude)]/80 backdrop-blur-md border-b border-[var(--color-nude-dark)]">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link to="/" className="font-serif text-2xl tracking-wide text-[var(--color-ink)]">W & J</Link>
          
          <nav className="hidden md:flex items-center gap-8">
            <Link to="/" className="text-[var(--color-sage-dark)] font-medium transition-colors">Home</Link>
            <Link to="/presentes" className="text-[var(--color-ink)] hover:text-[var(--color-sage-dark)] font-medium transition-colors">Lista de Presentes</Link>
          </nav>

          <div className="w-10"></div> {/* Spacer for alignment */}
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-24 pb-12 px-6 lg:pt-48 lg:pb-32 overflow-hidden">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="z-10"
          >
            <span className="text-[var(--color-sage-dark)] uppercase tracking-[0.2em] text-sm font-medium mb-4 block">
              Nossa Casa Nova
            </span>
            <h2 className="font-serif text-3xl sm:text-5xl lg:text-7xl leading-[1.1] text-[var(--color-ink)] mb-6">
              Wilkerson &<br />Jamille
            </h2>
            <p className="text-base sm:text-lg text-[var(--color-ink-light)] max-w-md leading-relaxed mb-8">
              De passeios inesquecíveis no pôr do sol para a construção do nosso próprio lar. Cada detalhe tem um pouco de nós, e queremos você fazendo parte desse novo capítulo.
            </p>
            <button
              onClick={() => navigate('/presentes')}
              className="px-8 py-4 bg-[var(--color-ink)] text-white rounded-full font-medium tracking-wide hover:bg-black transition-colors"
            >
              Ver Lista de Presentes
            </button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, delay: 0.2 }}
          >
            <PhotoCarousel />
          </motion.div>
        </div>
      </section>

      {/* Our Story */}
      <section className="py-16 lg:py-32 bg-white px-6 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-16 bg-[var(--color-nude-dark)]" />
        <div className="max-w-3xl mx-auto text-center relative z-10">
          <span className="text-[var(--color-sage-dark)] uppercase tracking-[0.2em] text-xs font-medium mb-6 block">
            Como tudo começou
          </span>
          <h3 className="font-serif text-2xl sm:text-4xl lg:text-5xl text-[var(--color-ink)] mb-6 sm:mb-10">Nossa História</h3>
          <p className="text-base lg:text-xl text-[var(--color-ink-light)] leading-relaxed font-light">
            De encontros cheios de risadas, passeios de cavalinho e pores do sol na roda gigante, até a decisão de passarmos uma vida inteira juntos. Nossa jornada tem sido a melhor aventura de todas. Agora, damos o próximo grande passo: construir o nosso lar. Agradecemos por fazerem parte da nossa história e por nos ajudarem a tornar a nossa casa ainda mais especial.
          </p>
        </div>
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-px h-16 bg-[var(--color-nude-dark)]" />
      </section>

      {/* Footer */}
      <footer className="py-12 bg-white text-center border-t border-[var(--color-nude-dark)] mt-auto">
        <p className="font-serif text-2xl text-[var(--color-ink)] mb-4">W & J</p>
        <p className="text-sm text-[var(--color-ink-light)]">
          Com amor, Wilkerson Mesquita & Jamille Mesquita.
        </p>
      </footer>
    </div>
  );
}
