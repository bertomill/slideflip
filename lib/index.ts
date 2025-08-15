// Re-export fabric-to-slide and slide-to-fabric modules for better compatibility
export { convertFabricToSlideJson, exportCanvasFormats } from './fabric-to-slide.ts';
export { renderSlideOnCanvas, createSlideCanvas, calculateOptimalScale } from './slide-to-fabric.ts';
export type { SlideDefinition, SlideObject, SlideColor } from './slide-types.ts';