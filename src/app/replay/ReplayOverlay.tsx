/**
 * ReplayOverlay — la couche prix/temps par-dessus le graphe.
 *
 * Tout ce qui est ancré à des coordonnées MARKET (et pas au pixel) vit ici,
 * aligné sur le graphe via les conversions de lightweight-charts :
 *   • les DESSINS (lignes, rectangles, zones, textes) ;
 *   • les ORDRES (lignes de prix des ordres en carnet, brackets SL/TP) ;
 *   • les positions (prix d'entrée moyen) et les exécutions ;
 *   • les ombrages ETH/RTH.
 *
 * En mode curseur, la couche est transparente SAUF là où quelque chose se
 * saisit : les poignées (ancres, étiquettes d'ordres, curseurs de bracket) et
 * les bandes de prise des dessins, qui ouvrent leur fiche — nom, couleur,
 * suppression. Partout ailleurs le graphe garde zoom et déplacement. En mode
 * dessin, la couche capture les clics pour poser les ancres du nouvel outil.
 */

import { useEffect, useRef, useState, type MutableRefObject, type PointerEvent } from "react";
import type { UTCTimestamp } from "lightweight-charts";
import { Trash2, X } from "lucide-react";
import { useT } from "../i18n/LanguageContext";
import { cn } from "../utils/cn";
import type { ChartView } from "./ReplayChart";
import type { Drawing, Order, Position } from "@/modules/replay";
import { instrumentOf, pnlOf } from "@/modules/replay";

export type ReplayTool =
  | "cursor"
  | "hline"
  | "trend"
  | "ray"
  | "rect"
  | "vline"
  | "text"
  | "measured"
  | "zone"
  | "fib"
  | "erase";

const SL = "var(--tv-chart-red)";
const TP = "var(--tv-chart-green)";

/** Les retracements de Fibonacci — les niveaux de la plateforme de référence. */
const FIB_LEVELS: { ratio: number; label: string }[] = [
  { ratio: 0, label: "0" },
  { ratio: 0.236, label: "23.6" },
  { ratio: 0.382, label: "38.2" },
  { ratio: 0.5, label: "50" },
  { ratio: 0.618, label: "61.8" },
  { ratio: 0.786, label: "78.6" },
  { ratio: 1, label: "1" },
];

const PLACING: Record<string, boolean> = {
  hline: true,
  trend: true,
  ray: true,
  rect: true,
  vline: true,
  text: true,
  measured: true,
  zone: true,
  fib: true,
};
const ONE_CLICK = new Set(["hline", "vline", "text"]);

/** Un montant signé, court, tel qu'une plateforme l'affiche sur une ligne. */
function money$(n: number): string {
  const sign = n >= 0 ? "+" : "−";
  return `~ ${sign}$${Math.abs(n).toFixed(2)}`;
}

/**
 * Le même montant, mais ACQUIS À L'INSTANT — le P&L ouvert.
 *
 * Sans le « ~ » : ce n'est pas une estimation à un prix qu'on vise, c'est ce
 * que la position vaut maintenant, au prix marqué. Confondre les deux
 * lectures sur la même ligne serait le pire des deux mondes.
 */
function live$(n: number): string {
  const sign = n >= 0 ? "+" : "−";
  return `${sign}$${Math.abs(n).toFixed(2)}`;
}

interface OverlayProps {
  view: MutableRefObject<ChartView>;
  drawings: Drawing[];
  orders: Order[];
  positions: Position[];
  executions: {
    at: number;
    price: number;
    side: "long" | "short";
    qty: number;
    kind?: "entry" | "exit";
  }[];
  bounds: {
    ethStart: number;
    ethEnd: number;
    rthStart: number;
    rthEnd: number;
    rthWindows?: { start: number; end: number }[];
  };
  showRthEth: boolean;
  /**
   * Les ordres, positions et exécutions sont-ils tracés ?
   *
   * Réglage du graphe, pas du carnet : couper l'affichage ne touche à aucun
   * ordre. Cela sert à relire une structure de prix sans ses propres traits
   * par-dessus — ce que toute plateforme permet.
   */
  showOrders?: boolean;
  /** Le `<svg>` de la couche, exposé pour la capture d'un trade clôturé. */
  exportRef?: MutableRefObject<SVGSVGElement | null>;
  tool: ReplayTool;
  mark: number;
  onAddDrawing: (d: Drawing) => void;
  onUpdateDrawing: (d: Drawing) => void;
  /** Supprimer UN dessin — depuis sa propre fiche, pas depuis le rail. */
  onRemoveDrawing: (id: string) => void;
  onMoveOrder: (orderId: string, price: number) => void;
  /**
   * Déplacer le bracket d'un ordre encore en carnet.
   * `undefined` sur une jambe = on n'y touche pas ; `null` = on la retire.
   */
  onMoveOrderBracket: (
    orderId: string,
    sl: number | null | undefined,
    tp: number | null | undefined,
  ) => void;
  /** Annuler depuis le graphe : la croix des étiquettes d'ordre. */
  onCancelOrder: (orderId: string) => void;
  /**
   * Poser ou déplacer le bracket d'une POSITION OUVERTE (`null` = pas de
   * jambe). Sert au glissement depuis la ligne d'entrée.
   */
  onBracket: (posId: string, sl: number | null, tp: number | null) => void;
  /** Le contrat de la séance — donne le spec pour chiffrer un bracket. */
  symbol: string;
  /** Couleur des dessins À VENIR. Les dessins déjà posés gardent la leur. */
  drawColor: string;
  /** Les couleurs proposées pour reteinter un dessin déjà posé. */
  palette: readonly string[];
  /**
   * Le dessin est posé — l'outil a fini son travail.
   *
   * Le terminal en profite pour revenir au curseur, comme toute plateforme de
   * graphes : sans ça, chaque clic suivant poserait un dessin de plus, et le
   * clic qu'on voulait faire POUR EN SÉLECTIONNER UN en créerait un autre.
   */
  onToolDone?: () => void;
}

/**
 * L'étiquette d'un dessin — « PDH », « BSL », « SSL ».
 *
 * Un niveau sans nom oblige à se rappeler POURQUOI on l'a tracé ; au bout de
 * trois traits, on ne s'en souvient plus. Le nom se pose sur le trait, à
 * gauche, comme sur TradingView, et il est cerné d'un liseré de la couleur du
 * fond (`paintOrder: stroke`) pour rester lisible quand une bougie passe
 * dessous.
 */
function DrawingLabel({
  x,
  y,
  color,
  text,
  anchor = "start",
}: {
  x: number;
  y: number;
  color: string;
  text: string;
  anchor?: "start" | "middle";
}) {
  return (
    <text
      x={x}
      y={y}
      fill={color}
      fontSize={10}
      fontWeight={800}
      letterSpacing={0.5}
      textAnchor={anchor}
      stroke="var(--tv-plate-0)"
      strokeWidth={3}
      strokeLinejoin="round"
      paintOrder="stroke"
      style={{ pointerEvents: "none" }}
    >
      {text}
    </text>
  );
}

/**
 * Une étiquette de prix — la carte de visite des ordres et des positions.
 * Plaquette arrondie au liseré teinté, pastille de direction, prix en tabular :
 * le vocabulaire d'un terminal pro, conforme à la grammaire TradeVault.
 */
function PriceTag({
  x,
  y,
  color,
  label,
  value,
  money,
  moneyColor,
  drag,
  onCancel,
}: {
  x: number;
  y: number;
  color: string;
  label: string;
  value: string;
  /** Ce que l'ordre rapporterait ou coûterait s'il se remplissait maintenant. */
  money?: string | null;
  /** Teinte du montant — le signe du P&L, quand il en porte un. */
  moneyColor?: string;
  drag?: {
    onDown: (ev: React.PointerEvent<SVGElement>) => void;
    onMove: (ev: React.PointerEvent<SVGElement>) => void;
    onUp: (ev: React.PointerEvent<SVGElement>) => void;
  };
  /** Annuler l'ordre sans quitter le graphe. */
  onCancel?: () => void;
}) {
  // La plaquette s'élargit de ce qu'elle porte en plus : le montant, puis la
  // croix. Une largeur fixe aurait tronqué l'un ou chevauché l'autre.
  const w = 112 + (money ? 54 : 0) + (onCancel ? 18 : 0);
  return (
    <g
      style={drag ? { pointerEvents: "auto", cursor: "ns-resize" } : { pointerEvents: "none" }}
      onPointerDown={drag?.onDown}
      onPointerMove={drag?.onMove}
      onPointerUp={drag?.onUp}
    >
      <rect
        x={x}
        y={y - 9.5}
        width={w}
        height={19}
        rx={5.5}
        fill={color}
        fillOpacity={0.13}
        stroke={color}
        strokeOpacity={0.45}
        strokeWidth={1}
      />
      <circle cx={x + 11} cy={y} r={2.7} fill={color} />
      <text
        x={x + 19}
        y={y + 3.2}
        fill={color}
        fontSize={9.5}
        fontWeight={800}
        letterSpacing={0.4}
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {label}
      </text>
      {/* Le montant en jeu, entre le libellé et le prix. « ~ » parce que c'est
        une ESTIMATION au prix du bracket, pas un résultat acquis. */}
      {money && (
        <text
          x={x + w - (onCancel ? 18 : 0) - 62}
          y={y + 3.2}
          fill={moneyColor ?? "var(--tv-text)"}
          fontSize={9.5}
          fontWeight={700}
          textAnchor="end"
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {money}
        </text>
      )}
      <text
        x={x + w - (onCancel ? 18 : 0) - 9}
        y={y + 3.2}
        fill="var(--tv-text)"
        fontSize={9.5}
        fontWeight={700}
        textAnchor="end"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {value}
      </text>
      {/* Annuler sans quitter le graphe : le geste est là où se trouve l'ordre,
        pas dans un panneau qu'il faut aller chercher. `stopPropagation` évite
        que le clic démarre un glissement de l'étiquette. */}
      {onCancel && (
        <g
          style={{ pointerEvents: "auto", cursor: "pointer" }}
          onPointerDown={(ev) => {
            ev.stopPropagation();
            onCancel();
          }}
        >
          <rect x={x + w - 18} y={y - 9.5} width={18} height={19} fill="transparent" />
          <path
            d={`M ${x + w - 13} ${y - 4} l 8 8 M ${x + w - 5} ${y - 4} l -8 8`}
            stroke={color}
            strokeWidth={1.4}
            strokeLinecap="round"
            fill="none"
          />
        </g>
      )}
    </g>
  );
}

/**
 * LES DEUX ZONES D'UN BRACKET — ce qu'on risque, ce qu'on vise.
 *
 * Une bande rouge de l'entrée au stop, une verte de l'entrée à l'objectif,
 * chacune bordée de pointillés. C'est la lecture que donne une plateforme de
 * trading : l'engagement se voit sans lire un chiffre, et la proportion entre
 * les deux EST le rapport risque/gain.
 *
 * La même forme sert pour une position ouverte et pour un ordre encore en
 * carnet — parce que c'est la même chose à un remplissage près. Seule
 * l'intensité change (`pending`) : un bracket qui n'a pas encore d'existence
 * ne doit pas peser autant à l'œil qu'un risque réellement pris.
 */
function BracketZones({
  W,
  entryY,
  slY,
  tpY,
  pending = false,
}: {
  W: number;
  entryY: number;
  slY: number | null;
  tpY: number | null;
  pending?: boolean;
}) {
  const zone = (yy: number, color: string) => (
    <g>
      <rect
        x={0}
        y={Math.min(entryY, yy)}
        width={W}
        height={Math.abs(yy - entryY)}
        fill={color}
        opacity={pending ? 0.07 : 0.12}
      />
      <rect
        x={0.5}
        y={Math.min(entryY, yy)}
        width={W - 1}
        height={Math.abs(yy - entryY)}
        fill="none"
        stroke={color}
        strokeWidth={1}
        strokeDasharray="4 4"
        opacity={pending ? 0.32 : 0.5}
      />
    </g>
  );
  return (
    <>
      {slY != null && Math.abs(slY - entryY) > 1 && zone(slY, SL)}
      {tpY != null && Math.abs(tpY - entryY) > 1 && zone(tpY, TP)}
    </>
  );
}

/**
 * LA MARQUE D'UNE EXÉCUTION.
 *
 * Deux formes, parce que ce sont deux faits différents :
 *
 *  • ENTRÉE — un chevron qui pointe DANS LE SENS de la position. Il dit
 *    « je suis rentré ici, et dans cette direction » ; c'est la première chose
 *    qu'on cherche en relisant une séance.
 *  • SORTIE — le losange, la signature d'un fill qui referme.
 *
 * Les deux portent un liseré de la couleur du fond : une marque posée sur une
 * mèche doit rester lisible, et un aplat nu s'y noierait.
 */
function FillMark({
  cx,
  cy,
  color,
  kind,
  side,
}: {
  cx: number;
  cy: number;
  color: string;
  kind: "entry" | "exit";
  side: "long" | "short";
}) {
  if (kind === "entry") {
    // Pointe vers le haut pour un achat, vers le bas pour une vente.
    const d = side === "long" ? -1 : 1;
    return (
      <path
        d={`M ${cx} ${cy + d * 6} L ${cx + 5} ${cy - d * 3} L ${cx - 5} ${cy - d * 3} Z`}
        fill={color}
        stroke="var(--tv-plate-0)"
        strokeWidth={1}
        strokeLinejoin="round"
      />
    );
  }
  return (
    <rect
      x={cx - 3}
      y={cy - 3}
      width={6}
      height={6}
      rx={1}
      fill={color}
      stroke="var(--tv-plate-0)"
      strokeWidth={1}
      transform={`rotate(45 ${cx} ${cy})`}
    />
  );
}

interface DragState {
  orderId?: string;
  drawingId?: string;
  anchor?: number;
  /**
   * Glissement du bracket d'un ordre ENCORE EN CARNET.
   *
   * Distinct de `orderId` : tant que l'entrée n'est pas remplie, son stop et
   * son objectif ne sont pas des ordres qu'on déplace, mais deux nombres
   * portés par l'entrée.
   */
  bracketOrderId?: string;
  leg?: "sl" | "tp";
  /**
   * Glissement DEPUIS UNE POSITION OUVERTE.
   *
   * Le geste le plus direct qui soit : on attrape sa position et on tire. Vers
   * la perte, on pose le stop ; vers le gain, l'objectif. Le sens décide donc
   * de la jambe, et non un menu — ce qui, pour un long, met le stop en bas, et
   * pour un short, en haut, sans rien avoir à choisir.
   */
  positionId?: string;
}

export default function ReplayOverlay({
  view,
  drawings,
  orders,
  positions,
  executions,
  bounds,
  showRthEth,
  showOrders = true,
  exportRef,
  tool,
  mark,
  onAddDrawing,
  onUpdateDrawing,
  onRemoveDrawing,
  onMoveOrder,
  onMoveOrderBracket,
  onCancelOrder,
  onBracket,
  symbol,
  drawColor,
  palette,
  onToolDone,
}: OverlayProps) {
  const { t } = useT();
  const [pane, setPane] = useState<{ w: number; h: number } | null>(null);
  const [draft, setDraft] = useState<Drawing | null>(null);
  /** Le dessin dont la fiche est ouverte — nom, couleur, suppression. */
  const [selected, setSelected] = useState<string | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const chart = view.current.chart;
  const candles = view.current.candles;

  // ── L'OVERLAY SUIT LA PROJECTION DU GRAPHE ──────────────────────────────
  //
  // Tout ce qui est dessiné ici est converti prix/temps → pixels À CHAQUE
  // RENDU. Encore faut-il qu'un rendu ait lieu quand la projection change :
  // sinon les ordres, les brackets et les traits restent collés à leurs
  // anciens pixels pendant qu'on zoome ou qu'on déplace le graphe — ils se
  // décrochent des bougies, ce qui est exactement ce qu'il ne faut pas.
  //
  // On échantillonne donc la projection à chaque image : la plage logique
  // visible (axe des temps), la taille du pane, et deux prix lus à deux
  // hauteurs (axe des prix, que la librairie n'expose par aucun événement).
  // Ces cinq nombres décrivent entièrement la transformation ; dès que l'un
  // bouge, on redessine, et jamais autrement.
  const [projection, setProjection] = useState(0);
  useEffect(() => {
    let raf = 0;
    let sig = "";
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const c = view.current.chart;
      const s = view.current.candles;
      if (!c || !s) return;
      let next: string;
      try {
        const range = c.timeScale().getVisibleLogicalRange();
        const size = c.paneSize();
        next = `${range?.from ?? 0}|${range?.to ?? 0}|${size.width}|${size.height}|${s.coordinateToPrice(0) ?? 0}|${s.coordinateToPrice(100) ?? 0}`;
      } catch {
        return; // graphe en cours de démontage
      }
      if (next === sig) return;
      sig = next;
      const size = c.paneSize();
      setPane({ w: size.width, h: size.height });
      setProjection((n) => n + 1);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  void projection;

  // Changer d'outil, c'est changer d'intention : la fiche du dessin précédent
  // n'a plus lieu d'être ouverte au-dessus du trait qu'on s'apprête à poser.
  useEffect(() => {
    // L'ébauche en cours meurt avec l'outil qui l'a commencée : garder un
    // point posé pour un rectangle qu'on ne veut plus le ferait apparaître au
    // premier clic de l'outil suivant.
    setDraft(null);
    if (tool !== "cursor") setSelected(null);
  }, [tool]);

  // Échap referme la fiche. Sur un graphe, on ne veut pas avoir à VISER une
  // croix pour se débarrasser d'un panneau : la touche est toujours là.
  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);

  const coord = (tMs: number, price: number): { x: number | null; y: number | null } => {
    if (!chart || !candles) return { x: null, y: null };
    return {
      x: chart.timeScale().timeToCoordinate((tMs / 1000) as UTCTimestamp),
      y: candles.priceToCoordinate(price),
    };
  };

  const W = pane?.w ?? 0;
  const H = pane?.h ?? 0;

  const toMarket = (ev: {
    clientX: number;
    clientY: number;
  }): { ms: number; price: number } | null => {
    const c = view.current.chart;
    const s = view.current.candles;
    const svg = svgRef.current;
    if (!c || !s || !svg) return null;
    const rect = svg.getBoundingClientRect();
    const x = ev.clientX - rect.left;
    const y = ev.clientY - rect.top;
    const timeSec = c.timeScale().coordinateToTime(x) as number | null;
    const price = s.coordinateToPrice(y);
    if (timeSec == null || price == null) return null;
    return { ms: timeSec * 1000, price };
  };

  // ── Placement d'un nouveau dessin (mode dessin) ─────────────────────────
  const onPlaceDown = (ev: PointerEvent<SVGRectElement>) => {
    if (ev.button !== 0) return;
    const m = toMarket(ev);
    if (!m) return;
    if (!draft) {
      // UN CLIC SUFFIT là où un seul point définit la forme. Demander un
      // second clic pour un niveau horizontal laissait le trait invisible
      // entre les deux, posé au premier point et non au dernier : on croyait
      // l'avoir raté, on recliquait, et on en avait deux.
      if (ONE_CLICK.has(tool)) {
        const id = nextDrawId();
        onAddDrawing({
          id,
          kind: tool as Drawing["kind"],
          color: drawColor,
          points: [{ x: m.ms, y: m.price }],
        });
        // La fiche s'ouvre dans la foulée : on vient de poser un niveau, le
        // geste suivant est de le NOMMER (« PDH », « BSL »). Pour l'outil
        // texte, c'est même la seule façon d'écrire quoi que ce soit.
        setSelected(id);
        onToolDone?.();
        return;
      }
      setDraft({
        id: "draft",
        kind: tool as Drawing["kind"],
        color: drawColor,
        points: [{ x: m.ms, y: m.price }],
      });
      return;
    }
    // Deuxième clic : la forme tient dans son premier point et celui-ci. On
    // REMPLACE le point de prévisualisation au lieu de l'empiler — l'ancien
    // code gardait la dernière position survolée et posait une troisième
    // ancre, invisible car superposée, mais bien là quand on essayait de
    // saisir la deuxième.
    onAddDrawing({
      ...draft,
      points: [draft.points[0], { x: m.ms, y: m.price }],
      id: nextDrawId(),
    });
    setDraft(null);
    onToolDone?.();
  };

  const onPlaceMove = (ev: PointerEvent<SVGRectElement>) => {
    if (!draft || draft.points.length >= 2) return;
    const m = toMarket(ev);
    if (m) setDraft({ ...draft, points: [draft.points[0], { x: m.ms, y: m.price }] });
  };

  // ── Poignées : drag avec capture du pointeur ────────────────────────────
  const handleDown = (state: DragState) => (ev: PointerEvent<SVGElement>) => {
    if (ev.button !== 0) return;
    ev.preventDefault();
    ev.stopPropagation();
    try {
      (ev.currentTarget as Element).setPointerCapture?.(ev.pointerId);
    } catch {
      /* capture facultative */
    }
    dragRef.current = state;
  };

  const handleMove = (ev: PointerEvent<SVGElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const m = toMarket(ev);
    if (!m) return;
    if (drag.positionId) {
      const pos = positions.find((p) => p.id === drag.positionId);
      if (!pos) return;
      // De quel côté de l'entrée le doigt se trouve-t-il ? C'est ce qui dit
      // s'il dessine un risque ou un objectif.
      const isSl = pos.side === "long" ? m.price < pos.avgEntry : m.price > pos.avgEntry;
      const existing = isSl ? pos.stop : pos.target;
      // La jambe existe déjà : on la DÉPLACE. La recréer à chaque image
      // aurait laissé derrière elle une traînée d'ordres annulés.
      if (existing) onMoveOrder(existing.id, m.price);
      else if (isSl) onBracket(pos.id, m.price, pos.target?.price ?? null);
      else onBracket(pos.id, pos.stop?.price ?? null, m.price);
      return;
    }
    if (drag.bracketOrderId) {
      // Une seule jambe bouge : l'autre passe en `undefined`, qui veut dire
      // « n'y touche pas ». Passer `null` l'aurait effacée.
      onMoveOrderBracket(
        drag.bracketOrderId,
        drag.leg === "sl" ? m.price : undefined,
        drag.leg === "tp" ? m.price : undefined,
      );
      return;
    }
    if (drag.orderId) {
      const o = orders.find((x) => x.id === drag.orderId);
      if (o && o.price != null) onMoveOrder(drag.orderId, m.price);
      return;
    }
    const dr = drawings.find((d) => d.id === drag.drawingId);
    if (!dr || drag.anchor == null) return;
    const next = dr.points.map((p, i) => (i === drag.anchor ? { x: m.ms, y: m.price } : p));
    onUpdateDrawing({ ...dr, points: next });
  };

  const handleUp = () => {
    dragRef.current = null;
  };

  // ── Formes ──────────────────────────────────────────────────────────────
  const anchorsOf = (d: Drawing) =>
    d.points.map((p, i) => {
      const { x, y } = coord(p.x, p.y);
      if (x == null || y == null) return null;
      return (
        <circle
          key={i}
          cx={x}
          cy={y}
          r={5}
          fill={d.color}
          style={{ pointerEvents: "auto", cursor: "move" }}
          onPointerDown={handleDown({ drawingId: d.id, anchor: i })}
          onPointerMove={handleMove}
          onPointerUp={handleUp}
        />
      );
    });

  /** En mode curseur, un dessin s'ATTRAPE : le clic ouvre sa fiche. */
  const pickable = tool === "cursor";

  const shapes = drawings.map((d) => {
    const pt = (i: number) => {
      const p = d.points[i] ?? d.points[0];
      const c = coord(p.x, p.y);
      return [c.x, c.y] as const;
    };
    const [x0, y0] = pt(0);
    const [x1, y1] = pt(1);
    if (x0 == null || y0 == null) return null;
    let body: React.ReactNode = null;
    // La zone de PRISE : la même géométrie, en transparent et bien plus
    // épaisse. Viser un trait d'un pixel à la souris est une loterie ; c'est
    // la bande invisible qu'on attrape, pas le trait.
    let grab: React.ReactNode = null;
    // L'étiquette du dessin, posée là où elle se lit — sur le trait, au bord.
    let label: React.ReactNode = null;

    switch (d.kind) {
      case "hline":
        body = <line x1={0} y1={y0 as number} x2={W} y2={y0 as number} />;
        grab = <line x1={0} y1={y0 as number} x2={W} y2={y0 as number} />;
        if (d.text)
          label = <DrawingLabel x={6} y={(y0 as number) - 5} color={d.color} text={d.text} />;
        break;
      case "vline":
        body = <line x1={x0} y1={0} x2={x0} y2={H} strokeDasharray="3 3" />;
        grab = <line x1={x0} y1={0} x2={x0} y2={H} />;
        if (d.text) label = <DrawingLabel x={x0 + 5} y={12} color={d.color} text={d.text} />;
        break;
      case "trend":
        if (x1 == null || y1 == null) break;
        body = <line x1={x0} y1={y0} x2={x1} y2={y1} />;
        grab = <line x1={x0} y1={y0} x2={x1} y2={y1} />;
        if (d.text) label = <DrawingLabel x={x0 + 6} y={y0 - 6} color={d.color} text={d.text} />;
        break;
      case "ray": {
        if (x1 == null || y1 == null) break;
        const dx = x1 - x0;
        const dy = y1 - y0;
        const ln = Math.hypot(dx, dy) || 1;
        const ex = x0 + (dx / ln) * W * 4;
        const ey = y0 + (dy / ln) * W * 4;
        body = <line x1={x0} y1={y0} x2={ex} y2={ey} />;
        grab = <line x1={x0} y1={y0} x2={ex} y2={ey} />;
        if (d.text) label = <DrawingLabel x={x0 + 6} y={y0 - 6} color={d.color} text={d.text} />;
        break;
      }
      case "measured": {
        if (x1 == null || y1 == null) break;
        body = (
          <>
            <line x1={x0} y1={y0} x2={x1} y2={y1} />
            <text
              x={(x0 + x1) / 2}
              y={(y0 + y1) / 2 - 5}
              fill={d.color}
              fontSize={10}
              textAnchor="middle"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {Math.abs(priceAt(d, 0) - priceAt(d, 1)).toFixed(1)} pts
            </text>
          </>
        );
        grab = <line x1={x0} y1={y0} x2={x1} y2={y1} />;
        break;
      }
      case "fib": {
        if (x1 == null || y1 == null) break;
        const p0 = d.points[0];
        const p1 = d.points[1];
        const diff = p1.y - p0.y;
        const levels = FIB_LEVELS.map((lvl) => {
          const price = p0.y + diff * lvl.ratio;
          const cy = coord(0, price).y;
          if (cy == null) return null;
          const strong = lvl.ratio === 0 || lvl.ratio === 0.5 || lvl.ratio === 1;
          return (
            <g key={lvl.label} opacity={strong ? 0.85 : 0.5}>
              <line
                x1={0}
                y1={cy}
                x2={W}
                y2={cy}
                stroke={d.color}
                strokeWidth={0.75}
                strokeDasharray="4 4"
              />
              <text
                x={W - 34}
                y={cy + 3}
                fill={d.color}
                fontSize={8.5}
                fontWeight={strong ? 800 : 600}
                textAnchor="middle"
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {lvl.label}
              </text>
              <text
                x={W - 4}
                y={cy + 3}
                fill={d.color}
                fontSize={8.5}
                textAnchor="end"
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {price.toFixed(2)}
              </text>
            </g>
          );
        });
        body = (
          <>
            <line x1={x0} y1={y0} x2={x1} y2={y1} />
            {levels}
          </>
        );
        grab = <line x1={x0} y1={y0} x2={x1} y2={y1} />;
        break;
      }
      case "rect":
      case "zone": {
        if (x1 == null || y1 == null) break;
        const x = Math.min(x0, x1);
        const y = Math.min(y0, y1);
        const w = Math.abs(x1 - x0);
        const h = Math.abs(y1 - y0);
        body = (
          <rect
            x={x}
            y={y}
            width={w}
            height={h}
            fill={d.kind === "zone" ? d.color : "none"}
            fillOpacity={0.1}
            stroke={d.color}
          />
        );
        // LE CONTOUR SEULEMENT. Rendre l'intérieur d'une zone cliquable
        // aurait volé au graphe le glissement partout où elle s'étend.
        grab = <rect x={x} y={y} width={w} height={h} fill="none" />;
        if (d.text) label = <DrawingLabel x={x + 5} y={y - 5} color={d.color} text={d.text} />;
        break;
      }
      case "text":
        body = (
          <text x={x0} y={y0 - 4} fill={d.color} fontSize={11} fontWeight={600}>
            {d.text || "A"}
          </text>
        );
        grab = <rect x={x0 - 3} y={y0 - 16} width={72} height={18} fill="none" />;
        break;
    }
    if (body == null) return null;
    const isSel = d.id === selected;
    return (
      <g key={d.id} stroke={d.color} strokeWidth={isSel ? 1.9 : 1.1}>
        {body}
        {label}
        {grab && pickable && (
          <g
            stroke="transparent"
            strokeWidth={12}
            fill="none"
            style={{ pointerEvents: "auto", cursor: "pointer" }}
            onPointerDown={(ev) => {
              ev.stopPropagation();
              setSelected(d.id);
            }}
          >
            {grab}
          </g>
        )}
        {anchorsOf(d)}
      </g>
    );
  });

  /** Le dessin ouvert, et où poser sa fiche sans sortir du graphe. */
  const sheet = (() => {
    const d = drawings.find((x) => x.id === selected);
    if (!d || !pane) return null;
    const p = d.points[0];
    const c = coord(p.x, p.y);
    if (c.y == null) return null;
    const left = Math.max(8, Math.min((c.x ?? 12) + 10, W - 268));
    const top = Math.max(8, Math.min(c.y + 12, H - 52));
    return { d, left, top };
  })();

  function priceAt(d: Drawing, index: number): number {
    return d.points[index]?.y ?? d.points[0]?.y ?? 0;
  }

  const draftShape = (() => {
    if (!draft || draft.points.length < 1) return null;
    const p0 = coord(draft.points[0].x, draft.points[0].y);
    if (!p0.x || !p0.y) return null;
    if (ONE_CLICK.has(draft.kind)) return null;
    const p1 = draft.points[1] ? coord(draft.points[1].x, draft.points[1].y) : null;
    if (!p1?.x || !p1?.y) return null;
    const isRect = draft.kind === "rect" || draft.kind === "zone";
    const body = isRect ? (
      <rect
        x={Math.min(p0.x, p1.x)}
        y={Math.min(p0.y, p1.y)}
        width={Math.abs(p1.x - p0.x)}
        height={Math.abs(p1.y - p0.y)}
        fill={draft.kind === "zone" ? draft.color : "none"}
        fillOpacity={0.08}
        stroke={draft.color}
        strokeDasharray="4 3"
      />
    ) : (
      <line x1={p0.x} y1={p0.y} x2={p1.x} y2={p1.y} strokeDasharray="4 3" />
    );
    return (
      <g stroke={draft.color} strokeWidth={1.1}>
        {body}
        <circle cx={p0.x} cy={p0.y} r={4} />
      </g>
    );
  })();

  const orderLines = orders
    .filter(
      (o) => o.status === "working" && o.price != null && o.label !== "SL" && o.label !== "TP",
    )
    .map((o) => {
      const { x, y } = coord(0, o.price!);
      if (x == null || y == null) return null;
      // GRIS TANT QU'IL ATTEND. Colorer un ordre en attente comme une position
      // ouverte les rendait indiscernables d'un coup d'œil : on croyait être
      // en position alors qu'on avait seulement un ordre au carnet. La couleur
      // du sens est réservée à ce qui est RÉELLEMENT engagé.
      const color = "var(--tv-text-muted)";
      const sideWord = o.side === "long" ? "BUY" : "SELL";
      const kind = o.type === "limit" ? "LMT" : "STP";
      // LE BRACKET VOYAGE AVEC SON ENTRÉE. Tant qu'elle attend, le stop et
      // l'objectif ne sont pas des ordres : ce sont deux nombres qu'elle
      // porte. Ils se dessinent quand même — c'est tout l'intérêt de poser un
      // bracket avant d'être rempli : VOIR le trade avant de le prendre.
      const slY = o.bracketSl != null ? coord(0, o.bracketSl).y : null;
      const tpY = o.bracketTp != null ? coord(0, o.bracketTp).y : null;
      const spec = instrumentOf(symbol);
      const rail = [slY, tpY, y].filter((v): v is number => v != null);

      const leg = (
        yy: number,
        price: number,
        which: "sl" | "tp",
        legColor: string,
        label: string,
      ) => (
        <>
          <line
            x1={0}
            y1={yy}
            x2={W}
            y2={yy}
            stroke={legColor}
            strokeWidth={1}
            strokeDasharray="5 4"
            opacity={0.6}
          />
          <PriceTag
            x={8}
            y={yy}
            color={legColor}
            label={label}
            value={price.toFixed(2)}
            money={money$(pnlOf(o.side, o.qty, o.price!, price, spec))}
            drag={{
              onDown: handleDown({ bracketOrderId: o.id, leg: which }),
              onMove: handleMove,
              onUp: handleUp,
            }}
            onCancel={() =>
              onMoveOrderBracket(
                o.id,
                which === "sl" ? null : undefined,
                which === "tp" ? null : undefined,
              )
            }
          />
          {/* La poignée du bord droit — celle qu'on attrape sans viser
            l'étiquette, exactement comme pour une position ouverte. */}
          <rect
            x={W - 11}
            y={yy - 10}
            width={8}
            height={20}
            fill="transparent"
            style={{ pointerEvents: "auto", cursor: "ns-resize" }}
            onPointerDown={handleDown({ bracketOrderId: o.id, leg: which })}
            onPointerMove={handleMove}
            onPointerUp={handleUp}
          />
        </>
      );

      return (
        <g key={o.id} style={{ pointerEvents: "none" }}>
          <BracketZones W={W} entryY={y} slY={slY} tpY={tpY} pending />
          {slY != null && o.bracketSl != null && leg(slY, o.bracketSl, "sl", SL, "SL")}
          {tpY != null && o.bracketTp != null && leg(tpY, o.bracketTp, "tp", TP, "TP")}
          {/* Le rail vertical qui relie les trois niveaux — il dit d'un coup
            d'œil que ces traits forment UN ordre, et pas trois. */}
          {rail.length > 1 && (
            <>
              <line
                x1={W - 3.5}
                y1={Math.min(...rail)}
                x2={W - 3.5}
                y2={Math.max(...rail)}
                stroke={color}
                strokeWidth={1.5}
                strokeDasharray="3 3"
                opacity={0.55}
              />
              <rect x={W - 5.5} y={y - 1.5} width={4} height={3} fill={color} />
            </>
          )}
          {/* Ligne pointillée fine — l'ordre attend. */}
          <line
            x1={0}
            y1={y}
            x2={W}
            y2={y}
            stroke={color}
            strokeWidth={1}
            strokeDasharray="1 4"
            opacity={0.6}
          />
          <PriceTag
            x={W - 130}
            y={y}
            color={color}
            label={`${sideWord} ${o.qty} · ${kind}`}
            value={o.price!.toFixed(2)}
            drag={{
              onDown: handleDown({ orderId: o.id }),
              onMove: handleMove,
              onUp: handleUp,
            }}
            onCancel={() => onCancelOrder(o.id)}
          />
        </g>
      );
    });

  const positionShapes = positions.map((pos) => {
    const spec = instrumentOf(pos.symbol);
    const { y } = coord(0, pos.avgEntry);
    if (y == null) return null;
    const color = pos.side === "long" ? "var(--tv-chart-green)" : "var(--tv-chart-red)";
    const markY = coord(0, mark).y;
    const slY = pos.stop?.price != null ? coord(0, pos.stop.price).y : null;
    const tpY = pos.target?.price != null ? coord(0, pos.target.price).y : null;
    const rail = [slY, tpY, y].filter((v): v is number => v != null);
    const top = rail.length ? Math.min(...rail) : y;
    const bot = rail.length ? Math.max(...rail) : y;
    // Le P&L OUVERT, au prix marqué de l'instant. `mark` remonte du moteur à
    // chaque battement d'horloge, donc ce nombre vit avec le marché.
    const openPnl = mark > 0 ? pnlOf(pos.side, pos.qty, pos.avgEntry, mark, spec) : 0;

    const bracketHandle = (yy: number | null, orderId: string | null | undefined) =>
      yy != null && orderId ? (
        <rect
          x={W - 11}
          y={yy - 10}
          width={8}
          height={20}
          fill="transparent"
          style={{ pointerEvents: "auto", cursor: "ns-resize" }}
          onPointerDown={handleDown({ orderId })}
          onPointerMove={handleMove}
          onPointerUp={handleUp}
        />
      ) : null;

    return (
      <g key={pos.id} style={{ pointerEvents: "none" }}>
        {/* Les deux zones du bracket — la même forme que pour un ordre en
          carnet, à ceci près que le risque, lui, est réellement pris.
          L'ancienne bande unique, teintée du sens de la position, montrait le
          P&L courant — une information que l'en-tête donne déjà en clair. */}
        <BracketZones W={W} entryY={y} slY={slY} tpY={tpY} />

        {/* Sans bracket, il reste la bande de P&L : entrée → prix marqué. */}
        {slY == null && tpY == null && markY != null && Math.abs(markY - y) > 1 && (
          <rect
            x={0}
            y={Math.min(y, markY)}
            width={W}
            height={Math.abs(markY - y)}
            fill={color}
            opacity={0.07}
          />
        )}

        {/* Ligne d'entrée — pleine, discrète. */}
        <line x1={0} y1={y} x2={W} y2={y} stroke={color} strokeWidth={1} opacity={0.5} />
        {/* LA POIGNÉE DE LA POSITION. Rester appuyé sur son entrée et tirer :
          vers la perte, on pose le stop ; vers le gain, l'objectif. C'est le
          geste qui manquait — il fallait jusqu'ici passer par le ticket pour
          protéger un trade déjà ouvert. La bande fait vingt pixels de haut :
          on l'attrape sans viser, et le graphe garde tout le reste. */}
        <rect
          x={0}
          y={y - 10}
          width={W - 12}
          height={20}
          fill="transparent"
          style={{ pointerEvents: "auto", cursor: "ns-resize" }}
          onPointerDown={handleDown({ positionId: pos.id })}
          onPointerMove={handleMove}
          onPointerUp={handleUp}
        />

        {/* Brackets SL / TP : lignes pointillées + étiquettes draggables. */}
        {slY != null && pos.stop?.price != null && (
          <>
            <line
              x1={0}
              y1={slY}
              x2={W}
              y2={slY}
              stroke={SL}
              strokeWidth={1}
              strokeDasharray="5 4"
              opacity={0.8}
            />
            <PriceTag
              x={8}
              y={slY}
              color={SL}
              label="SL"
              value={pos.stop.price.toFixed(2)}
              money={money$(pnlOf(pos.side, pos.qty, pos.avgEntry, pos.stop.price, spec))}
              drag={{
                onDown: handleDown({ orderId: pos.stop.id }),
                onMove: handleMove,
                onUp: handleUp,
              }}
              onCancel={() => onCancelOrder(pos.stop!.id)}
            />
            {bracketHandle(slY, pos.stop.id)}
          </>
        )}
        {tpY != null && pos.target?.price != null && (
          <>
            <line
              x1={0}
              y1={tpY}
              x2={W}
              y2={tpY}
              stroke={TP}
              strokeWidth={1}
              strokeDasharray="5 4"
              opacity={0.8}
            />
            <PriceTag
              x={8}
              y={tpY}
              color={TP}
              label="TP"
              value={pos.target.price.toFixed(2)}
              money={money$(pnlOf(pos.side, pos.qty, pos.avgEntry, pos.target.price, spec))}
              drag={{
                onDown: handleDown({ orderId: pos.target.id }),
                onMove: handleMove,
                onUp: handleUp,
              }}
              onCancel={() => onCancelOrder(pos.target!.id)}
            />
            {bracketHandle(tpY, pos.target.id)}
          </>
        )}

        {/* Le rail du bracket — relie SL et TP, avec une encoche à l'entrée. */}
        {(slY != null || tpY != null) && (
          <>
            <line
              x1={W - 3.5}
              y1={top}
              x2={W - 3.5}
              y2={bot}
              stroke={color}
              strokeWidth={1.5}
              opacity={0.65}
            />
            <rect x={W - 5.5} y={y - 1.5} width={4} height={3} fill={color} />
          </>
        )}

        {/* L'ÉTIQUETTE DE POSITION — sens, taille, entrée, et LE P&L OUVERT.
          Le montant vit ici parce que c'est ici qu'on regarde pendant qu'un
          trade court : les yeux sont sur la ligne d'entrée et sur le prix, pas
          sur la barre du haut. Il prend la couleur de son SIGNE, pas celle du
          sens de la position — un long qui perd est rouge, comme partout
          ailleurs dans le produit. */}
        <PriceTag
          x={W - 166}
          y={y}
          color={color}
          label={`${pos.side.toUpperCase()} ${pos.qty}`}
          value={pos.avgEntry.toFixed(2)}
          money={live$(openPnl)}
          moneyColor={openPnl >= 0 ? "var(--tv-chart-green)" : "var(--tv-chart-red)"}
        />
      </g>
    );
  });

  const execs = executions.map((ex, i) => {
    const { x, y } = coord(ex.at, ex.price);
    if (x == null || y == null) return null;
    return (
      <FillMark
        key={i}
        cx={x}
        cy={y}
        color={ex.side === "long" ? "var(--tv-chart-green)" : "var(--tv-chart-red)"}
        // Les séances enregistrées avant que l'entrée soit inscrite ne portent
        // que des sorties : sans `kind`, c'en est une.
        kind={ex.kind ?? "exit"}
        side={ex.side}
      />
    );
  });

  const shading = (() => {
    if (!showRthEth) return [];
    const out: React.ReactNode[] = [];
    for (const [a, b] of [
      // Une bande hors-séance AVANT chaque RTH, puis une dernière après le
      // dernier. Émettre aussi la bande d'après à chaque tour la dessinerait
      // deux fois, et l'opacité doublerait entre deux séances.
      ...(bounds.rthWindows && bounds.rthWindows.length > 0
        ? [
            ...bounds.rthWindows.map(
              (w, i, all) =>
                [i === 0 ? bounds.ethStart : all[i - 1].end, w.start] as [number, number],
            ),
            [bounds.rthWindows[bounds.rthWindows.length - 1].end, bounds.ethEnd] as [
              number,
              number,
            ],
          ]
        : [
            [bounds.ethStart, bounds.rthStart] as [number, number],
            [bounds.rthEnd, bounds.ethEnd] as [number, number],
          ]),
    ] as const) {
      const x = coord(a, 0).x;
      const x2 = coord(b, 0).x;
      if (x == null || x2 == null) continue;
      out.push(
        <rect
          key={a}
          x={x}
          y={0}
          width={Math.max(0, x2 - x)}
          height={H}
          fill="var(--tv-surface-3)"
          opacity={0.14}
          style={{ pointerEvents: "none" }}
        />,
      );
    }
    return out;
  })();

  const capture = PLACING[tool] ? (
    <rect
      x={0}
      y={0}
      width={W}
      height={H}
      fill="transparent"
      style={{ pointerEvents: "auto", cursor: "crosshair" }}
      onPointerDown={onPlaceDown}
      onPointerMove={onPlaceMove}
    />
  ) : null;

  return (
    <div className="absolute inset-0" style={{ pointerEvents: "none" }}>
      <svg
        ref={(el) => {
          svgRef.current = el;
          if (exportRef) exportRef.current = el;
        }}
        className="absolute inset-0"
        width={W}
        height={H}
        style={{ pointerEvents: "none", overflow: "visible" }}
      >
        {shading}
        {shapes}
        {draftShape}
        {showOrders && orderLines}
        {showOrders && positionShapes}
        {showOrders && execs}
        {showRthEth && (
          <text
            x={8}
            y={12}
            fill="var(--tv-text-muted)"
            fontSize={9}
            style={{ pointerEvents: "none" }}
          >
            RTH 09:30–16:00 ET · ETH 18:00–17:00
          </text>
        )}
        {capture}
      </svg>

      {/* LA FICHE DU DESSIN — nommer, reteinter, supprimer.
        Elle s'ouvre au contact du trait, pas dans un panneau à l'autre bout de
        l'écran : la décision se prend là où se trouve l'objet. C'est aussi la
        seule façon de changer la couleur d'un dessin DÉJÀ POSÉ — le rail, lui,
        ne décide que de la couleur des prochains. */}
      {sheet && (
        <div
          className="absolute flex items-center gap-1.5 rounded-md border border-[var(--tv-border)] bg-[var(--tv-plate-2)]/95 p-1.5 shadow-[var(--tv-elev-2)] backdrop-blur"
          style={{ left: sheet.left, top: sheet.top, pointerEvents: "auto" }}
        >
          <input
            value={sheet.d.text ?? ""}
            onChange={(e) => onUpdateDrawing({ ...sheet.d, text: e.target.value })}
            placeholder={t("rt.drawName")}
            aria-label={t("rt.drawName")}
            autoFocus
            className="w-28 rounded-md bg-[var(--tv-plate-1)] px-2 py-1 text-[11px] font-semibold text-[var(--tv-text)] outline-none placeholder:text-[var(--tv-text-muted)] focus:ring-1 focus:ring-[var(--tv-border-strong)]"
          />
          <div className="flex items-center gap-1">
            {palette.map((c) => (
              <button
                key={c}
                type="button"
                title={t("rt.drawColor")}
                aria-label={t("rt.drawColor")}
                onClick={() => onUpdateDrawing({ ...sheet.d, color: c })}
                className={cn(
                  "h-4 w-4 rounded-full border transition",
                  sheet.d.color === c
                    ? "scale-110 border-[var(--tv-text)]"
                    : "border-transparent opacity-70 hover:opacity-100",
                )}
                style={{ background: c }}
              />
            ))}
          </div>
          <button
            type="button"
            title={t("rt.drawDelete")}
            aria-label={t("rt.drawDelete")}
            onClick={() => {
              onRemoveDrawing(sheet.d.id);
              setSelected(null);
            }}
            className="grid h-6 w-6 place-items-center rounded-md text-[var(--tv-text-muted)] transition hover:bg-[var(--tv-surface-hover)] hover:text-[var(--tv-danger)]"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            title={t("rt.drawClose")}
            aria-label={t("rt.drawClose")}
            onClick={() => setSelected(null)}
            className="grid h-6 w-6 place-items-center rounded-md text-[var(--tv-text-muted)] transition hover:bg-[var(--tv-surface-hover)] hover:text-[var(--tv-text)]"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

let _d = 0;
function nextDrawId(): string {
  _d += 1;
  return `drw:${Date.now().toString(36)}-${_d}`;
}
