import React from 'react';
import { motion } from 'motion/react';

export interface Gift {
  id: string;
  title: string;
  description?: string;
  price: number;
  imageUrl: string;
  originalLink?: string;
  status: 'available' | 'reserved' | 'gifted';
  createdAt: any;
  authorUid: string;
  allowPartial?: boolean;
  totalParts?: number;
}

interface GiftCardProps {
  gift: Gift;
  onSelect: (gift: Gift) => void;
}

export function GiftCard({ gift, onSelect }: GiftCardProps) {
  const isAvailable = gift.status === 'available';

  return (
    <motion.div
      whileHover={isAvailable ? { y: -5 } : {}}
      className={`bg-white rounded-xl overflow-hidden shadow-sm border border-[var(--color-nude-dark)] flex flex-col transition-all ${
        !isAvailable ? 'opacity-60 grayscale-[50%]' : ''
      }`}
    >
      <div className="aspect-square w-full relative overflow-hidden bg-gray-50">
        <img
          src={gift.imageUrl}
          alt={gift.title}
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
        />
        {!isAvailable && (
          <div className="absolute inset-0 bg-white/40 backdrop-blur-[2px] flex items-center justify-center">
            <span className="bg-white/90 text-[var(--color-ink)] px-4 py-1 rounded-full text-xs font-medium tracking-widest uppercase">
              {gift.status === 'gifted' ? 'Presenteado' : 'Reservado'}
            </span>
          </div>
        )}
      </div>
      <div className="p-4 sm:p-6 flex flex-col flex-grow">
        <h3 className="font-serif text-base sm:text-lg text-[var(--color-ink)] mb-2 line-clamp-2">{gift.title}</h3>
        {gift.allowPartial && gift.totalParts && gift.totalParts > 1 && (
          <span className="inline-flex items-center gap-1 text-xs text-[var(--color-sage-dark)] bg-[var(--color-sage)]/10 px-2 py-0.5 rounded-full mb-2 w-fit">
            ✦ Pode ser presenteado em partes
          </span>
        )}
        <p className="text-sm text-[var(--color-ink-light)] mb-4 flex-grow line-clamp-2">
          {gift.description}
        </p>
        <div className="flex items-center justify-between mt-auto pt-4 border-t border-[var(--color-nude-dark)]">
          <span className="font-medium text-[var(--color-sage-dark)]">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(gift.price)}
          </span>
          <button
            onClick={() => onSelect(gift)}
            disabled={!isAvailable}
            className={`px-5 py-2 rounded-full text-sm font-medium transition-colors ${
              isAvailable
                ? 'bg-[var(--color-sage)] text-white hover:bg-[var(--color-sage-dark)]'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            Presentear
          </button>
        </div>
      </div>
    </motion.div>
  );
}
