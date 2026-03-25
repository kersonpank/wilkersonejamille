import { useRef, Fragment, type ReactNode } from 'react';
import { motion, useInView } from 'motion/react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronDown, Heart } from 'lucide-react';

// Hero — foto mais cinematográfica (roda gigante + pôr do sol)
import heroPhoto from '../assets/fotos/10.jpeg';

// Fotos dos capítulos da história
import chapter1Photo from '../assets/fotos/0.jpeg';   // lago com cisnes — início jovem
import chapter2Photo from '../assets/fotos/2.jpeg';   // terraço noturno SP — maturidade
import chapter3Photo from '../assets/fotos/13.jpeg';  // abraço sob a roda gigante — reencontro

// Todas as fotos para a galeria
const allPhotoModules = import.meta.glob('../assets/fotos/*.{jpg,jpeg,png,webp,JPG,JPEG,PNG,WEBP}', { eager: true });
const ALL_PHOTOS: string[] = Object.values(allPhotoModules).map((m: any) => m.default);

// Componente de animação de entrada ao rolar
function FadeIn({ children, className = '', delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 36 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.8, delay, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

const CHAPTERS = [
  {
    year: '2014',
    label: 'O Primeiro Sinal',
    text: 'Tudo começou de um jeito bem tradicional para 2014: grupos de WhatsApp e um churrasco da turma. A atração foi imediata — mas o roteiro da nossa história ainda precisava de tempo para ser escrito. A juventude tem seus próprios relógios.',
    photo: chapter1Photo,
  },
  {
    year: '+ de 2.000 km',
    label: 'Caminhos Opostos',
    text: 'A vida nos levou por caminhos completamente opostos — tão opostos que fomos parar a mais de 2.000 quilômetros de distância um do outro. Mas as histórias reais não têm pressa. E as que valem a pena esperam.',
    photo: chapter2Photo,
  },
  {
    year: 'O reencontro',
    label: 'O Tempo Certo',
    text: 'Já adultos e maduros, em um momento de busca por Deus e entendimento dos nossos propósitos, a vida nos colocou frente a frente de novo. A ficha foi caindo: aquele sentimento do primeiro churrasco continuava ali, intacto. Só estava esperando que nós dois estivéssemos prontos.',
    photo: chapter3Photo,
  },
];

export function Home() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[var(--color-nude)] flex flex-col">

      {/* ── NAVEGAÇÃO ── */}
      <header className="fixed top-0 left-0 right-0 z-30 bg-[var(--color-nude)]/80 backdrop-blur-md border-b border-[var(--color-nude-dark)]">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="font-serif text-2xl tracking-wide text-[var(--color-ink)]">W & J</Link>
          <nav className="hidden md:flex items-center gap-8">
            <Link to="/" className="text-[var(--color-sage-dark)] font-medium">Home</Link>
            <Link to="/presentes" className="text-[var(--color-ink)] hover:text-[var(--color-sage-dark)] font-medium transition-colors">Lista de Presentes</Link>
          </nav>
          <div className="w-10" />
        </div>
      </header>

      {/* ── HERO FULLSCREEN ── */}
      <section className="relative h-screen flex items-end pb-20 overflow-hidden">
        <img
          src={heroPhoto}
          alt="Wilkerson e Jamille"
          className="absolute inset-0 w-full h-full object-cover object-[50%_60%]"
        />
        {/* Gradientes */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-black/10" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/25 to-transparent" />

        <div className="relative z-10 max-w-7xl mx-auto px-8 w-full">
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
          >
            <motion.span
              className="text-white/60 uppercase tracking-[0.3em] text-xs font-medium mb-5 block"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1, delay: 0.4 }}
            >
              O tempo certo para o amor certo
            </motion.span>

            <h1 className="font-serif text-[clamp(3rem,12vw,9rem)] leading-[0.88] text-white mb-7">
              Wilkerson<br />
              <em className="font-light">&amp; Jamille</em>
            </h1>

            <p className="text-white/75 text-base sm:text-lg max-w-sm leading-relaxed mb-10">
              Depois de anos, 2.000 km de distância e muito crescimento — aqui estamos. Prontos para o nosso para sempre.
            </p>

            <button
              onClick={() => navigate('/presentes')}
              className="inline-flex items-center gap-2 px-8 py-4 bg-white text-[var(--color-ink)] rounded-full font-medium tracking-wide hover:bg-[var(--color-nude)] transition-all hover:scale-105 active:scale-95 shadow-lg"
            >
              Ver Lista de Presentes
            </button>
          </motion.div>
        </div>

        {/* Indicador de scroll */}
        <motion.div
          className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/50 flex flex-col items-center gap-1.5"
          animate={{ y: [0, 8, 0] }}
          transition={{ repeat: Infinity, duration: 2.2, ease: 'easeInOut' }}
        >
          <span className="text-[10px] uppercase tracking-[0.25em]">Rolar</span>
          <ChevronDown className="w-4 h-4" />
        </motion.div>
      </section>

      {/* ── INTRO HISTÓRIA ── */}
      <section className="py-24 px-6 bg-white relative">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-16 bg-[var(--color-nude-dark)]" />
        <FadeIn className="max-w-2xl mx-auto text-center">
          <span className="text-[var(--color-sage-dark)] uppercase tracking-[0.2em] text-xs font-medium mb-5 block">
            Nossa História
          </span>
          <h2 className="font-serif text-4xl sm:text-5xl text-[var(--color-ink)] mb-8 leading-tight">
            Uma história que<br />
            <em>precisava de tempo</em>
          </h2>
          <p className="text-[var(--color-ink-light)] text-base sm:text-lg leading-relaxed">
            Não foi um amor que chegou com fogos de artifício. Foi um amor que cresceu, que esperou o momento certo — e que quando chegou, chegou completo. A certeza foi construída na vida real, superando dificuldades de mãos dadas.
          </p>
        </FadeIn>
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-px h-16 bg-[var(--color-nude-dark)]" />
      </section>

      {/* ── TIMELINE — CAPÍTULOS ── */}
      <section className="py-20 px-6 bg-[var(--color-nude)]">
        <div className="max-w-5xl mx-auto space-y-24 lg:space-y-36">
          {CHAPTERS.map((chapter, i) => (
            <Fragment key={i}><FadeIn delay={0.05}>
              <div className={`flex flex-col ${i % 2 === 0 ? 'lg:flex-row' : 'lg:flex-row-reverse'} gap-10 lg:gap-20 items-center`}>

                {/* Foto */}
                <div className="w-full lg:w-[45%] shrink-0">
                  <div className="relative rounded-[1.5rem] overflow-hidden shadow-2xl aspect-[3/4] max-w-xs mx-auto lg:max-w-none">
                    <img
                      src={chapter.photo}
                      alt={chapter.label}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                  </div>
                </div>

                {/* Texto */}
                <div className="w-full lg:w-[55%] text-center lg:text-left">
                  <span
                    className="font-serif italic block leading-none mb-3"
                    style={{ fontSize: 'clamp(3rem,8vw,5rem)', color: 'var(--color-terracotta)', opacity: 0.35 }}
                  >
                    {chapter.year}
                  </span>
                  <h3 className="font-serif text-2xl sm:text-3xl text-[var(--color-ink)] mb-5">
                    {chapter.label}
                  </h3>
                  <p className="text-[var(--color-ink-light)] text-base sm:text-lg leading-relaxed">
                    {chapter.text}
                  </p>
                </div>
              </div>
            </FadeIn></Fragment>
          ))}
        </div>
      </section>

      {/* ── QUEM SOMOS — OS DOIS LADOS ── */}
      <section className="py-24 px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          <FadeIn className="text-center mb-14">
            <span className="text-[var(--color-sage-dark)] uppercase tracking-[0.2em] text-xs font-medium mb-4 block">
              Juntos, nos completamos
            </span>
            <h2 className="font-serif text-4xl sm:text-5xl text-[var(--color-ink)] leading-tight">
              Dois lados da<br /><em>mesma história</em>
            </h2>
          </FadeIn>

          <div className="grid md:grid-cols-2 gap-5">
            {/* O Sonhador */}
            <FadeIn delay={0.1}>
              <div className="bg-[var(--color-nude)] rounded-3xl p-8 lg:p-10 border border-[var(--color-nude-dark)] h-full flex flex-col">
                <div className="text-4xl mb-5">🌙</div>
                <div className="text-[var(--color-sage-dark)] uppercase tracking-[0.2em] text-xs font-medium mb-1">Wilkerson</div>
                <h3 className="font-serif text-2xl text-[var(--color-ink)] mb-4">O Sonhador</h3>
                <p className="text-[var(--color-ink-light)] leading-relaxed flex-1">
                  Sempre com a cabeça lá na frente e infinitos projetos na manga. O tipo de pessoa que vê uma roda gigante e já imagina os próximos dez planos de vida antes de chegar ao topo. O amor de verdade o fez sonhar ainda mais alto.
                </p>
                <div className="mt-6 pt-6 border-t border-[var(--color-nude-dark)]">
                  <p className="text-[var(--color-ink)] text-sm italic leading-relaxed">
                    "Quando ela começa a cantar de manhã, eu entro na dança — literalmente."
                  </p>
                </div>
              </div>
            </FadeIn>

            {/* A Planejadora */}
            <FadeIn delay={0.2}>
              <div className="bg-[var(--color-ink)] rounded-3xl p-8 lg:p-10 h-full flex flex-col">
                <div className="text-4xl mb-5">☀️</div>
                <div className="text-white/50 uppercase tracking-[0.2em] text-xs font-medium mb-1">Jamille</div>
                <h3 className="font-serif text-2xl text-white mb-4">A Planejadora</h3>
                <p className="text-white/65 leading-relaxed flex-1">
                  Tão ansiosa que, se tiver um plano para daqui a 50 anos, já perde noites de sono organizando cada detalhe. E acorda todo dia cantando <em className="text-white/80">"booooom dia, bom dia, bom diaaa"</em> com toda a energia do mundo.
                </p>
                <div className="mt-6 pt-6 border-t border-white/10">
                  <p className="text-white/75 text-sm italic leading-relaxed">
                    "Temos planos para os próximos 50 anos. Agora só falta lembrar de viver o hoje."
                  </p>
                </div>
              </div>
            </FadeIn>
          </div>

          {/* Conexão entre os dois */}
          <FadeIn delay={0.1} className="text-center mt-16">
            <Heart className="w-5 h-5 text-[var(--color-terracotta)] mx-auto mb-6 opacity-70" />
            <p className="text-[var(--color-ink-light)] text-lg sm:text-xl leading-relaxed max-w-2xl mx-auto font-light">
              É no <strong className="text-[var(--color-ink)] font-medium">hoje</strong> que a nossa melhor sintonia acontece. Juntos, descobrimos que o amor de verdade nos faz sonhar mais alto e destrava qualidades que a gente nem sabia que tinha.
            </p>
          </FadeIn>
        </div>
      </section>

      {/* ── GALERIA ── */}
      <section className="py-24 px-6 bg-[var(--color-nude-dark)]">
        <FadeIn className="text-center mb-12">
          <span className="text-[var(--color-sage-dark)] uppercase tracking-[0.2em] text-xs font-medium mb-4 block">
            Memórias
          </span>
          <h2 className="font-serif text-4xl sm:text-5xl text-[var(--color-ink)] leading-tight">
            Momentos que<br /><em>nos tornaram nós</em>
          </h2>
        </FadeIn>

        <div className="max-w-6xl mx-auto columns-2 md:columns-3 lg:columns-4 gap-3">
          {ALL_PHOTOS.map((src, i) => (
            <motion.div
              key={i}
              className="break-inside-avoid mb-3 rounded-xl overflow-hidden"
              initial={{ opacity: 0, scale: 0.97 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.55, delay: (i % 4) * 0.07 }}
            >
              <img
                src={src}
                alt={`Momento ${i + 1}`}
                className="w-full h-auto object-cover hover:scale-105 transition-transform duration-700"
                loading="lazy"
              />
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── CTA FINAL ── */}
      <section className="relative py-36 px-6 bg-[var(--color-ink)] overflow-hidden">
        {/* Círculos decorativos */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.04]">
          {[700, 500, 300].map(size => (
            <div
              key={size}
              className="absolute rounded-full border border-white"
              style={{ width: size, height: size }}
            />
          ))}
        </div>

        <FadeIn className="max-w-3xl mx-auto text-center relative z-10">
          <span className="text-white/40 uppercase tracking-[0.25em] text-xs font-medium mb-6 block">
            Faça parte do nosso novo começo
          </span>
          <h2 className="font-serif text-white leading-[0.9] mb-8"
            style={{ fontSize: 'clamp(2.8rem,8vw,5.5rem)' }}
          >
            O destino deu<br />
            <em className="font-light">algumas voltas.</em>
          </h2>
          <p className="text-white/60 text-base sm:text-lg leading-relaxed mb-12 max-w-lg mx-auto">
            Mas nos trouxe exatamente para onde deveríamos estar. Estamos muito felizes em dividir o nosso "para sempre" com vocês.
          </p>
          <button
            onClick={() => navigate('/presentes')}
            className="inline-flex items-center gap-2 px-10 py-5 bg-white text-[var(--color-ink)] rounded-full font-medium tracking-wide text-base hover:bg-[var(--color-nude)] transition-all hover:scale-105 active:scale-95 shadow-xl"
          >
            Ver Lista de Presentes
          </button>
        </FadeIn>
      </section>

      {/* ── FOOTER ── */}
      <footer className="py-12 bg-[var(--color-ink)] text-center border-t border-white/10">
        <p className="font-serif text-2xl text-white mb-3">W & J</p>
        <p className="text-sm text-white/35">
          Com amor, Wilkerson Mesquita & Jamille Mesquita.
        </p>
      </footer>
    </div>
  );
}
