import { fr } from './fr';

export type { Language } from './language';
export type Messages = typeof fr;
export type TranslationKey = keyof Messages;
