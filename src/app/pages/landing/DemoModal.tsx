/* LA DÉMO DE 20 SECONDES — la pub produite dans `video/` (Remotion), jouée
   par-dessus la vitrine. Le fichier est servi tel quel depuis `public/demo/` :
   aucun lecteur tiers, aucun cookie, rien à consentir. Pour mettre la vidéo
   à jour, on remplace les fichiers de `public/demo/`.

   La lecture démarre au clic (le geste du visiteur autorise le son), sur
   l'image du dashboard en attendant les premières images. */
import { Modal } from "@/shared/ui/Modal";
import { Icon } from "./Icon";
import { useLandingT } from "./i18n";

/* WebM (VP9 + Opus) d'abord : Chromium sans codecs propriétaires ne lit pas le
   H.264. Le MP4 reste en secours pour Safari et les vieux navigateurs. */
const DEMO_WEBM = "/demo/tradevault-demo.webm";
const DEMO_MP4 = "/demo/tradevault-demo.mp4";
const DEMO_POSTER = "/demo/tradevault-demo-poster.jpg";

export function DemoModal({ onClose }: { onClose: () => void }) {
  const { t } = useLandingT();
  return (
    <Modal
      open
      onClose={onClose}
      labelledBy="demo-titre"
      className="tv-public max-w-5xl p-3 md:p-4"
    >
      <div className="mb-3 flex items-center justify-between gap-4 px-1">
        <h2 id="demo-titre" className="text-sm font-semibold text-white">
          {t("demo.title")}
        </h2>
        <button
          onClick={onClose}
          aria-label={t("auth.close")}
          className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 transition hover:bg-white/[.06] hover:text-white"
        >
          <Icon n="close" cls="h-4 w-4" />
        </button>
      </div>
      <video
        poster={DEMO_POSTER}
        controls
        autoPlay
        playsInline
        preload="auto"
        className="aspect-video w-full rounded-2xl bg-black"
      >
        <source src={DEMO_WEBM} type="video/webm" />
        <source src={DEMO_MP4} type="video/mp4" />
      </video>
    </Modal>
  );
}
