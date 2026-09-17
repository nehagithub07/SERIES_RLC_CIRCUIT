const FALLBACK_LOCALE = 'en';

const getLocalizedValue = (value, locale, fallbackLocale) => {
  if (typeof value === 'string') {
    return value;
  }

  if (!value || typeof value !== 'object') {
    return '';
  }

  return (
    value[locale] ??
    value[fallbackLocale] ??
    value[FALLBACK_LOCALE] ??
    Object.values(value).find((entry) => typeof entry === 'string') ??
    ''
  );
};

export const isConfiguredAudioSource = (audio) => Boolean(audio && audio !== '#');

export const loadAiGuideConfig = (config, locale = FALLBACK_LOCALE) => {
  const defaultLocale = config?.defaultLocale ?? FALLBACK_LOCALE;
  const resolvedLocale = locale || defaultLocale;
  const rawSteps = Array.isArray(config?.steps) ? config.steps : [];

  return {
    defaultLocale,
    guideName:
      getLocalizedValue(config?.guideName, resolvedLocale, defaultLocale) ||
      config?.guideName ||
      'AI Guide',
    locale: resolvedLocale,
    locales: config?.locales ?? [defaultLocale],
    steps: rawSteps
      .map((step, index) => ({
        ...step,
        // The narration hook resolves this file name from src/audios.
        audio: step?.audio && step.audio !== '#' ? step.audio : '#',
        id: parseInt(step?.id ?? index + 1, 10), // Ensures numeric IDs match up perfectly
        text: getLocalizedValue(step?.text, resolvedLocale, defaultLocale),
      }))
      .filter((step) => step.text),
  };
};
