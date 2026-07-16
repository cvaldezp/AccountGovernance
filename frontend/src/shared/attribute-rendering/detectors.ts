// Detección genérica de forma de contenido — nunca por nombre de atributo.
// Nuevos detectores (email, URL, JSON, XML, boolean/flags, DN, fecha, lista,
// markdown, ...) se agregan aquí como funciones puras independientes; cada
// nueva estrategia en strategies.tsx importa el detector que necesite.

const HTML_TAG_PATTERN = /<\/?[a-z][a-z0-9]*(\s[^<>]*)?\/?>/i;

/** True si el valor contiene al menos una etiqueta HTML reconocible
 *  (<br/>, <div>, <span>, <table>, <p>, <ul>, <li>, <img>, cierres </...>, etc.).
 *  Genérico por diseño: no depende de FieldKey/AdAttributeName. */
export function looksLikeHtml(value: string): boolean {
  return HTML_TAG_PATTERN.test(value);
}
