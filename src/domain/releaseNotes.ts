/**
 * What's new, for the player, on the About screen. Written to a child (tu in
 * French, du in German, Swiss spelling) and kept short; CHANGELOG.md is the
 * full, technical record. A release changes package.json's version, adds a
 * CHANGELOG.md section and puts a note at the top here, all in one commit;
 * `src/__tests__/releaseNotes.test.ts` holds the three together.
 */
import type { Language } from '../i18n/language';

export type ReleaseNote = {
  version: string;
  /** YYYY-MM-DD. */
  date: string;
  /** The same changes in every language, in the same order. */
  changes: Record<Language, readonly string[]>;
};

/** Newest first. */
export const releaseNotes: readonly ReleaseNote[] = [
  {
    version: '0.3.0',
    date: '2026-11-22',
    changes: {
      fr: [
        "Nouveau : sur l'accueil, l'interrupteur « Limite de temps » coupe le chrono. Chaque pays attend alors que tu le trouves, sans te presser.",
        'Nouveau : « Sans les tout petits pays » laisse de côté les pays minuscules comme la Cité du Vatican, Monaco ou Malte. Ils restent gris, et la carte a beaucoup moins de cercles.',
      ],
      de: [
        'Neu: Auf der Startseite schaltet « Zeitlimit » den Timer aus. Dann wartet jedes Land, bis du es gefunden hast, ganz ohne Eile.',
        'Neu: « Ohne die ganz kleinen Länder » lässt winzige Länder wie Vatikanstadt, Monaco oder Malta weg. Sie bleiben grau, und auf der Karte gibt es viel weniger Kreise.',
      ],
      en: [
        'New: on the home screen, the "Time limit" switch turns the timer off. Each country then waits until you find it, no rush.',
        'New: "Without the tiny countries" leaves out very small countries like Vatican City, Monaco or Malta. They stay grey, and the map has far fewer rings.',
      ],
    },
  },
  {
    version: '0.2.0',
    date: '2026-11-21',
    changes: {
      fr: [
        "Nouveau : l'écran « À propos » (ℹ️ sur l'accueil) dit quelle version tu as, d'où vient la carte et où trouver le code de l'appli.",
        'Les pays du continent sont roses. Celui sous la souris devient orange, avec un contour blanc.',
        'Une bonne réponse reçoit un ✅ sur le pays. Si tu te trompes, le pays touché reçoit un ❌ et la bonne réponse un ✅.',
        "Le premier pays n'apparaît plus avant la carte : le chrono attend que tous les pays soient dessinés.",
      ],
      de: [
        'Neu: Der Bildschirm « Über » (ℹ️ auf der Startseite) zeigt, welche Version du hast, woher die Karte kommt und wo der Code der App liegt.',
        'Die Länder des Kontinents sind rosa. Das Land unter der Maus wird orange und bekommt einen weissen Rand.',
        'Eine richtige Antwort bekommt ein ✅ auf dem Land. Wenn du dich irrst, bekommt das angetippte Land ein ❌ und die richtige Antwort ein ✅.',
        'Das erste Land erscheint nicht mehr vor der Karte: Der Timer wartet, bis alle Länder gezeichnet sind.',
      ],
      en: [
        'New: the "About" screen (ℹ️ on the home screen) tells you which version you have, where the map comes from and where to find the app\'s code.',
        "The continent's countries are pink. The one under the mouse turns orange, with a white outline.",
        'A right answer gets a ✅ on the country. If you get it wrong, the country you tapped gets a ❌ and the right answer a ✅.',
        'The first country no longer shows up before the map: the timer waits until every country is drawn.',
      ],
    },
  },
  {
    version: '0.1.0',
    date: '2026-11-21',
    changes: {
      fr: [
        'Première version : choisis un continent, puis trouve ses pays sur le globe avant la fin du chrono.',
        'Tourne le globe avec un doigt et zoome avec deux. Les tout petits pays ont un cercle pour que tu puisses les toucher.',
      ],
      de: [
        'Erste Version: Wähle einen Kontinent und finde seine Länder auf dem Globus, bevor die Zeit um ist.',
        'Dreh den Globus mit einem Finger und zoome mit zwei. Ganz kleine Länder haben einen Kreis, damit du sie antippen kannst.',
      ],
      en: [
        'First version: pick a continent, then find its countries on the globe before the time runs out.',
        'Turn the globe with one finger and zoom with two. Very small countries get a ring so you can tap them.',
      ],
    },
  },
];
