import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'
import en from './en.json'
import ptBR from './pt-BR.json'

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { 'pt-BR': { translation: ptBR }, en: { translation: en } },
    fallbackLng: 'pt-BR',
    supportedLngs: ['pt-BR', 'en'],
    nonExplicitSupportedLngs: false,
    load: 'currentOnly',
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'veroid.lang',
      caches: ['localStorage'],
      convertDetectedLanguage: (lng: string) => (lng.toLowerCase().startsWith('pt') ? 'pt-BR' : 'en'),
    },
  })

i18n.on('languageChanged', (lng) => {
  document.documentElement.lang = lng
})
// o evento acima não dispara na detecção inicial: sincroniza o <html lang> ao carregar
if (i18n.language) document.documentElement.lang = i18n.language

export default i18n
