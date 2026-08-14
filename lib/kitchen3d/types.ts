/**
 * The scene, described in metres and nothing else.
 *
 * Deliberately free of any three.js type: the configure flow produces this, the
 * renderer consumes it. That keeps the whole layout testable without a GPU, and
 * leaves the door open to swapping the renderer (WebView, native, a server-side
 * image for the recap PDF) without touching the layout rules.
 */

/**
 * Which wall something sits against.
 *
 * A run is only ever *described* against back, left or right — the canonical
 * frame the layout is built in — but once the kitchen is turned into another
 * corner it can physically stand against the front wall, so all four are
 * spellable.
 */
export type Wall = "back" | "left" | "right" | "front";

/** Openings use the same four walls. */
export type OpeningWall = Wall;

/** Where in the elevation a module lives. Decides its height off the floor. */
export type Slot = "bas" | "haut" | "colonne";

/**
 * The appliance a module carries, if any. The renderer draws it; the price
 * comes from the catalogue entry, so nothing here is a pricing decision.
 */
export type Fixture =
  | "sink"
  | "hob"
  | "oven"
  | "microwave"
  | "fridge"
  | "dishwasher"
  | "hood"
  /** Freestanding range: burners and grates on top, oven behind the door. */
  | "range"
  /** A narrow domino warming plate, half the width of a hob. */
  | "warming"
  /** Glazed door — the carcass shows through, shelves and all. */
  | "glass"
  /** Glazed, with an LED strip lighting the inside. */
  | "glass-led"
  | null;

/** One entry of the LA MÉNAGÈRE library, in millimetres as the workshop quotes them. */
export interface KitchenModule {
  id: string;
  label: string;
  slot: Slot;
  /** Millimetres, so catalogue numbers can be pasted in unchanged. */
  widthMm: number;
  depthMm: number;
  heightMm: number;
  fixture: Fixture;
  priceCents: number;
  /** Drawer fronts instead of a door, and how many. */
  drawers?: number;
}

/** A module placed on a run, at a distance from the run's start. */
export interface PlacedModule {
  /** Unique within the scene, so the renderer can track selection. */
  key: string;
  moduleId: string;
  /** Metres from the start of the run to this module's left edge. */
  offsetM: number;
}

export interface Run {
  wall: Wall;
  /** Usable length of this run, metres. */
  lengthM: number;
  modules: PlacedModule[];
}

export interface Ilot {
  widthM: number;
  depthM: number;
  /** Worktop height of the island, which need not match the wall runs. */
  topM: number;
  /** Centre of the island, metres, in room coordinates. */
  x: number;
  z: number;
  /**
   * Quarter turns clockwise, 0–3. Beyond swinging the footprint round, this
   * decides which side the drawers face — so all four are meaningful even on a
   * square island.
   */
  rotationQuarters: number;
  /** True when the measured island does not leave a walkway all round. */
  tight?: boolean;
}

/**
 * The island's footprint as the room sees it, which is the pair its clearances
 * have to be measured against — turned a quarter, its length runs the other way.
 */
export function ilotFootprint(ilot: { widthM: number; depthM: number; rotationQuarters: number }) {
  const turned = (((ilot.rotationQuarters % 4) + 4) % 4) % 2 === 1;
  return {
    alongX: turned ? ilot.depthM : ilot.widthM,
    alongZ: turned ? ilot.widthM : ilot.depthM,
  };
}

/** An opening cut into a wall — a door, a window or a baie vitrée. */
export interface Opening {
  kind: "door" | "window";
  wall: OpeningWall;
  /** Metres from the start of that wall to the opening's left edge. */
  offsetM: number;
  widthM: number;
  heightM: number;
  /** Metres from the floor to the sill. Doors sit at 0. */
  sillM: number;
}

export interface SceneMaterials {
  /** Façade colour, straight from the customer's `colors` block. */
  facade: string;
  worktop: string;
  wall: string;
  floor: string;
  /** Poignées and appliance fronts. */
  metal: string;
}

/**
 * A chosen accessory, standing on the worktop as a plain named block.
 *
 * A range-couverts really lives inside a drawer, where nobody would see it.
 * Standing them on the counter is not what the kitchen looks like — it is a
 * checklist the customer can read at a glance, which is what they are for.
 */
export interface AccessoryBlock {
  id: string;
  title: string;
  /** Centre of the block, metres, in room coordinates. */
  x: number;
  z: number;
  /** Floor to the underside of the block. */
  baseM: number;
  widthM: number;
  depthM: number;
  heightM: number;
}

export interface KitchenScene {
  room: { widthM: number; depthM: number; heightM: number };
  /**
   * Quarter turns clockwise the whole implantation is rotated by, 0–3.
   *
   * The runs stay described against the canonical back/left/right walls and the
   * renderer turns them as one — which is what lets the same kitchen sit in any
   * corner without every wall rule being written four times.
   */
  rotationQuarters: number;
  runs: Run[];
  accessories: AccessoryBlock[];
  ilot?: Ilot;
  openings: Opening[];
  materials: SceneMaterials;
  /** What the customer decides that the renderer has to build to. */
  geometry: {
    worktopTopM: number;
    credence: boolean;
    /**
     * The smallest room this kitchen fits in, so the in-scene resize handles
     * can stop there instead of letting the walls close through the cabinets.
     */
    minRoom: { widthM: number; depthM: number };
  };
}

/** What the customer has decided by the time the 3D step opens. */
export interface KitchenConfig {
  /** "i" | "l" | "u"; anything else is treated as a straight run. */
  shapeKey?: string | null;
  /** Run lengths and ceiling height, centimetres, as the measurements block collects them. */
  run1Cm?: number;
  run2Cm?: number;
  run3Cm?: number;
  /**
   * The room itself, which is a different thing from the runs.
   *
   * A 3 m back wall and a 2 m return describe how much cabinetry there is, not
   * how big the space is — the same kitchen fits in a 3 × 2 galley or along two
   * walls of a 4 × 5 room. Left unset, the room falls back to the smallest one
   * the runs will fit in, which is what makes an unedited scene look tight.
   */
  roomLengthCm?: number;
  roomWidthCm?: number;
  /** Ceiling height — the block's "Hauteur mur". */
  heightCm?: number;
  /** Floor to the top of the worktop — the block's "Hauteur plan de travail". */
  worktopHeightCm?: number;
  ilot?: boolean;
  /** The island exactly as measured, when the îlot block asked for it. */
  ilotLengthCm?: number;
  ilotWidthCm?: number;
  ilotHeightCm?: number;
  /** "Crédence sur le mur" — the customer can decline it. */
  credence?: boolean;
  /** Which corner the kitchen occupies: quarter turns clockwise, 0–3. */
  rotationQuarters?: number;
  /** Which way the island faces: quarter turns clockwise, 0–3. */
  ilotRotationQuarters?: number;
  /** Accessories picked in "Vos options", shown as named blocks. */
  accessories?: { id: string; title: string }[];
  facadeHex?: string;
  worktopHex?: string;
}
