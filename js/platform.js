// Detección de plataforma: web (Safari/iPhone, navegador) o app nativa de Android.
import { BUILD } from './build-info.js';

/** Dirección pública de la web app (GitHub Pages). La app nativa la usa para
 *  las tasas de cambio y los enlaces de invitación. */
export const PUBLIC_URL = 'https://marcoh03.github.io/House_Management_App/';
export const REPO = 'MarcoH03/House_Management_App';

const cap = window.Capacitor;
export const isNative = !!(cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform());
export const isAndroid = isNative ? cap.getPlatform() === 'android' : /Android/i.test(navigator.userAgent);
export const build = BUILD;

/** Dirección de la app para compartir (en la app nativa no hay URL propia). */
export const appUrl = () => (isNative ? PUBLIC_URL : `${location.origin}${location.pathname}`);
