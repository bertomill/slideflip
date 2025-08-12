import { SlideDefinition, SlideTheme } from './slide-types';

/**
 * Sample themes based on common presentation styles
 */
export const sampleThemes: Record<string, SlideTheme> = {
  professional: {
    name: 'Professional',
    colors: {
      primary: '003366',
      secondary: '0066cc',
      accent: '66b2ff',
      background: 'ffffff',
      text: '333333',
      textLight: '666666'
    },
    fonts: {
      title: 'Arial',
      body: 'Arial'
    },
    sizes: {
      titleSize: 44,
      headingSize: 32,
      bodySize: 18,
      captionSize: 14
    }
  },
  modern: {
    name: 'Modern',
    colors: {
      primary: '6366f1',
      secondary: '8b5cf6',
      accent: 'a78bfa',
      background: 'ffffff',
      text: '1f2937',
      textLight: '6b7280'
    },
    fonts: {
      title: 'Segoe UI',
      body: 'Segoe UI'
    },
    sizes: {
      titleSize: 48,
      headingSize: 36,
      bodySize: 20,
      captionSize: 16
    }
  },
  minimal: {
    name: 'Minimal',
    colors: {
      primary: '000000',
      secondary: '333333',
      accent: '666666',
      background: 'ffffff',
      text: '000000',
      textLight: '666666'
    },
    fonts: {
      title: 'Helvetica Neue',
      body: 'Helvetica Neue'
    },
    sizes: {
      titleSize: 40,
      headingSize: 28,
      bodySize: 16,
      captionSize: 12
    }
  }
};

/**
 * Sample slides in PptxGenJS JSON format
 * Based on official PptxGenJS examples
 */
export const sampleSlidesJson: SlideDefinition[] = [
  // 1. Simple Title Slide
  {
    id: 'title-slide-basic',
    title: 'Title Slide',
    background: { color: 'f5f5f5' },
    objects: [
      {
        type: 'text',
        text: 'Welcome to Our Presentation',
        options: {
          x: 0.5,
          y: 2.0,
          w: 9,
          h: 1.5,
          fontSize: 44,
          fontFace: 'Arial',
          color: '003366',
          bold: true,
          align: 'center',
          valign: 'middle'
        }
      },
      {
        type: 'text',
        text: 'Subtitle or Tagline Goes Here',
        options: {
          x: 0.5,
          y: 3.5,
          w: 9,
          h: 0.75,
          fontSize: 24,
          fontFace: 'Arial',
          color: '666666',
          align: 'center',
          valign: 'middle'
        }
      },
      {
        type: 'shape',
        shape: 'line',
        options: {
          x: 3.5,
          y: 4.5,
          w: 2.5,
          h: 0,
          line: { color: '003366', width: 2 }
        }
      },
      {
        type: 'text',
        text: 'January 2025',
        options: {
          x: 0.5,
          y: 5.0,
          w: 9,
          h: 0.5,
          fontSize: 16,
          fontFace: 'Arial',
          color: '999999',
          align: 'center'
        }
      }
    ]
  },

  // 2. Bullet Points Slide
  {
    id: 'bullets-basic',
    title: 'Key Points',
    background: { color: 'ffffff' },
    objects: [
      {
        type: 'text',
        text: 'Key Highlights',
        options: {
          x: 0.5,
          y: 0.5,
          w: 9,
          h: 0.75,
          fontSize: 36,
          fontFace: 'Arial',
          color: '003366',
          bold: true
        }
      },
      {
        type: 'shape',
        shape: 'rect',
        options: {
          x: 0.5,
          y: 1.25,
          w: 9,
          h: 0.02,
          fill: { color: 'cccccc' }
        }
      },
      {
        type: 'text',
        text: '• First important point about the topic\n• Second key insight to consider\n• Third critical element to remember\n• Fourth strategic consideration',
        options: {
          x: 0.5,
          y: 1.75,
          w: 8.5,
          h: 3,
          fontSize: 20,
          fontFace: 'Arial',
          color: '333333',
          lineSpacing: 36,
          paraSpaceBefore: 6,
          valign: 'top'
        }
      }
    ]
  },

  // 3. Two Column Layout
  {
    id: 'two-column',
    title: 'Comparison',
    background: { color: 'ffffff' },
    objects: [
      {
        type: 'text',
        text: 'Option Comparison',
        options: {
          x: 0.5,
          y: 0.5,
          w: 9,
          h: 0.75,
          fontSize: 36,
          fontFace: 'Arial',
          color: '003366',
          bold: true,
          align: 'center'
        }
      },
      // Left column
      {
        type: 'shape',
        shape: 'roundRect',
        options: {
          x: 0.5,
          y: 1.5,
          w: 4.25,
          h: 3.5,
          fill: { color: 'f0f4f8' },
          rectRadius: 0.1
        }
      },
      {
        type: 'text',
        text: 'Option A',
        options: {
          x: 0.75,
          y: 1.75,
          w: 3.75,
          h: 0.5,
          fontSize: 24,
          fontFace: 'Arial',
          color: '003366',
          bold: true,
          align: 'center'
        }
      },
      {
        type: 'text',
        text: '✓ Benefit one\n✓ Benefit two\n✓ Benefit three',
        options: {
          x: 0.75,
          y: 2.5,
          w: 3.75,
          h: 2,
          fontSize: 18,
          fontFace: 'Arial',
          color: '333333',
          lineSpacing: 28
        }
      },
      // Right column
      {
        type: 'shape',
        shape: 'roundRect',
        options: {
          x: 5.25,
          y: 1.5,
          w: 4.25,
          h: 3.5,
          fill: { color: 'e8f4fd' },
          rectRadius: 0.1
        }
      },
      {
        type: 'text',
        text: 'Option B',
        options: {
          x: 5.5,
          y: 1.75,
          w: 3.75,
          h: 0.5,
          fontSize: 24,
          fontFace: 'Arial',
          color: '0066cc',
          bold: true,
          align: 'center'
        }
      },
      {
        type: 'text',
        text: '✓ Advantage one\n✓ Advantage two\n✓ Advantage three',
        options: {
          x: 5.5,
          y: 2.5,
          w: 3.75,
          h: 2,
          fontSize: 18,
          fontFace: 'Arial',
          color: '333333',
          lineSpacing: 28
        }
      }
    ]
  },

  // 4. Data/Metrics Slide
  {
    id: 'metrics-grid',
    title: 'Key Metrics',
    background: { color: 'ffffff' },
    objects: [
      {
        type: 'text',
        text: 'Q4 2024 Performance',
        options: {
          x: 0.5,
          y: 0.3,
          w: 9,
          h: 0.75,
          fontSize: 36,
          fontFace: 'Arial',
          color: '003366',
          bold: true,
          align: 'center'
        }
      },
      // Metric 1
      {
        type: 'shape',
        shape: 'roundRect',
        options: {
          x: 0.75,
          y: 1.5,
          w: 2.75,
          h: 1.75,
          fill: { color: 'e8f5e9' },
          rectRadius: 0.1
        }
      },
      {
        type: 'text',
        text: '$2.4M',
        options: {
          x: 0.75,
          y: 1.75,
          w: 2.75,
          h: 0.75,
          fontSize: 32,
          fontFace: 'Arial',
          color: '2e7d32',
          bold: true,
          align: 'center'
        }
      },
      {
        type: 'text',
        text: 'Revenue',
        options: {
          x: 0.75,
          y: 2.5,
          w: 2.75,
          h: 0.5,
          fontSize: 16,
          fontFace: 'Arial',
          color: '666666',
          align: 'center'
        }
      },
      // Metric 2
      {
        type: 'shape',
        shape: 'roundRect',
        options: {
          x: 3.75,
          y: 1.5,
          w: 2.75,
          h: 1.75,
          fill: { color: 'fff3e0' },
          rectRadius: 0.1
        }
      },
      {
        type: 'text',
        text: '156%',
        options: {
          x: 3.75,
          y: 1.75,
          w: 2.75,
          h: 0.75,
          fontSize: 32,
          fontFace: 'Arial',
          color: 'e65100',
          bold: true,
          align: 'center'
        }
      },
      {
        type: 'text',
        text: 'Growth',
        options: {
          x: 3.75,
          y: 2.5,
          w: 2.75,
          h: 0.5,
          fontSize: 16,
          fontFace: 'Arial',
          color: '666666',
          align: 'center'
        }
      },
      // Metric 3
      {
        type: 'shape',
        shape: 'roundRect',
        options: {
          x: 6.75,
          y: 1.5,
          w: 2.75,
          h: 1.75,
          fill: { color: 'e3f2fd' },
          rectRadius: 0.1
        }
      },
      {
        type: 'text',
        text: '8.9K',
        options: {
          x: 6.75,
          y: 1.75,
          w: 2.75,
          h: 0.75,
          fontSize: 32,
          fontFace: 'Arial',
          color: '1565c0',
          bold: true,
          align: 'center'
        }
      },
      {
        type: 'text',
        text: 'Customers',
        options: {
          x: 6.75,
          y: 2.5,
          w: 2.75,
          h: 0.5,
          fontSize: 16,
          fontFace: 'Arial',
          color: '666666',
          align: 'center'
        }
      },
      // Summary text
      {
        type: 'text',
        text: 'All metrics show positive year-over-year growth',
        options: {
          x: 0.5,
          y: 4.0,
          w: 9,
          h: 0.5,
          fontSize: 18,
          fontFace: 'Arial',
          color: '333333',
          italic: true,
          align: 'center'
        }
      }
    ]
  },

  // 5. Simple Chart Slide (placeholder - would need actual chart rendering)
  {
    id: 'chart-placeholder',
    title: 'Growth Chart',
    background: { color: 'ffffff' },
    objects: [
      {
        type: 'text',
        text: 'Monthly Revenue Growth',
        options: {
          x: 0.5,
          y: 0.5,
          w: 9,
          h: 0.75,
          fontSize: 32,
          fontFace: 'Arial',
          color: '003366',
          bold: true,
          align: 'center'
        }
      },
      {
        type: 'shape',
        shape: 'rect',
        options: {
          x: 1,
          y: 1.5,
          w: 8,
          h: 3.5,
          fill: { color: 'f8f9fa' },
          line: { color: 'dee2e6', width: 1 }
        }
      },
      {
        type: 'text',
        text: '[Chart Placeholder]\nRevenue data would be displayed here',
        options: {
          x: 1,
          y: 2.75,
          w: 8,
          h: 1,
          fontSize: 18,
          fontFace: 'Arial',
          color: '999999',
          align: 'center',
          italic: true
        }
      }
    ]
  }
];

/**
 * Helper function to apply theme colors to a slide
 */
export function applyThemeToSlide(slide: SlideDefinition, theme: SlideTheme): SlideDefinition {
  const themedSlide = { ...slide };
  
  // Update background if it's white
  if (themedSlide.background?.color === 'ffffff') {
    themedSlide.background.color = theme.colors.background;
  }
  
  // Update text colors
  themedSlide.objects = themedSlide.objects.map(obj => {
    if (obj.type === 'text') {
      const newObj = { ...obj };
      // Update primary color texts
      if (obj.options.color === '003366') {
        newObj.options.color = theme.colors.primary;
      }
      // Update body text
      else if (obj.options.color === '333333') {
        newObj.options.color = theme.colors.text;
      }
      // Update light text
      else if (obj.options.color === '666666' || obj.options.color === '999999') {
        newObj.options.color = theme.colors.textLight;
      }
      return newObj;
    }
    return obj;
  });
  
  return themedSlide;
}