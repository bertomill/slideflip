import fs from 'fs';
import path from 'path';
import PptxGenJS from 'pptxgenjs';

export type Inches = number;

export type BackgroundSchema =
  | { type: 'solid'; color: string }
  | { type: 'gradient'; colors: [string, string]; angle?: number };

export interface TextStyle {
  fontFace?: string;
  fontSize?: number;
  color?: string; // hex without '#'
  bold?: boolean;
  align?: 'left' | 'center' | 'right';
  lineSpacing?: number;
}

export interface Box {
  x: Inches;
  y: Inches;
  w: Inches;
  h: Inches;
}

export interface TemplateSchema {
  id: string;
  name: string;
  description: string;
  category: string;
  background: BackgroundSchema;
  accentColor?: string; // optional brand/accent color (hex without '#')
  headerBar?: { height: Inches; color: string; transparency?: number };
  logoBox?: (Box & { text?: string; style: TextStyle });
  titleBox: Box & { style: TextStyle };
  subtitleBox?: Box & { style: TextStyle };
  bulletsBox?: Box & { style: TextStyle };
  statBoxes?: Array<
    Box & {
      fillColor: string;
      fillTransparency?: number;
      lineColor?: string;
      lineTransparency?: number;
      numberStyle: TextStyle;
      labelStyle: TextStyle;
    }
  >;
  // Optional imported-layout fields (three-column highlights + footer)
  columns?: Array<
    Box & {
      header: string;
      bullets: string[];
      style: { headerStyle: TextStyle; bulletStyle: TextStyle };
      boxStyle?: { fillColor?: string; lineColor?: string; fillTransparency?: number; lineTransparency?: number };
    }
  >;
  dividerLineY?: Inches; // y position in inches for a horizontal divider
  footerLeft?: Box & { text: string; style: TextStyle };
  footerRight?: Box & { text: string; style: TextStyle };
}

export interface SlideContent {
  title: string | null;
  subtitle: string | null;
  bulletPoints: string[];
  statistics: Array<{ value: string; label: string }>;
}

const normalizeHex = (input?: string): string => {
  if (!input) return 'FFFFFF';
  return input.startsWith('#') ? input.slice(1) : input;
};

export function loadSchemaById(id: string): TemplateSchema | null {
  try {
    const file = path.join(process.cwd(), 'templates', 'powerpoint', `${id}.json`);
    const raw = fs.readFileSync(file, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function renderHtmlPreview(schema: TemplateSchema): string {
  // Minimal, scoped HTML preview that mirrors PPTX layout
  const bgCss =
    schema.background.type === 'solid'
      ? `background: #${normalizeHex(schema.background.color)};`
      : `background: linear-gradient(${schema.background.angle ?? 45}deg, #${normalizeHex(
          schema.background.colors[0]
        )}, #${normalizeHex(schema.background.colors[1])});`;

  const titleStyle = schema.titleBox.style;
  const subtitleStyle = schema.subtitleBox?.style;
  const bulletsStyle = schema.bulletsBox?.style;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>
  .tpl { position:relative; width:100%; height:100%; ${bgCss} font-family: ${
    titleStyle.fontFace || 'Arial'
  }, sans-serif; }
  .box { position:absolute; }
  .title { left:${schema.titleBox.x}in; top:${schema.titleBox.y}in; width:${schema.titleBox.w}in; height:${schema.titleBox.h}in; font-size:${
    titleStyle.fontSize || 44
  }pt; color:#${normalizeHex(titleStyle.color || '000000')}; font-weight:${
    titleStyle.bold ? '700' : '500'
  }; text-align:${titleStyle.align || 'center'}; }
  .subtitle { left:${schema.subtitleBox?.x ?? 0}in; top:${schema.subtitleBox?.y ?? 0}in; width:${
    schema.subtitleBox?.w ?? 0
  }in; height:${schema.subtitleBox?.h ?? 0}in; font-size:${subtitleStyle?.fontSize || 24}pt; color:#${normalizeHex(
    subtitleStyle?.color || '333333'
  )}; text-align:${subtitleStyle?.align || 'center'}; }
  .bullets { left:${schema.bulletsBox?.x ?? 0}in; top:${schema.bulletsBox?.y ?? 0}in; width:${
    schema.bulletsBox?.w ?? 0
  }in; height:${schema.bulletsBox?.h ?? 0}in; font-size:${bulletsStyle?.fontSize || 16}pt; color:#${normalizeHex(
    bulletsStyle?.color || '333333'
  )}; }
  .stat { position:absolute; display:flex; align-items:center; justify-content:center; text-align:center; }
  </style></head><body><div class="tpl">
    <div class="box title">Sample Title</div>
    ${
      schema.subtitleBox
        ? `<div class="box subtitle">Optional subtitle</div>`
        : ''
    }
    ${schema.bulletsBox ? `<div class="box bullets">• Bullet one<br/>• Bullet two</div>` : ''}
  </div></body></html>`;
}

export function renderPptxFromSchema(pptx: PptxGenJS, schema: TemplateSchema, content: SlideContent) {
  const slide = pptx.addSlide();

  // Background
  if (schema.background.type === 'solid') {
    slide.background = { color: normalizeHex(schema.background.color) } as unknown as { color: string };
  } else {
    // solid base + gradient rectangle
    slide.background = { color: normalizeHex(schema.background.colors[0]) } as unknown as { color: string };
    slide.addShape(pptx.ShapeType.rect, {
      x: 0,
      y: 0,
      w: '100%',
      h: '100%',
      fill: {
        type: 'gradient',
        color1: normalizeHex(schema.background.colors[0]),
        color2: normalizeHex(schema.background.colors[1]),
        rotation: schema.background.angle ?? 45,
      },
      line: { type: 'none' },
    } as Record<string, unknown>);
  }

  // Optional header bar using accent/brand color
  if (schema.headerBar) {
    slide.addShape(pptx.ShapeType.rect, {
      x: 0,
      y: 0,
      w: '100%',
      h: schema.headerBar.height,
      fill: { color: normalizeHex(schema.headerBar.color), transparency: schema.headerBar.transparency ?? 0 },
      line: { type: 'none' },
    } as Record<string, unknown>);
  }

  // Optional logo/text at top-left
  if (schema.logoBox) {
    slide.addText(schema.logoBox.text || 'Your Brand', {
      x: schema.logoBox.x,
      y: schema.logoBox.y,
      w: schema.logoBox.w,
      h: schema.logoBox.h,
      fontFace: schema.logoBox.style.fontFace || 'Segoe UI',
      fontSize: schema.logoBox.style.fontSize || 14,
      color: normalizeHex(schema.logoBox.style.color || (schema.accentColor || '1F2937')),
      bold: !!schema.logoBox.style.bold,
      align: (schema.logoBox.style.align || 'left') as 'left' | 'center' | 'right',
    });
  }

  // Title
  if (content.title) {
    slide.addText(content.title, {
      x: schema.titleBox.x,
      y: schema.titleBox.y,
      w: schema.titleBox.w,
      h: schema.titleBox.h,
      fontFace: schema.titleBox.style.fontFace || 'Segoe UI',
      fontSize: schema.titleBox.style.fontSize || 44,
      color: normalizeHex(schema.titleBox.style.color || '000000'),
      bold: !!schema.titleBox.style.bold,
      align: (schema.titleBox.style.align || 'center') as 'left' | 'center' | 'right',
    });
  }

  // Subtitle
  if (schema.subtitleBox && content.subtitle) {
    slide.addText(content.subtitle, {
      x: schema.subtitleBox.x,
      y: schema.subtitleBox.y,
      w: schema.subtitleBox.w,
      h: schema.subtitleBox.h,
      fontFace: schema.subtitleBox.style.fontFace || 'Segoe UI',
      fontSize: schema.subtitleBox.style.fontSize || 24,
      color: normalizeHex(schema.subtitleBox.style.color || '333333'),
      align: (schema.subtitleBox.style.align || 'center') as 'left' | 'center' | 'right',
    });
  }

  // Bullets
  if (schema.bulletsBox && content.bulletPoints?.length) {
    slide.addText(content.bulletPoints.map(p => `• ${p}`).join('\n'), {
      x: schema.bulletsBox.x,
      y: schema.bulletsBox.y,
      w: schema.bulletsBox.w,
      h: schema.bulletsBox.h,
      fontFace: schema.bulletsBox.style.fontFace || 'Segoe UI',
      fontSize: schema.bulletsBox.style.fontSize || 16,
      color: normalizeHex(schema.bulletsBox.style.color || '333333'),
      lineSpacing: schema.bulletsBox.style.lineSpacing || 24,
    });
  }

  // Stats (optional)
  if (schema.statBoxes && content.statistics?.length) {
    schema.statBoxes.slice(0, content.statistics.length).forEach((box, idx) => {
      slide.addShape(pptx.ShapeType.roundRect, {
        x: box.x,
        y: box.y,
        w: box.w,
        h: box.h,
        fill: { color: normalizeHex(box.fillColor), transparency: box.fillTransparency ?? 20 },
        line: box.lineColor ? { color: normalizeHex(box.lineColor), transparency: box.lineTransparency ?? 30 } : undefined,
      } as Record<string, unknown>);
      const stat = content.statistics[idx];
      slide.addText([
        { text: stat.value, options: { fontSize: box.numberStyle.fontSize || 28, bold: true, color: normalizeHex(box.numberStyle.color || '000000') } },
        { text: `\n${stat.label}`, options: { fontSize: box.labelStyle.fontSize || 12, color: normalizeHex(box.labelStyle.color || '333333') } },
      ], { x: box.x, y: box.y, w: box.w, h: box.h, align: 'center', valign: 'middle' } as Record<string, unknown>);
    });
  }

  // Imported layout: three columns with headers and bullets
  if (schema.columns && schema.columns.length > 0) {
    schema.columns.forEach((col) => {
      // Column container rectangle (optional fill/line)
      slide.addShape(pptx.ShapeType.rect, {
        x: col.x,
        y: col.y,
        w: col.w,
        h: col.h,
        fill: col.boxStyle?.fillColor ? { color: normalizeHex(col.boxStyle.fillColor), transparency: col.boxStyle.fillTransparency ?? 0 } : { type: 'none' },
        line: col.boxStyle?.lineColor ? { color: normalizeHex(col.boxStyle.lineColor), transparency: col.boxStyle.lineTransparency ?? 0 } : { type: 'none' },
      } as Record<string, unknown>);

      // Header text
      slide.addText(col.header, {
        x: col.x + 0.12,
        y: col.y + 0.12,
        w: col.w - 0.24,
        h: 0.3,
        fontFace: col.style.headerStyle.fontFace || 'Segoe UI',
        fontSize: col.style.headerStyle.fontSize || 10,
        color: normalizeHex(col.style.headerStyle.color || '111111'),
        bold: !!col.style.headerStyle.bold,
        align: (col.style.headerStyle.align || 'left') as 'left' | 'center' | 'right',
      });

      // Bullet list
      const bulletText = col.bullets.map(b => `• ${b}`).join('\n');
      slide.addText(bulletText, {
        x: col.x + 0.24,
        y: col.y + 0.48,
        w: col.w - 0.36,
        h: col.h - 0.6,
        fontFace: col.style.bulletStyle.fontFace || 'Segoe UI',
        fontSize: col.style.bulletStyle.fontSize || 10,
        color: normalizeHex(col.style.bulletStyle.color || '111111'),
        lineSpacing: col.style.bulletStyle.lineSpacing || 18,
      });
    });
  }

  // Imported layout: divider line at Y
  if (typeof schema.dividerLineY === 'number') {
    slide.addShape(pptx.ShapeType.line, {
      x: 0.064,
      y: schema.dividerLineY,
      w: '100%',
      h: 0,
      line: { color: normalizeHex(schema.accentColor || '333333') },
    } as Record<string, unknown>);
  }

  // Imported layout: footer texts
  if (schema.footerLeft) {
    slide.addText(schema.footerLeft.text, {
      x: schema.footerLeft.x,
      y: schema.footerLeft.y,
      w: schema.footerLeft.w,
      h: schema.footerLeft.h,
      fontFace: schema.footerLeft.style.fontFace || 'Segoe UI',
      fontSize: schema.footerLeft.style.fontSize || 10,
      color: normalizeHex(schema.footerLeft.style.color || '333333'),
      align: (schema.footerLeft.style.align || 'left') as 'left' | 'center' | 'right',
    });
  }
  if (schema.footerRight) {
    slide.addText(schema.footerRight.text, {
      x: schema.footerRight.x,
      y: schema.footerRight.y,
      w: schema.footerRight.w,
      h: schema.footerRight.h,
      fontFace: schema.footerRight.style.fontFace || 'Segoe UI',
      fontSize: schema.footerRight.style.fontSize || 10,
      color: normalizeHex(schema.footerRight.style.color || '333333'),
      align: (schema.footerRight.style.align || 'right') as 'left' | 'center' | 'right',
    });
  }
}

