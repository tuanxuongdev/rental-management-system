import type { AppLocale } from './locales';

/** Nested message tree — leaf values are strings. */
export type MessageTree = {
  readonly [key: string]: string | MessageTree;
};

export type Messages = MessageTree;

export type TranslateParams = Record<string, string | number>;

export type Translator = (key: string, params?: TranslateParams) => string;

function lookup(tree: MessageTree, key: string): string | undefined {
  const parts = key.split('.');
  let current: string | MessageTree | undefined = tree;
  for (const part of parts) {
    if (current === undefined || typeof current === 'string') {
      return undefined;
    }
    current = current[part];
  }
  return typeof current === 'string' ? current : undefined;
}

function interpolate(template: string, params?: TranslateParams): string {
  if (!params) {
    return template;
  }
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = params[name];
    return value === undefined ? match : String(value);
  });
}

export function createTranslator(messages: Messages, fallback?: Messages): Translator {
  return (key, params) => {
    const raw = lookup(messages, key) ?? (fallback ? lookup(fallback, key) : undefined);
    if (raw === undefined) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`[i18n] Missing key: ${key}`);
      }
      return key;
    }
    return interpolate(raw, params);
  };
}

const loaders: Record<AppLocale, () => Promise<{ default: Messages }>> = {
  en: () => import('./messages/en'),
  vi: () => import('./messages/vi'),
};

/** Lazy-load a locale catalog (separate chunk per language). */
export async function loadMessages(locale: AppLocale): Promise<Messages> {
  const mod = await loaders[locale]();
  return mod.default;
}
