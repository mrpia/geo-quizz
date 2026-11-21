/**
 * Every URL that ties this build to one deployment and one author, as in
 * math-quizz. The repository is public and MIT-licensed, so a fork retargets
 * the app by changing the constants below; `src/__tests__/siteConfig.test.ts`
 * fails if another file under `src/` hard-codes one of these hosts, or the
 * repository URL, again.
 *
 * Two files outside `src/` carry the same identity and do not read this one:
 * `.firebaserc` (the Firebase project) and `firebase.json` (the Hosting site
 * a `pnpm ship` deploys to).
 */

/** Where this build is deployed. No trailing slash. */
export const SITE_URL = 'https://geo-quizz.mrpia.ch';

/** The author's site, linked from the credit line on the About screen. */
export const AUTHOR_URL = 'https://mrpia.ch';

/** The credit link's text: the bare host, so it cannot drift from the link. */
export const AUTHOR_LABEL = new URL(AUTHOR_URL).host;

/**
 * The public repository this build comes from, linked from the About screen.
 * A fork points it at its own repository: the link promises the code of the
 * app the player is running.
 */
export const SOURCE_URL = 'https://github.com/mrpia/geo-quizz';

/** The "buy me a coffee" link, which the About screen routes through the parents. */
export const SUPPORT_URL = 'https://buymeacoffee.com/mrpia';
