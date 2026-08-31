import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'

interface Coin {
  id: number
  x: number
  rotate: number
  delay: number
}

function spawnCoins(count: number): Coin[] {
  return Array.from({ length: count }, (_, id) => ({
    id,
    x: (Math.random() - 0.5) * 180,
    rotate: (Math.random() - 0.5) * 360,
    delay: Math.random() * 0.15,
  }))
}

/** Renders a burst of flying coin emojis whenever `trigger` changes to a new, non-zero value. */
export function CoinBurst({ trigger }: { trigger: number }) {
  const [coins, setCoins] = useState<Coin[]>([])

  useEffect(() => {
    if (trigger === 0) return
    setCoins(spawnCoins(14))
    const timeout = setTimeout(() => setCoins([]), 900)
    return () => clearTimeout(timeout)
  }, [trigger])

  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-visible" aria-hidden="true">
      <AnimatePresence>
        {coins.map((coin) => (
          <motion.span
            key={`${trigger}-${coin.id}`}
            initial={{ opacity: 1, x: 0, y: 0, scale: 0.5, rotate: 0 }}
            animate={{ opacity: 0, x: coin.x, y: -90 - Math.random() * 50, scale: 1, rotate: coin.rotate }}
            transition={{ duration: 0.8, delay: coin.delay, ease: 'easeOut' }}
            className="absolute left-1/2 top-1/2 text-2xl"
          >
            🪙
          </motion.span>
        ))}
      </AnimatePresence>
    </div>
  )
}
