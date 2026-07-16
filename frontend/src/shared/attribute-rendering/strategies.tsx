import type { ComponentType } from 'react';
import type { FieldConfig } from '../../types';
import { looksLikeHtml } from './detectors';
import { HtmlValueDisplay } from './HtmlValueDisplay';

export interface AttributeRenderContext {
  value: string;
  /** Reservado para estrategias futuras que quieran decidir por fieldType/dataType,
   *  no solo por la forma del contenido (p.ej. distinguir boolean/flags/DN). */
  field?: FieldConfig;
}

export interface AttributeValueStrategy {
  id: string;
  matches: (ctx: AttributeRenderContext) => boolean;
  Component: ComponentType<AttributeRenderContext>;
}

function PlainTextValue({ value }: AttributeRenderContext) {
  return <span>{value}</span>;
}

// Estrategias en orden de prioridad — la primera que haga match gana. Para
// soportar un tipo nuevo (Email, URL, JSON, XML, Boolean/Flags, DN, fechas,
// listas, Markdown, ...): crear un detector en detectors.ts, un componente de
// despliegue propio, y agregar el objeto acá antes de textStrategy. Ni
// AttributeValueRenderer ni las pantallas que lo consumen necesitan cambiar.
const htmlStrategy: AttributeValueStrategy = {
  id: 'html',
  matches: ({ value }) => looksLikeHtml(value),
  Component: HtmlValueDisplay,
};

const textStrategy: AttributeValueStrategy = {
  id: 'text',
  matches: () => true, // fallback — debe ser siempre la última
  Component: PlainTextValue,
};

export const ATTRIBUTE_VALUE_STRATEGIES: AttributeValueStrategy[] = [htmlStrategy, textStrategy];
