import { ATTRIBUTE_VALUE_STRATEGIES, type AttributeRenderContext } from './strategies';

export type { AttributeRenderContext, AttributeValueStrategy } from './strategies';

/**
 * Decide cómo representar el valor crudo de un atributo AD, sin acoplarse a
 * ningún FieldKey/AdAttributeName específico — la detección es por forma del
 * contenido (ver detectors.ts). Casos de negocio que no se pueden inferir del
 * contenido (p.ej. Estado de Cuenta → badge Habilitada/Deshabilitada) siguen
 * resolviéndose *antes* de llegar acá, a nivel de la pantalla que conoce esa
 * semántica — este componente solo cubre representación genérica por tipo de
 * dato/contenido.
 */
export function AttributeValueRenderer(ctx: AttributeRenderContext) {
  const strategy = ATTRIBUTE_VALUE_STRATEGIES.find(s => s.matches(ctx))!;
  return <strategy.Component {...ctx} />;
}
