// Re-export fabric-to-slide and slide-to-fabric modules for better compatibility
export { convertFabricToSlideJson, exportCanvasFormats } from './fabric-to-slide';
export { renderSlideOnCanvas, createSlideCanvas, calculateOptimalScale } from './slide-to-fabric';
export type { SlideDefinition, SlideObject, SlideColor } from './slide-types';