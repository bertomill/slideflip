/**
 * Type definitions for PptxGenJS-compatible slide JSON structure
 * Based on official PptxGenJS documentation and examples
 */

// Color can be a hex string or RGB object
export type SlideColor = string | { r: number; g: number; b: number };

// Position and size units (inches by default in PptxGenJS)
export interface SlidePosition {
  x: number;
  y: number;
  w: number; // width
  h: number; // height
}

// Text options
export interface TextOptions {
  fontSize?: number;
  fontFace?: string;
  color?: SlideColor;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  align?: 'left' | 'center' | 'right' | 'justify';
  valign?: 'top' | 'middle' | 'bottom';
  margin?: number | [number, number, number, number];
  lineSpacing?: number;
  paraSpaceBefore?: number;
  paraSpaceAfter?: number;
}

// Shape options
export interface ShapeOptions {
  fill?: { color: SlideColor; transparency?: number };
  line?: { color?: SlideColor; width?: number; dashType?: 'solid' | 'dash' | 'dot' };
  rectRadius?: number;
  shadow?: {
    type: 'outer' | 'inner';
    color: SlideColor;
    blur?: number;
    offset?: number;
    angle?: number;
  };
}

// Image options
export interface ImageOptions {
  hyperlink?: { url: string; tooltip?: string };
  placeholder?: string;
  sizing?: { type: 'contain' | 'cover' | 'crop' };
}

// Chart data and options
export interface ChartData {
  name: string;
  labels: string[];
  values: number[];
}

export interface ChartOptions {
  chartColors?: SlideColor[];
  showLegend?: boolean;
  showTitle?: boolean;
  title?: string;
  showValue?: boolean;
  showPercent?: boolean;
}

// Table cell
export interface TableCell {
  text: string;
  options?: TextOptions & {
    fill?: { color: SlideColor };
    colspan?: number;
    rowspan?: number;
  };
}

// Slide object types
export type SlideObject = 
  | TextObject
  | ShapeObject
  | ImageObject
  | ChartObject
  | TableObject;

export interface TextObject {
  type: 'text';
  text: string;
  options: SlidePosition & TextOptions;
}

export interface ShapeObject {
  type: 'shape';
  shape: 'rect' | 'ellipse' | 'line' | 'triangle' | 'roundRect';
  options: SlidePosition & ShapeOptions;
}

export interface ImageObject {
  type: 'image';
  path: string; // URL or base64
  options: SlidePosition & ImageOptions;
}

export interface ChartObject {
  type: 'chart';
  chartType: 'bar' | 'line' | 'pie' | 'doughnut' | 'area';
  data: ChartData[];
  options: SlidePosition & ChartOptions;
}

export interface TableObject {
  type: 'table';
  rows: TableCell[][];
  options: SlidePosition & {
    colW?: number[];
    rowH?: number[];
    border?: { pt: number; color: SlideColor };
    fill?: { color: SlideColor };
  };
}

// Complete slide definition
export interface SlideDefinition {
  id?: string;
  title?: string;
  background?: { color?: SlideColor; path?: string };
  objects: SlideObject[];
  notes?: string;
  slideNumber?: { 
    x: number; 
    y: number; 
    color?: SlideColor; 
    fontSize?: number; 
  };
}

// Presentation metadata
export interface PresentationDefinition {
  title: string;
  author?: string;
  subject?: string;
  company?: string;
  revision?: string;
  layout?: 'LAYOUT_16x9' | 'LAYOUT_16x10' | 'LAYOUT_4x3' | 'LAYOUT_WIDE';
  slides: SlideDefinition[];
}

// Theme definition for consistent styling
export interface SlideTheme {
  name: string;
  colors: {
    primary: SlideColor;
    secondary: SlideColor;
    accent: SlideColor;
    background: SlideColor;
    text: SlideColor;
    textLight: SlideColor;
  };
  fonts: {
    title: string;
    body: string;
    mono?: string;
  };
  sizes: {
    titleSize: number;
    headingSize: number;
    bodySize: number;
    captionSize: number;
  };
}