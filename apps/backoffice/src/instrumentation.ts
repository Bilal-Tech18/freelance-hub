/**
 * Scheduler interne (gratuit, pas de cron externe) : au démarrage du serveur,
 * l'app se pinge elle-même sur /api/cron/tick — monitoring des sites clients
 * + relances internes de factures. Le web service Render (starter) tourne
 * 24h/24, donc l'intervalle est fiable ; en cas de redéploiement le timer
 * repart simplement.
 *
 * En dev le scheduler est coupé (mettre CRON_INTERNAL=1 pour le tester).
 */

const TICK_EVERY_MS = 30 * 60 * 1000; // 30 min
const FIRST_TICK_DELAY_MS = 60 * 1000; // laisse le serveur finir de démarrer

export function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NODE_ENV !== "production" && process.env.CRON_INTERNAL !== "1") return;

  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.warn("[cron] CRON_SECRET absent — scheduler interne désactivé.");
    return;
  }

  const url = `http://127.0.0.1:${process.env.PORT ?? 3001}/api/cron/tick`;
  let running = false;
  const tick = async () => {
    if (running) return; // pas de ticks concurrents si un check traîne
    running = true;
    try {
      const res = await fetch(url, {
        headers: { authorization: `Bearer ${secret}` },
      });
      if (!res.ok) console.error(`[cron] tick a répondu ${res.status}`);
    } catch (e) {
      console.error("[cron] tick en échec:", e);
    } finally {
      running = false;
    }
  };

  setTimeout(() => {
    void tick();
    setInterval(() => void tick(), TICK_EVERY_MS);
  }, FIRST_TICK_DELAY_MS);
  console.log("[cron] scheduler interne démarré (tick toutes les 30 min)");
}
