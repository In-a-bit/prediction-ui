export interface CasinoGame {
  id: string;
  title: string;
  description: string;
  href: string;
  comingSoon: boolean;
  category: string;
  gradient: string;
  icon: string;
  image: string;
  accent: string;
  featured: boolean;
}

export const casinoGames: CasinoGame[] = [
  {
    id: "blackjack",
    title: "Blackjack",
    description: "Beat the dealer to 21 without going bust",
    href: "/games/blackjack",
    comingSoon: true,
    category: "cards",
    gradient: "from-emerald-600 to-emerald-900",
    icon: "M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z",
    image: "https://images.unsplash.com/photo-1541278107931-e006523892df?w=600&h=400&fit=crop",
    accent: "emerald",
    featured: true,
  },
  {
    id: "roulette",
    title: "Roulette",
    description: "Spin the wheel and place your bets",
    href: "/games/roulette",
    comingSoon: true,
    category: "table",
    gradient: "from-red-600 to-red-900",
    icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
    image: "https://images.unsplash.com/photo-1596838132731-3301c3fd4317?w=600&h=400&fit=crop",
    accent: "red",
    featured: true,
  },
  {
    id: "slots",
    title: "Slots",
    description: "Try your luck on the slot machines",
    href: "/games/slots",
    comingSoon: true,
    category: "machines",
    gradient: "from-yellow-500 to-orange-600",
    icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
    image: "https://images.unsplash.com/photo-1606167668584-78701c57f13d?w=600&h=400&fit=crop",
    accent: "amber",
    featured: true,
  },
  {
    id: "poker",
    title: "Poker",
    description: "Texas Hold'em against other players",
    href: "/games/poker",
    comingSoon: true,
    category: "cards",
    gradient: "from-blue-600 to-blue-900",
    icon: "M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z",
    image: "https://images.unsplash.com/photo-1609743522653-52354461eb27?w=600&h=400&fit=crop",
    accent: "blue",
    featured: true,
  },
  {
    id: "baccarat",
    title: "Baccarat",
    description: "Bet on the player, banker, or tie",
    href: "/games/baccarat",
    comingSoon: true,
    category: "cards",
    gradient: "from-purple-600 to-purple-900",
    icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
    image: "https://images.unsplash.com/photo-1517232115160-ff93364542dd?w=600&h=400&fit=crop",
    accent: "purple",
    featured: false,
  },
  {
    id: "craps",
    title: "Craps",
    description: "Roll the dice and beat the house",
    href: "/games/craps",
    comingSoon: true,
    category: "dice",
    gradient: "from-teal-500 to-teal-800",
    icon: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4",
    image: "https://images.unsplash.com/photo-1511193311914-0346f16efe90?w=600&h=400&fit=crop",
    accent: "teal",
    featured: false,
  },
  {
    id: "dice",
    title: "Dice",
    description: "Predict the roll and win big",
    href: "/games/dice",
    comingSoon: true,
    category: "dice",
    gradient: "from-pink-500 to-rose-700",
    icon: "M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z",
    image: "https://images.unsplash.com/photo-1522069213448-443a614da9b6?w=600&h=400&fit=crop",
    accent: "pink",
    featured: false,
  },
  {
    id: "coin-flip",
    title: "Coin Flip",
    description: "Heads or tails — double or nothing",
    href: "/games/coin-flip",
    comingSoon: true,
    category: "instant",
    gradient: "from-amber-500 to-yellow-700",
    icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
    image: "https://images.unsplash.com/photo-1621944190310-e3cca1564bd7?w=600&h=400&fit=crop",
    accent: "yellow",
    featured: false,
  },
];
