import { translate } from '../i18n';
import { LANGUAGES, type Language } from '../i18n/language';
import { capKm2, discRing } from './oceans';
import type { LngLat } from './view';
import type { Country } from './world';

/**
 * The seas the "Seas" switch adds to a round on the oceans (plan, Phase 8):
 * Natural Earth's scalerank 1 seas, gulfs and bays, plus the North Sea and
 * the Baltic, which it ranks second. In the order `tools/sea-zones.mjs`
 * lists them, which is the order of the draw.
 */
export const SEA_IDS = [
  'mediterranean-sea',
  'black-sea',
  'red-sea',
  'caspian-sea',
  'north-sea',
  'baltic-sea',
  'caribbean-sea',
  'gulf-of-mexico',
  'hudson-bay',
  'baffin-bay',
  'labrador-sea',
  'beaufort-sea',
  'gulf-of-alaska',
  'sea-of-okhotsk',
  'sea-of-japan',
  'philippine-sea',
  'south-china-sea',
  'coral-sea',
  'tasman-sea',
  'arabian-sea',
  'bay-of-bengal',
  'persian-gulf',
  'weddell-sea',
  'ross-sea',
] as const;
export type SeaId = (typeof SEA_IDS)[number];

/**
 * A sea's disc: the point of the sea farthest from its coasts and from its
 * limits with the neighbouring seas, and that distance in degrees of arc,
 * the radius of the largest disc that fits.
 */
export type SeaZone = { centre: LngLat; fitsDeg: number };

/**
 * How much of the room it has a sea's disc takes: four fifths of the radius
 * that fits, so a strip of water shows round it, as round the oceans'
 * discs. To be checked on the tablet (plan, Phase 8).
 */
export const SEA_ZONE_SHARE = 0.8;

/**
 * Printed by `pnpm data:seas` (`tools/sea-zones.mjs`) from Natural Earth's
 * 1:50m marine polygons, v5.1.2, on 2026-11-23. The Mediterranean is joined
 * with the Tyrrhenian, Ionian, Adriatic and Balearic seas and the Gulf of
 * Lion, which Natural Earth cuts out of it; the Baltic with the Gulfs of
 * Bothnia and Finland; the Gulf of Mexico with the Bay of Campeche; Hudson
 * Bay with James Bay. The Ross Sea's two halves, cut at the antimeridian,
 * count as one. `seas.test.ts` holds the discs to the land of `world.json`
 * and to the oceans' discs.
 */
export const SEAS: Record<SeaId, SeaZone> = {
  'mediterranean-sea': { centre: [18.48, 35.2], fitsDeg: 3.1 },
  'black-sea': { centre: [31.33, 43.46], fitsDeg: 1.88 },
  'red-sea': { centre: [40.44, 17.31], fitsDeg: 1.35 },
  'caspian-sea': { centre: [51.24, 38.73], fitsDeg: 1.58 },
  'north-sea': { centre: [3.24, 56.07], fitsDeg: 2.72 },
  'baltic-sea': { centre: [18.99, 55.89], fitsDeg: 1.12 },
  'caribbean-sea': { centre: [-78.86, 13.77], fitsDeg: 4.23 },
  'gulf-of-mexico': { centre: [-92.39, 25], fitsDeg: 4.38 },
  'hudson-bay': { centre: [-84.59, 59.03], fitsDeg: 3.16 },
  'baffin-bay': { centre: [-64.36, 72.66], fitsDeg: 2.36 },
  'labrador-sea': { centre: [-53.27, 57.12], fitsDeg: 3.11 },
  'beaufort-sea': { centre: [-135.43, 72.41], fitsDeg: 1.85 },
  'gulf-of-alaska': { centre: [-148.58, 58.5], fitsDeg: 1.36 },
  'sea-of-okhotsk': { centre: [149.73, 52.21], fitsDeg: 3.93 },
  'sea-of-japan': { centre: [133.55, 39.4], fitsDeg: 3.28 },
  'philippine-sea': { centre: [132.98, 17.87], fitsDeg: 9.16 },
  'south-china-sea': { centre: [114.74, 13.89], fitsDeg: 5.25 },
  'coral-sea': { centre: [156.86, -18.55], fitsDeg: 6.97 },
  'tasman-sea': { centre: [159.43, -39.76], fitsDeg: 7.65 },
  'arabian-sea': { centre: [63.42, 13.35], fitsDeg: 7.82 },
  'bay-of-bengal': { centre: [86.47, 12.51], fitsDeg: 5.74 },
  'persian-gulf': { centre: [53.05, 25.5], fitsDeg: 1.36 },
  'weddell-sea': { centre: [-50.57, -75.12], fitsDeg: 2.79 },
  'ross-sea': { centre: [-175.9, -76.7], fitsDeg: 3.35 },
};

/** The radius of a sea's disc, in degrees of arc. */
export const seaRadiusDeg = (id: SeaId): number => SEAS[id].fitsDeg * SEA_ZONE_SHARE;

const namesOf = (id: SeaId): Record<Language, string> =>
  Object.fromEntries(LANGUAGES.map((lang) => [lang, translate(lang, `sea.${id}`)])) as Record<Language, string>;

/**
 * The seas as places, shaped like the oceans (`oceanPlaces`): one disc each,
 * drawn and picked the same way, kind "Sea". Their names are in the
 * dictionaries (`sea.*`), since they are not in the data file.
 */
export const seaPlaces = (): Country[] =>
  SEA_IDS.map((id) => {
    const { centre } = SEAS[id];
    const radius = seaRadiusDeg(id);
    return {
      type: 'Feature',
      id,
      geometry: { type: 'Polygon', coordinates: [discRing(centre, radius)] },
      properties: {
        continent: 'oceans',
        kind: 'Sea',
        color: 0,
        areaKm2: Math.round(capKm2(radius)),
        anchor: [centre[0], centre[1]],
        names: namesOf(id),
      },
    };
  });
