import DOMPurify from 'dompurify';

// Único punto del proyecto donde se sanitiza HTML antes de dangerouslySetInnerHTML.
// Whitelist acotada a lo típico de una firma/plantilla de correo — nada de
// <script>, atributos on*, ni <style>/<iframe>. Ampliar esta lista solo si un
// caso de uso real lo requiere.
const ALLOWED_TAGS = [
  'br', 'p', 'div', 'span', 'strong', 'b', 'em', 'i', 'u', 's',
  'a', 'img', 'hr',
  'table', 'thead', 'tbody', 'tr', 'td', 'th',
  'ul', 'ol', 'li',
];

const ALLOWED_ATTR = ['href', 'src', 'alt', 'title', 'style', 'target', 'rel', 'width', 'height', 'colspan', 'rowspan'];

export function sanitizeHtml(value: string): string {
  return DOMPurify.sanitize(value, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
  });
}
