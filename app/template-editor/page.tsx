"use client";

import React, { useState, useRef, useEffect, Suspense, useCallback } from 'react';
import { Canvas, Textbox, Rect, Circle, Line, Triangle, FabricObject } from 'fabric';
import { loadSVGFromString, util } from 'fabric';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sidebar } from '@/components/ui/sidebar';
import { 
  Type, Square, Circle as CircleIcon, Minus, Triangle as TriangleIcon,
  Save, Download, Trash2, Copy, Bold, Italic, Underline,
  AlignLeft, AlignCenter, AlignRight, Eye, EyeOff, Menu,
  ZoomIn, ZoomOut, RotateCcw, ChevronLeft, ChevronRight,
  // Business Icons
  Briefcase, Target, TrendingUp, BarChart, PieChart, DollarSign,
  // Communication Icons  
  Mail, Phone, MessageCircle, Users, UserCheck, Send,
  // Technology Icons
  Monitor, Smartphone, Wifi, Database, Cloud, Cpu,
  // Nature Icons
  Sun, Moon, Star, Leaf, TreePine, Flower,
  // Arrows
  ArrowRight, ArrowLeft, ArrowUp, ArrowDown, ArrowUpRight, ArrowDownLeft,
  // General
  Heart, Home, Settings, Search, Calendar, Clock,
  // Upload
  Upload, Image as ImageIcon,
  // AI Builder
  Bot, Loader2, Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { convertFabricToSlideJson, exportCanvasFormats } from '@/lib';
import { renderSlideOnCanvas } from '@/lib/slide-to-fabric';
import { SlideDefinition } from '@/lib/slide-types';
import { useRouter, useSearchParams } from 'next/navigation';

// Canvas dimensions for 16:9 aspect ratio
const CANVAS_WIDTH = 960;

function TemplateEditorInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const templateId = searchParams.get('id');
  
  const [canvas, setCanvas] = useState<Canvas | null>(null);
  const [selectedObject, setSelectedObject] = useState<FabricObject | null>(null);
  const [templateName, setTemplateName] = useState('New Template');
  const [templateDescription, setTemplateDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewJson, setPreviewJson] = useState<SlideDefinition | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [rightSidebarCollapsed, setRightSidebarCollapsed] = useState(false);
  const [user, setUser] = useState<{
    email?: string;
    user_metadata?: {
      avatar_url?: string;
      full_name?: string;
    };
  } | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [lastPanPoint, setLastPanPoint] = useState({ x: 0, y: 0 });
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const zoomLevelRef = useRef(1);
  const updateCanvasSizeRef = useRef<((zoom: number) => void) | null>(null);

  // Load user authentication
  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // Initialize Fabric.js canvas
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    // Wait for container to be properly sized
    const containerRect = containerRef.current.getBoundingClientRect();
    if (containerRect.width === 0 || containerRect.height === 0) {
      // Container not yet sized, retry after a short delay
      const timeout = setTimeout(() => {
        if (containerRef.current) {
          const newRect = containerRef.current.getBoundingClientRect();
          if (newRect.width > 0 && newRect.height > 0) {
            // Trigger re-initialization
            setCanvas(null);
          }
        }
      }, 100);
      return () => clearTimeout(timeout);
    }

    const aspectRatio = 16 / 9;
    const padding = 60; // Account for container padding and margins
    
    let canvasWidth = Math.min(containerRect.width - padding, CANVAS_WIDTH);
    let canvasHeight = canvasWidth / aspectRatio;
    
    // Ensure canvas fits vertically too
    if (canvasHeight > containerRect.height - padding) {
      canvasHeight = containerRect.height - padding;
      canvasWidth = canvasHeight * aspectRatio;
    }

    try {
      const fabricCanvas = new Canvas(canvasRef.current, {
        width: canvasWidth,
        height: canvasHeight,
        backgroundColor: '#ffffff',
        preserveObjectStacking: true,
      });

      // Verify canvas is properly initialized before proceeding
      // @ts-ignore - accessing internal properties
      if (!fabricCanvas.lowerCanvasEl || !fabricCanvas.getContext || !fabricCanvas.contextContainer) {
        console.error('Canvas not fully initialized, retrying...');
        // Retry initialization after a short delay
        setTimeout(() => {
          if (canvasRef.current && !canvas) {
            setCanvas(null); // Trigger re-initialization
          }
        }, 100);
        return;
      }

      // Ensure white background is always visible
      fabricCanvas.backgroundColor = '#ffffff';
      fabricCanvas.renderAll();

      // Handle object selection
      fabricCanvas.on('selection:created', (e) => {
        setSelectedObject(e.selected?.[0]);
      });

      fabricCanvas.on('selection:updated', (e) => {
        setSelectedObject(e.selected?.[0]);
      });

      fabricCanvas.on('selection:cleared', () => {
        setSelectedObject(null);
      });

      // Add mouse wheel zoom support - scale canvas dimensions  
      fabricCanvas.on('mouse:wheel', (opt) => {
        const delta = opt.e.deltaY;
        let newZoom = zoomLevel;
        newZoom *= 0.999 ** delta;
        if (newZoom > 3) newZoom = 3;
        if (newZoom < 0.3) newZoom = 0.3;
        
        setZoomLevel(newZoom);
        
        // Use timeout to ensure state is updated before calling updateCanvasSize
        setTimeout(() => {
          updateCanvasSize(newZoom);
        }, 0);
        
        opt.e.preventDefault();
        opt.e.stopPropagation();
      });

      // Add pan functionality
      fabricCanvas.on('mouse:down', (opt) => {
        const evt = opt.e as MouseEvent;
        if (evt.altKey === true || (evt.shiftKey === true && fabricCanvas.getZoom() > 1)) {
          setIsPanning(true);
          (fabricCanvas as Canvas & { isDragging: boolean }).isDragging = true;
          fabricCanvas.selection = false;
          setLastPanPoint({ x: evt.clientX, y: evt.clientY });
        }
      });

      fabricCanvas.on('mouse:move', (opt) => {
        if ((fabricCanvas as Canvas & { isDragging: boolean }).isDragging) {
          const e = opt.e as MouseEvent;
          const vpt = fabricCanvas.viewportTransform;
          if (vpt) {
            vpt[4] += e.clientX - lastPanPoint.x;
            vpt[5] += e.clientY - lastPanPoint.y;
            fabricCanvas.requestRenderAll();
            setLastPanPoint({ x: e.clientX, y: e.clientY });
          }
        }
      });

      fabricCanvas.on('mouse:up', () => {
        if (fabricCanvas.viewportTransform) {
          fabricCanvas.setViewportTransform(fabricCanvas.viewportTransform);
        }
        (fabricCanvas as Canvas & { isDragging: boolean }).isDragging = false;
        fabricCanvas.selection = true;
        setIsPanning(false);
      });


      setCanvas(fabricCanvas);

      // Load template if editing existing one
      if (templateId) {
        loadTemplate(templateId, fabricCanvas);
      }

      // Handle window resize - maintain current zoom level
      const handleResize = () => {
        if (!containerRef.current || !fabricCanvas) return;
        
        // Use the updateCanvasSize function to maintain zoom level
        setTimeout(() => {
          updateCanvasSize(zoomLevel);
        }, 0);
      };

      window.addEventListener('resize', handleResize);

      return () => {
        window.removeEventListener('resize', handleResize);
        fabricCanvas.dispose();
      };
    } catch (error) {
      console.error('Error initializing canvas:', error);
      return;
    }
  }, [templateId]);

  // Load existing template
  const loadTemplate = async (id: string, fabricCanvas: Canvas) => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('slide_templates')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        console.error('Error loading template:', error);
        return;
      }

      if (data) {
        setTemplateName(data.name);
        setTemplateDescription(data.description || '');
        
        // Load from Fabric JSON if available, otherwise convert from PptxGenJS JSON
        if (data.fabric_json) {
          fabricCanvas.loadFromJSON(data.fabric_json, () => {
            fabricCanvas.renderAll();
          });
        } else if (data.slide_json) {
          // Ensure canvas is fully ready before rendering
          const attemptRender = (retries = 3) => {
            // @ts-ignore - accessing internal properties
            if (fabricCanvas.contextContainer && fabricCanvas.lowerCanvasEl) {
              try {
                renderSlideOnCanvas(fabricCanvas, data.slide_json, 1);
              } catch (renderError) {
                console.error('Error rendering slide on canvas:', renderError);
                if (retries > 0) {
                  setTimeout(() => attemptRender(retries - 1), 200);
                }
              }
            } else if (retries > 0) {
              // Canvas not ready, retry
              setTimeout(() => attemptRender(retries - 1), 200);
            } else {
              console.error('Failed to render slide after multiple attempts');
            }
          };
          
          // Start render attempt after a short delay
          setTimeout(() => attemptRender(), 100);
        }
      }
    } catch (error) {
      console.error('Error in loadTemplate:', error);
    }
  };

  // Add text element
  const addText = () => {
    if (!canvas) return;
    
    const text = new Textbox('Click to edit text', {
      left: 100,
      top: 100,
      width: 300,
      fontSize: 24,
      fill: '#333333',
      fontFamily: 'Arial',
      editable: true,
    });
    
    canvas.add(text);
    canvas.setActiveObject(text);
    canvas.renderAll();
  };

  // Add shape elements
  const addRectangle = () => {
    if (!canvas) return;
    
    const rect = new Rect({
      left: 100,
      top: 100,
      width: 200,
      height: 100,
      fill: '#e3f2fd',
      stroke: '#1976d2',
      strokeWidth: 2,
    });
    
    canvas.add(rect);
    canvas.setActiveObject(rect);
    canvas.renderAll();
  };

  const addCircle = () => {
    if (!canvas) return;
    
    const circle = new Circle({
      left: 100,
      top: 100,
      radius: 50,
      fill: '#fff3e0',
      stroke: '#f57c00',
      strokeWidth: 2,
    });
    
    canvas.add(circle);
    canvas.setActiveObject(circle);
    canvas.renderAll();
  };

  const addLine = () => {
    if (!canvas) return;
    
    const line = new Line([0, 0, 200, 0], {
      left: 100,
      top: 100,
      stroke: '#333333',
      strokeWidth: 2,
    });
    
    canvas.add(line);
    canvas.setActiveObject(line);
    canvas.renderAll();
  };

  const addTriangle = () => {
    if (!canvas) return;
    
    const triangle = new Triangle({
      left: 100,
      top: 100,
      width: 100,
      height: 100,
      fill: '#f3e5f5',
      stroke: '#7b1fa2',
      strokeWidth: 2,
    });
    
    canvas.add(triangle);
    canvas.setActiveObject(triangle);
    canvas.renderAll();
  };

  // Delete selected object
  const deleteSelected = () => {
    if (!canvas || !selectedObject) return;
    canvas.remove(selectedObject);
    setSelectedObject(null);
    canvas.renderAll();
  };

  // Duplicate selected object
  const duplicateSelected = async () => {
    if (!canvas || !selectedObject) return;
    // @ts-expect-error Fabric v6 clone returns a promise in some builds; fall back to callback signature
    const cloned: FabricObject = typeof (selectedObject as any).clone === 'function' && (await (selectedObject as any).clone?.()) || (selectedObject as any).clone;
    if (!cloned) return;
    // Offset the clone for visibility
    (cloned as any).left = ((selectedObject as any).left || 0) + 20;
    (cloned as any).top = ((selectedObject as any).top || 0) + 20;
    canvas.add(cloned);
    canvas.setActiveObject(cloned);
    canvas.renderAll();
  };

  // Update selected object properties
  const updateSelectedProperty = (property: string, value: string | number | boolean) => {
    if (!canvas || !selectedObject) return;
    
    selectedObject.set(property, value);
    canvas.renderAll();
  };

  // Toggle text formatting
  const toggleBold = () => {
    if (!selectedObject || selectedObject.type !== 'textbox') return;
    const isBold = selectedObject.fontWeight === 'bold';
    updateSelectedProperty('fontWeight', isBold ? 'normal' : 'bold');
  };

  const toggleItalic = () => {
    if (!selectedObject || selectedObject.type !== 'textbox') return;
    const isItalic = selectedObject.fontStyle === 'italic';
    updateSelectedProperty('fontStyle', isItalic ? 'normal' : 'italic');
  };

  const toggleUnderline = () => {
    if (!selectedObject || selectedObject.type !== 'textbox') return;
    updateSelectedProperty('underline', !selectedObject.underline);
  };

  // Set text alignment
  const setTextAlign = (align: string) => {
    if (!selectedObject || selectedObject.type !== 'textbox') return;
    updateSelectedProperty('textAlign', align);
  };

  // Set font family
  const setFontFamily = (fontFamily: string) => {
    if (!selectedObject || selectedObject.type !== 'textbox') return;
    updateSelectedProperty('fontFamily', fontFamily);
  };

  // Common font families
  const fontFamilies = [
    { value: 'Arial', label: 'Arial' },
    { value: 'Helvetica', label: 'Helvetica' },
    { value: 'Times New Roman', label: 'Times New Roman' },
    { value: 'Georgia', label: 'Georgia' },
    { value: 'Verdana', label: 'Verdana' },
    { value: 'Trebuchet MS', label: 'Trebuchet MS' },
    { value: 'Courier New', label: 'Courier New' },
    { value: 'Impact', label: 'Impact' },
    { value: 'Comic Sans MS', label: 'Comic Sans MS' },
  ];

  // Icon library organized by categories
  const iconLibrary = {
    business: [
      { icon: Briefcase, name: 'Briefcase' },
      { icon: Target, name: 'Target' },
      { icon: TrendingUp, name: 'Trending Up' },
      { icon: BarChart, name: 'Bar Chart' },
      { icon: PieChart, name: 'Pie Chart' },
      { icon: DollarSign, name: 'Dollar Sign' },
    ],
    communication: [
      { icon: Mail, name: 'Mail' },
      { icon: Phone, name: 'Phone' },
      { icon: MessageCircle, name: 'Message' },
      { icon: Users, name: 'Users' },
      { icon: UserCheck, name: 'User Check' },
      { icon: Send, name: 'Send' },
    ],
    technology: [
      { icon: Monitor, name: 'Monitor' },
      { icon: Smartphone, name: 'Smartphone' },
      { icon: Wifi, name: 'Wifi' },
      { icon: Database, name: 'Database' },
      { icon: Cloud, name: 'Cloud' },
      { icon: Cpu, name: 'CPU' },
    ],
    nature: [
      { icon: Sun, name: 'Sun' },
      { icon: Moon, name: 'Moon' },
      { icon: Star, name: 'Star' },
      { icon: Leaf, name: 'Leaf' },
      { icon: TreePine, name: 'Tree' },
      { icon: Flower, name: 'Flower' },
    ],
    arrows: [
      { icon: ArrowRight, name: 'Arrow Right' },
      { icon: ArrowLeft, name: 'Arrow Left' },
      { icon: ArrowUp, name: 'Arrow Up' },
      { icon: ArrowDown, name: 'Arrow Down' },
      { icon: ArrowUpRight, name: 'Arrow Up Right' },
      { icon: ArrowDownLeft, name: 'Arrow Down Left' },
    ],
    general: [
      { icon: Heart, name: 'Heart' },
      { icon: Home, name: 'Home' },
      { icon: Settings, name: 'Settings' },
      { icon: Search, name: 'Search' },
      { icon: Calendar, name: 'Calendar' },
      { icon: Clock, name: 'Clock' },
    ],
  };

  // Icon SVG path data - simplified approach using predefined SVG strings
  const getIconSVG = (iconName: string): string => {
    const iconPaths: Record<string, string> = {
      'Briefcase': '<path d="M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2Z"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
      'Target': '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
      'Trending Up': '<polyline points="22,7 13.5,15.5 8.5,10.5 2,17"/><polyline points="16,7 22,7 22,13"/>',
      'Bar Chart': '<line x1="12" x2="12" y1="20" y2="10"/><line x1="18" x2="18" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="16"/>',
      'Pie Chart': '<path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="m22 12-10-10v10z"/>',
      'Dollar Sign': '<line x1="12" x2="12" y1="2" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
      'Mail': '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-10 5L2 7"/>',
      'Phone': '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>',
      'Message': '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
      'Users': '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="m22 21-3.5-3.5M17 8.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Z"/>',
      'Heart': '<path d="m19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z"/>',
      'Star': '<polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/>',
    };
    
    const pathData = iconPaths[iconName] || '<text x="12" y="16" text-anchor="middle" font-size="8">Icon</text>';
    
    return `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#333333" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      ${pathData}
    </svg>`;
  };

  // Add icon to canvas using proper SVG loading
  const addIcon = (_IconComponent: React.ComponentType<{ className?: string }>, iconName: string) => {
    if (!canvas) return;
    
    try {
      // Get SVG string for the icon
      const svgString = getIconSVG(iconName);
      
      // Load SVG into Fabric.js canvas
      loadSVGFromString(svgString, (objects: any[], options: any) => {
        const icon = util.groupSVGElements(objects, options);
        
        // Set position and properties
        icon.set({
          left: 100,
          top: 100,
          scaleX: 1,
          scaleY: 1,
        });
        
        canvas.add(icon as unknown as FabricObject);
        canvas.setActiveObject(icon);
        canvas.renderAll();
      });
    } catch (error) {
      console.error('Error adding icon:', error);
      
      // Fallback: create a simple text element
      const iconText = new Textbox(iconName, {
        left: 100,
        top: 100,
        width: 80,
        height: 30,
        fontSize: 14,
        fill: '#333333',
        fontFamily: 'Arial',
        textAlign: 'center',
        editable: true,
      });
      
      canvas.add(iconText);
      canvas.setActiveObject(iconText);
      canvas.renderAll();
    }
  };

  // State for selected icon category
  const [selectedIconCategory, setSelectedIconCategory] = useState<string>('business');
  
  // State for right sidebar mode
  const [rightSidebarMode, setRightSidebarMode] = useState<'editor' | 'ai'>('editor');
  
  // State for AI chat
  const [chatMessages, setChatMessages] = useState<Array<{id: string, role: 'user' | 'assistant', content: string, timestamp: Date}>>([
    {
      id: '1',
      role: 'assistant',
      content: 'Hi! I\'m your AI design assistant. I can help you modify your slide template by adding elements, changing colors, adjusting layouts, and more. What would you like to do?',
      timestamp: new Date()
    }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isAiThinking, setIsAiThinking] = useState(false);
  
  // Handle AI chat submission
  const handleChatSubmit = async () => {
    if (!chatInput.trim()) return;
    handleSendMessage(chatInput);
  };

  // Handle sending messages (both manual input and suggestions)
  const handleSendMessage = async (message: string) => {
    if (!message.trim()) return;
    
    const userMessage = {
      id: Date.now().toString(),
      role: 'user' as const,
      content: message,
      timestamp: new Date()
    };
    
    setChatMessages(prev => [...prev, userMessage]);
    setChatInput('');
    setIsAiThinking(true);
    
    // Simulate AI response (in a real app, this would call an AI API)
    setTimeout(() => {
      const aiResponse = {
        id: (Date.now() + 1).toString(),
        role: 'assistant' as const,
        content: generateAIResponse(message),
        timestamp: new Date()
      };
      
      setChatMessages(prev => [...prev, aiResponse]);
      setIsAiThinking(false);
      
      // Apply the requested changes to the canvas
      applyAIChanges(message);
    }, 1000);
  };
  
  // Generate AI response with enhanced canvas manipulation
  const generateAIResponse = (userInput: string): string => {
    const input = userInput.toLowerCase();
    
    // Text-related commands
    if (input.includes('text') || input.includes('title') || input.includes('heading')) {
      if (input.includes('title') || input.includes('heading')) {
        return 'I\'ve added a title text element to your slide. You can edit it by double-clicking. Would you like me to make it larger, center it, or change its style?';
      }
      return 'I\'ve added a text element to your slide. You can edit it by clicking on it and typing. Would you like me to change the font, size, or color?';
    }
    // Shape commands
    else if (input.includes('circle') || input.includes('round')) {
      return 'I\'ve added a circle shape to your slide. You can resize it by dragging the corners or change its color in the Properties panel.';
    } 
    else if (input.includes('rectangle') || input.includes('box') || input.includes('square')) {
      return 'I\'ve added a rectangle to your slide. You can move and resize it as needed. Would you like me to change its color or add a border?';
    }
    else if (input.includes('triangle')) {
      return 'I\'ve added a triangle shape to your slide. You can adjust its size and color as needed.';
    }
    else if (input.includes('line')) {
      return 'I\'ve added a line to your slide. You can rotate and resize it to create dividers or arrows.';
    }
    // Icon commands
    else if (input.includes('icon')) {
      return 'I\'ve added an icon to your slide. You can find more icons in the Icon Library section, organized by categories like Business, Communication, and Technology.';
    }
    // Color and styling commands
    else if (input.includes('color') || input.includes('background')) {
      if (input.includes('background')) {
        return 'I can help you change the background color! What color would you like? You can say things like "make it blue" or "change to red".';
      }
      return 'I can help you change colors! Select any element and I can modify its fill and stroke colors. What specific color changes would you like?';
    }
    // Layout commands
    else if (input.includes('center') || input.includes('align')) {
      return 'I can help you align and center elements on your slide. Select an element first, or tell me what you\'d like to center.';
    }
    // Size commands
    else if (input.includes('larger') || input.includes('bigger') || input.includes('smaller') || input.includes('size')) {
      return 'I can help you resize elements! Select an element first, then tell me if you want it larger or smaller.';
    }
    // Delete/remove commands
    else if (input.includes('delete') || input.includes('remove') || input.includes('clear')) {
      return 'I can help you remove elements! Select an element first, or tell me what type of element you\'d like to remove.';
    }
    // Default response
    else {
      return 'I can help you add text, shapes, icons, or modify existing elements. Try asking me to "add a title", "create a circle", "change the background color", or "make it larger". What would you like to create?';
    }
  };
  
  // Apply AI-suggested changes to canvas with enhanced functionality
  const applyAIChanges = (userInput: string) => {
    if (!canvas) return;
    
    const input = userInput.toLowerCase();
    
    // Text commands
    if (input.includes('text') || input.includes('title') || input.includes('heading')) {
      if (input.includes('title') || input.includes('heading')) {
        // Add a larger, centered title
        const title = new Textbox('Your Title Here', {
          left: canvas.width! / 2 - 150,
          top: 50,
          width: 300,
          fontSize: 32,
          fill: '#333333',
          fontFamily: 'Arial',
          fontWeight: 'bold',
          textAlign: 'center',
          editable: true,
        });
        canvas.add(title);
        canvas.setActiveObject(title);
      } else {
        addText();
      }
    }
    // Shape commands
    else if (input.includes('circle') || input.includes('round')) {
      addCircle();
    } 
    else if (input.includes('rectangle') || input.includes('box') || input.includes('square')) {
      addRectangle();
    }
    else if (input.includes('triangle')) {
      addTriangle();
    }
    else if (input.includes('line')) {
      addLine();
    }
    // Icon commands with better detection
    else if (input.includes('icon')) {
      if (input.includes('business') || input.includes('briefcase')) {
        addIcon(Briefcase, 'Briefcase');
      } else if (input.includes('target') || input.includes('goal')) {
        addIcon(Target, 'Target');
      } else if (input.includes('chart') || input.includes('graph')) {
        addIcon(BarChart, 'Bar Chart');
      } else if (input.includes('mail') || input.includes('email')) {
        addIcon(Mail, 'Mail');
      } else if (input.includes('phone')) {
        addIcon(Phone, 'Phone');
      } else if (input.includes('user') || input.includes('people')) {
        addIcon(Users, 'Users');
      } else if (input.includes('heart')) {
        addIcon(Heart, 'Heart');
      } else if (input.includes('star')) {
        addIcon(Star, 'Star');
      } else {
        // Default to star icon
        addIcon(Star, 'Star');
      }
    }
    // Background color changes
    else if (input.includes('background')) {
      let color = '#ffffff'; // default
      if (input.includes('blue')) color = '#e3f2fd';
      else if (input.includes('red')) color = '#ffebee';
      else if (input.includes('green')) color = '#e8f5e8';
      else if (input.includes('yellow')) color = '#fffde7';
      else if (input.includes('purple')) color = '#f3e5f5';
      else if (input.includes('orange')) color = '#fff3e0';
      else if (input.includes('gray') || input.includes('grey')) color = '#f5f5f5';
      else if (input.includes('black')) color = '#000000';
      
      canvas.backgroundColor = color;
    }
    // Element modifications
    else if (selectedObject) {
      // Color changes for selected object
      if (input.includes('color') || input.includes('blue') || input.includes('red') || input.includes('green')) {
        let color = '#333333'; // default
        if (input.includes('blue')) color = '#1976d2';
        else if (input.includes('red')) color = '#d32f2f';
        else if (input.includes('green')) color = '#388e3c';
        else if (input.includes('yellow')) color = '#f57c00';
        else if (input.includes('purple')) color = '#7b1fa2';
        else if (input.includes('orange')) color = '#f57c00';
        else if (input.includes('black')) color = '#000000';
        else if (input.includes('white')) color = '#ffffff';
        
        selectedObject.set('fill', color);
      }
      // Size changes
      else if (input.includes('larger') || input.includes('bigger')) {
        const currentScale = selectedObject.scaleX || 1;
        selectedObject.set({ scaleX: currentScale * 1.2, scaleY: currentScale * 1.2 });
      }
      else if (input.includes('smaller')) {
        const currentScale = selectedObject.scaleX || 1;
        selectedObject.set({ scaleX: currentScale * 0.8, scaleY: currentScale * 0.8 });
      }
      // Alignment
      else if (input.includes('center')) {
        selectedObject.set({
          left: canvas.width! / 2 - (selectedObject.width! * (selectedObject.scaleX || 1)) / 2,
          top: canvas.height! / 2 - (selectedObject.height! * (selectedObject.scaleY || 1)) / 2
        });
      }
      // Delete
      else if (input.includes('delete') || input.includes('remove')) {
        canvas.remove(selectedObject);
        setSelectedObject(null);
      }
    }
    
    canvas.renderAll();
  };

  // Zoom functions - scale the canvas dimensions themselves
  const updateCanvasSize = useCallback((zoom: number) => {
    if (!canvas || !containerRef.current) return;
    
    const containerRect = containerRef.current.getBoundingClientRect();
    const aspectRatio = 16 / 9;
    const padding = 60;
    
    // Calculate base canvas size
    let baseCanvasWidth = Math.min(containerRect.width - padding, CANVAS_WIDTH);
    let baseCanvasHeight = baseCanvasWidth / aspectRatio;
    
    if (baseCanvasHeight > containerRect.height - padding) {
      baseCanvasHeight = containerRect.height - padding;
      baseCanvasWidth = baseCanvasHeight * aspectRatio;
    }
    
    // Apply zoom to canvas dimensions
    const scaledWidth = baseCanvasWidth * zoom;
    const scaledHeight = baseCanvasHeight * zoom;
    
    canvas.setDimensions({
      width: scaledWidth,
      height: scaledHeight
    });
    
    // Reset zoom on canvas (since we're scaling dimensions instead)
    canvas.setZoom(1);
    canvas.renderAll();
  }, [canvas]);

  // Update refs when values change
  React.useEffect(() => {
    zoomLevelRef.current = zoomLevel;
    updateCanvasSizeRef.current = updateCanvasSize;
  }, [zoomLevel, updateCanvasSize]);

  // Touch gesture handling
  React.useEffect(() => {
    if (!canvas || !containerRef.current) return;

    const getDistance = (touches: TouchList) => {
      if (touches.length < 2) return 0;
      const touch1 = touches[0];
      const touch2 = touches[1];
      return Math.sqrt(
        Math.pow(touch2.clientX - touch1.clientX, 2) + 
        Math.pow(touch2.clientY - touch1.clientY, 2)
      );
    };

    let touchDistance = 0;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        touchDistance = getDistance(e.touches);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const distance = getDistance(e.touches);
        
        if (touchDistance > 0) {
          const scale = distance / touchDistance;
          const currentZoom = zoomLevelRef.current;
          const newZoom = Math.min(Math.max(currentZoom * scale, 0.3), 3);
          
          if (Math.abs(newZoom - currentZoom) > 0.01) {
            setZoomLevel(newZoom);
            if (updateCanvasSizeRef.current) {
              updateCanvasSizeRef.current(newZoom);
            }
          }
        }
        
        touchDistance = distance;
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) {
        touchDistance = 0;
      }
    };

    const containerElement = containerRef.current;
    containerElement.addEventListener('touchstart', handleTouchStart, { passive: false });
    containerElement.addEventListener('touchmove', handleTouchMove, { passive: false });
    containerElement.addEventListener('touchend', handleTouchEnd, { passive: false });

    return () => {
      containerElement.removeEventListener('touchstart', handleTouchStart);
      containerElement.removeEventListener('touchmove', handleTouchMove);
      containerElement.removeEventListener('touchend', handleTouchEnd);
    };
  }, [canvas]);

  const zoomIn = () => {
    if (!canvas) return;
    const newZoom = Math.min(zoomLevel * 1.2, 3);
    setZoomLevel(newZoom);
    updateCanvasSize(newZoom);
  };

  const zoomOut = () => {
    if (!canvas) return;
    const newZoom = Math.max(zoomLevel / 1.2, 0.3);
    setZoomLevel(newZoom);
    updateCanvasSize(newZoom);
  };

  const resetZoom = () => {
    if (!canvas) return;
    setZoomLevel(1);
    updateCanvasSize(1);
  };

  // Preview as PptxGenJS JSON
  const updatePreview = () => {
    if (!canvas) return;
    const slideJson = convertFabricToSlideJson(canvas);
    setPreviewJson(slideJson);
    setShowPreview(true);
  };

  // Save template to Supabase
  const saveTemplate = async () => {
    if (!canvas) return;
    
    setIsSaving(true);
    try {
      const formats = exportCanvasFormats(canvas);
      const supabase = createClient();
      
      const templateData = {
        name: templateName,
        description: templateDescription,
        theme: 'Custom',
        fabric_json: formats.fabricJson,
        slide_json: formats.pptxJson,
        preview_image: formats.previewImage,
        is_active: true,
        updated_at: new Date().toISOString(),
      };

      if (templateId) {
        // Update existing template
        const { error } = await supabase
          .from('slide_templates')
          .update(templateData)
          .eq('id', templateId);
          
        if (!error) {
          alert('Template updated successfully!');
        }
      } else {
        // Create new template
        const { data, error } = await supabase
          .from('slide_templates')
          .insert({
            ...templateData,
            created_at: new Date().toISOString(),
          })
          .select()
          .single();
          
        if (!error && data) {
          alert('Template saved successfully!');
          router.push('/template-editor?id=' + data.id);
        }
      }
    } catch (error) {
      console.error('Save error:', error);
      alert('Failed to save template');
    } finally {
      setIsSaving(false);
    }
  };

  // Export to PPTX
  const exportToPPTX = async () => {
    if (!canvas) return;
    
    const slideJson = convertFabricToSlideJson(canvas);
    
    // Load PptxGenJS dynamically
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/pptxgenjs@4.0.1/dist/pptxgen.min.js';
    document.head.appendChild(script);
    
    script.onload = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const PptxGenJS = (window as typeof window & { PptxGenJS?: any }).PptxGenJS;
      if (!PptxGenJS) return;
      
      const pptx = new PptxGenJS();
      pptx.layout = 'LAYOUT_16x9';
      pptx.author = 'Template Editor';
      pptx.title = templateName;
      
      const slide = pptx.addSlide();
      
      // Set background
      if (slideJson.background?.color) {
        slide.background = { color: slideJson.background.color };
      }
      
      // Add objects
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      slideJson.objects.forEach((obj: { type: string; text?: string; shape?: string; options: any }) => {
        if (obj.type === 'text') {
          slide.addText(obj.text, obj.options);
        } else if (obj.type === 'shape') {
          slide.addShape(obj.shape, obj.options);
        }
      });
      
      pptx.writeFile({ fileName: templateName + '.pptx' });
    };
  };

  return (
    <div className="min-h-screen builder-background">
      {/* Mobile menu button */}
      <div className="fixed top-4 left-4 z-50 md:hidden">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          <Menu className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex h-screen">
        {/* Left Sidebar using existing Sidebar component */}
        <Sidebar
          user={user}
          collapsed={sidebarCollapsed}
          onCollapsedChange={setSidebarCollapsed}
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
        />

        {/* Main Content Area */}
        <div className={cn(
          "transition-all duration-300 h-screen flex flex-col",
          sidebarCollapsed ? "md:ml-16" : "md:ml-60",
          rightSidebarCollapsed ? "lg:mr-16 lg:ml-72" : "lg:mr-80 lg:ml-72"
        )}>
          {/* Header */}
          <div className="flex-shrink-0 p-4 sm:p-6 border-b border-border">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Input
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  className="text-xl font-bold border-none bg-transparent p-0 h-auto focus-visible:ring-0"
                  placeholder="Template Name"
                />
                <Input
                  value={templateDescription}
                  onChange={(e) => setTemplateDescription(e.target.value)}
                  className="text-sm text-muted-foreground border-none bg-transparent p-0 h-auto focus-visible:ring-0"
                  placeholder="Template Description"
                />
              </div>
              <div className="flex gap-2 items-center">
                {/* Zoom Controls */}
                <div className="flex items-center gap-1 border rounded-lg p-1">
                  <Button variant="ghost" size="sm" onClick={zoomOut} className="h-8 w-8 p-0">
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={resetZoom} className="h-8 w-8 p-0" title="Reset Zoom">
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={zoomIn} className="h-8 w-8 p-0">
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                  <span className="text-xs text-muted-foreground px-2 min-w-[3rem] text-center">
                    {Math.round(zoomLevel * 100)}%
                  </span>
                  {zoomLevel > 1 && (
                    <span className="text-xs text-muted-foreground px-2 border-l">
                      Hold Shift + drag to pan
                    </span>
                  )}
                </div>
                
                <div className="h-4 w-px bg-border" />
                
                <Button variant="outline" size="sm" onClick={updatePreview}>
                  <Eye className="h-4 w-4 mr-2" />
                  Preview JSON
                </Button>
                <Button variant="outline" size="sm" onClick={exportToPPTX}>
                  <Download className="h-4 w-4 mr-2" />
                  Export PPTX
                </Button>
                <Button size="sm" onClick={saveTemplate} disabled={isSaving}>
                  <Save className="h-4 w-4 mr-2" />
                  {isSaving ? 'Saving...' : 'Save Template'}
                </Button>
              </div>
            </div>
          </div>

          {/* Canvas Area - Takes remaining height */}
          <div className="flex-1 overflow-hidden">
            <div className="h-full flex flex-col">
              {/* Canvas */}
              <div className="flex-1 min-h-0 relative">
                <div 
                  ref={containerRef}
                  className={cn(
                    "absolute inset-0 flex items-center justify-center p-4",
                    isPanning && "cursor-grabbing"
                  )}
                >
                  <div className="relative flex items-center justify-center">
                    <canvas 
                      ref={canvasRef} 
                      className={cn(
                        "shadow-lg rounded-lg border border-border/20",
                        zoomLevel > 1 && !isPanning && "cursor-grab"
                      )} 
                    />
                  </div>
                </div>
              </div>

              {/* Preview JSON - Fixed height overlay when shown */}
              {showPreview && previewJson && (
                <Card className="mt-4 max-h-80 flex-shrink-0">
                  <CardHeader className="p-3">
                    <CardTitle className="flex items-center justify-between text-sm">
                      PptxGenJS JSON Preview
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowPreview(false)}
                      >
                        <EyeOff className="h-4 w-4" />
                      </Button>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 pt-0">
                    <pre className="bg-gray-100 p-3 rounded-lg overflow-auto max-h-60 text-xs">
                      {JSON.stringify(previewJson, null, 2)}
                    </pre>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>

        {/* Right Sidebar - Tools */}
        <div className={cn(
          "hidden lg:block fixed right-0 top-0 z-30 h-screen transform bg-background border-l border-border transition-all duration-300",
          rightSidebarCollapsed ? "w-16" : "w-80"
        )}>
          {/* Toggle Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setRightSidebarCollapsed(!rightSidebarCollapsed)}
            className={cn(
              "absolute z-10 h-8 w-8 p-0",
              rightSidebarCollapsed ? "left-2 top-4" : "left-2 top-4"
            )}
          >
            {rightSidebarCollapsed ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
          
          {/* Mode Toggle Buttons - Only show when expanded */}
          {!rightSidebarCollapsed && (
            <div className="absolute top-0 left-0 right-0 z-10 bg-background border-b">
              <div className="flex w-full p-2 gap-1">
                <Button
                  variant={rightSidebarMode === 'editor' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setRightSidebarMode('editor')}
                  className="flex-1 h-9 justify-center"
                >
                  <Type className="h-4 w-4 mr-2" />
                  <span className="text-sm font-medium">Editor</span>
                </Button>
                <Button
                  variant={rightSidebarMode === 'ai' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setRightSidebarMode('ai')}
                  className="flex-1 h-9 justify-center"
                >
                  <div className="h-4 w-4 mr-2 rounded-full bg-gradient-to-br from-purple-400 via-purple-500 to-indigo-600 flex items-center justify-center shadow-lg">
                    <Sparkles className="h-2.5 w-2.5 text-white drop-shadow-sm" />
                  </div>
                  <span className="text-sm font-medium">AI Builder</span>
                </Button>
              </div>
            </div>
          )}
          
          {/* Collapsed Icons */}
          {rightSidebarCollapsed && (
            <div className="flex flex-col items-center pt-16 space-y-3">
              <Button variant="ghost" size="sm" onClick={addText} className="h-10 w-10 p-0" title="Add Text">
                <Type className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={addRectangle} className="h-10 w-10 p-0" title="Add Rectangle">
                <Square className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={addCircle} className="h-10 w-10 p-0" title="Add Circle">
                <CircleIcon className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={addLine} className="h-10 w-10 p-0" title="Add Line">
                <Minus className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={addTriangle} className="h-10 w-10 p-0" title="Add Triangle">
                <TriangleIcon className="h-4 w-4" />
              </Button>
              {selectedObject && (
                <>
                  <div className="w-8 h-px bg-border my-2" />
                  <Button variant="ghost" size="sm" onClick={duplicateSelected} className="h-10 w-10 p-0" title="Duplicate">
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={deleteSelected} className="h-10 w-10 p-0" title="Delete">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          )}
          
          {/* Expanded Content */}
          <div className={cn(
            "h-full overflow-y-auto",
            rightSidebarCollapsed && "hidden"
          )}>
            {rightSidebarMode === 'editor' ? (
              /* Editor Mode */
              <div className="p-4 space-y-4 sm:space-y-6 pt-16">
              {/* Add Elements */}
              <Card variant="glass" className="card-contrast">
                <CardHeader className="p-3 sm:p-4">
                  <CardTitle className="flex items-center gap-2 text-lg sm:text-xl font-semibold tracking-tight">
                    <Type className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                    Elements
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3 pt-0 sm:p-4 sm:pt-0 space-y-3">
                  {/* Text */}
                  <div>
                    <Label className="text-xs text-muted-foreground mb-2 block">Text</Label>
                    <Button 
                      variant="outline" 
                      onClick={addText}
                      className="w-full justify-start gap-2 h-10 hover:bg-accent transition-colors"
                    >
                      <Type className="h-4 w-4" />
                      Add Text
                    </Button>
                  </div>
                  
                  {/* Basic Shapes */}
                  <div>
                    <Label className="text-xs text-muted-foreground mb-2 block">Basic Shapes</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Button 
                        variant="outline" 
                        onClick={addRectangle}
                        className="h-10 flex flex-col items-center justify-center gap-1 hover:bg-accent transition-colors"
                        title="Rectangle"
                      >
                        <Square className="h-4 w-4" />
                        <span className="text-xs">Rectangle</span>
                      </Button>
                      <Button 
                        variant="outline" 
                        onClick={addCircle}
                        className="h-10 flex flex-col items-center justify-center gap-1 hover:bg-accent transition-colors"
                        title="Circle"
                      >
                        <CircleIcon className="h-4 w-4" />
                        <span className="text-xs">Circle</span>
                      </Button>
                      <Button 
                        variant="outline" 
                        onClick={addTriangle}
                        className="h-10 flex flex-col items-center justify-center gap-1 hover:bg-accent transition-colors"
                        title="Triangle"
                      >
                        <TriangleIcon className="h-4 w-4" />
                        <span className="text-xs">Triangle</span>
                      </Button>
                      <Button 
                        variant="outline" 
                        onClick={addLine}
                        className="h-10 flex flex-col items-center justify-center gap-1 hover:bg-accent transition-colors"
                        title="Line"
                      >
                        <Minus className="h-4 w-4" />
                        <span className="text-xs">Line</span>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Object Actions */}
              {selectedObject && (
                <Card variant="glass">
                  <CardHeader className="p-3 sm:p-4">
                    <CardTitle className="text-base sm:text-lg font-semibold tracking-tight">
                      Object Actions
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 pt-0 sm:p-4 sm:pt-0">
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={duplicateSelected}>
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={deleteSelected}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Text Formatting - Always Visible */}
              <Card variant="glass">
                <CardHeader className="p-3 sm:p-4">
                  <CardTitle className="text-base sm:text-lg font-semibold tracking-tight">
                    Text Formatting
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3 pt-0 sm:p-4 sm:pt-0 space-y-3">
                  {/* Font Family */}
                  <div>
                    <Label className="text-xs text-muted-foreground mb-2 block">Font Family</Label>
                    <Select 
                      value={selectedObject?.type === 'textbox' ? selectedObject.fontFamily || 'Arial' : 'Arial'}
                      onValueChange={setFontFamily}
                      disabled={!selectedObject || selectedObject.type !== 'textbox'}
                    >
                      <SelectTrigger className={cn(
                        "w-full text-sm",
                        (!selectedObject || selectedObject.type !== 'textbox') && "opacity-50 cursor-not-allowed"
                      )}>
                        <SelectValue placeholder="Select font" />
                      </SelectTrigger>
                      <SelectContent>
                        {fontFamilies.map((font) => (
                          <SelectItem key={font.value} value={font.value} style={{ fontFamily: font.value }}>
                            {font.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {/* Font Styling */}
                  <div className="flex gap-1">
                    <Button
                      variant={selectedObject?.type === 'textbox' && selectedObject.fontWeight === 'bold' ? 'default' : 'outline'}
                      size="sm"
                      onClick={toggleBold}
                      disabled={!selectedObject || selectedObject.type !== 'textbox'}
                      className={cn(
                        !selectedObject || selectedObject.type !== 'textbox' && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      <Bold className="h-4 w-4" />
                    </Button>
                    <Button
                      variant={selectedObject?.type === 'textbox' && selectedObject.fontStyle === 'italic' ? 'default' : 'outline'}
                      size="sm"
                      onClick={toggleItalic}
                      disabled={!selectedObject || selectedObject.type !== 'textbox'}
                      className={cn(
                        !selectedObject || selectedObject.type !== 'textbox' && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      <Italic className="h-4 w-4" />
                    </Button>
                    <Button
                      variant={selectedObject?.type === 'textbox' && selectedObject.underline ? 'default' : 'outline'}
                      size="sm"
                      onClick={toggleUnderline}
                      disabled={!selectedObject || selectedObject.type !== 'textbox'}
                      className={cn(
                        !selectedObject || selectedObject.type !== 'textbox' && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      <Underline className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant={selectedObject?.type === 'textbox' && selectedObject.textAlign === 'left' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setTextAlign('left')}
                      disabled={!selectedObject || selectedObject.type !== 'textbox'}
                      className={cn(
                        !selectedObject || selectedObject.type !== 'textbox' && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      <AlignLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant={selectedObject?.type === 'textbox' && selectedObject.textAlign === 'center' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setTextAlign('center')}
                      disabled={!selectedObject || selectedObject.type !== 'textbox'}
                      className={cn(
                        !selectedObject || selectedObject.type !== 'textbox' && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      <AlignCenter className="h-4 w-4" />
                    </Button>
                    <Button
                      variant={selectedObject?.type === 'textbox' && selectedObject.textAlign === 'right' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setTextAlign('right')}
                      disabled={!selectedObject || selectedObject.type !== 'textbox'}
                      className={cn(
                        !selectedObject || selectedObject.type !== 'textbox' && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      <AlignRight className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Icon Library */}
              <Card variant="glass">
                <CardHeader className="p-3 sm:p-4">
                  <CardTitle className="text-base sm:text-lg font-semibold tracking-tight">
                    Icon Library
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3 pt-0 sm:p-4 sm:pt-0 space-y-3">
                  {/* Category Tabs */}
                  <div className="flex flex-wrap gap-1">
                    {Object.keys(iconLibrary).map((category) => (
                      <Button
                        key={category}
                        variant={selectedIconCategory === category ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setSelectedIconCategory(category)}
                        className="text-xs px-2 py-1 h-auto"
                      >
                        {category.charAt(0).toUpperCase() + category.slice(1)}
                      </Button>
                    ))}
                  </div>
                  
                  {/* Icon Grid */}
                  <div className="grid grid-cols-3 gap-2">
                    {iconLibrary[selectedIconCategory as keyof typeof iconLibrary]?.map((iconItem, index) => {
                      const IconComponent = iconItem.icon;
                      return (
                        <Button
                          key={index}
                          variant="outline"
                          size="sm"
                          onClick={() => addIcon(IconComponent, iconItem.name)}
                          className="h-16 w-full flex flex-col items-center justify-center gap-1 p-2 hover:bg-accent transition-colors"
                          title={iconItem.name}
                        >
                          <IconComponent className="h-5 w-5 flex-shrink-0" />
                          <span className="text-[9px] text-muted-foreground truncate w-full text-center leading-tight">
                            {iconItem.name.split(' ')[0]}
                          </span>
                        </Button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Media Upload */}
              <Card variant="glass">
                <CardHeader className="p-3 sm:p-4">
                  <CardTitle className="flex items-center gap-2 text-base sm:text-lg font-semibold tracking-tight">
                    <ImageIcon className="h-4 w-4 text-primary" />
                    Media
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3 pt-0 sm:p-4 sm:pt-0">
                  {/* File Upload Dropzone */}
                  <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-4 text-center hover:border-muted-foreground/50 transition-colors">
                    <div className="flex flex-col items-center gap-2">
                      <Upload className="h-8 w-8 text-muted-foreground" />
                      <div className="text-sm text-muted-foreground">
                        <span className="font-medium">Drop images here</span> or{' '}
                        <label className="text-primary cursor-pointer hover:underline">
                          browse
                          <input
                            type="file"
                            className="hidden"
                            accept="image/*"
                            multiple
                            onChange={(e) => {
                              // Handle file upload - placeholder for now
                              console.log('Files selected:', e.target.files);
                            }}
                          />
                        </label>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        PNG, JPG, SVG up to 10MB
                      </p>
                    </div>
                  </div>
                  
                  {/* Placeholder for uploaded images */}
                  <div className="mt-3 text-xs text-muted-foreground text-center">
                    No images uploaded yet
                  </div>
                </CardContent>
              </Card>

              {/* Properties */}
              {selectedObject && (
                <Card variant="glass">
                  <CardHeader className="p-3 sm:p-4">
                    <CardTitle className="text-base sm:text-lg font-semibold tracking-tight">
                      Properties
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 pt-0 sm:p-4 sm:pt-0 space-y-3">
                    {/* Fill Color */}
                    <div>
                      <Label className="text-xs">Fill Color</Label>
                      <div className="flex gap-2">
                        <Input
                          type="color"
                          value={selectedObject.fill || '#000000'}
                          onChange={(e) => updateSelectedProperty('fill', e.target.value)}
                          className="w-12 h-8 p-1"
                        />
                        <Input
                          value={selectedObject.fill || '#000000'}
                          onChange={(e) => updateSelectedProperty('fill', e.target.value)}
                          className="flex-1"
                        />
                      </div>
                    </div>

                    {/* Stroke Color */}
                    {selectedObject.stroke !== undefined && (
                      <div>
                        <Label className="text-xs">Stroke Color</Label>
                        <div className="flex gap-2">
                          <Input
                            type="color"
                            value={selectedObject.stroke || '#000000'}
                            onChange={(e) => updateSelectedProperty('stroke', e.target.value)}
                            className="w-12 h-8 p-1"
                          />
                          <Input
                            value={selectedObject.stroke || '#000000'}
                            onChange={(e) => updateSelectedProperty('stroke', e.target.value)}
                            className="flex-1"
                          />
                        </div>
                      </div>
                    )}

                    {/* Font Size for Text */}
                    {selectedObject.type === 'textbox' && (
                      <div>
                        <Label className="text-xs">Font Size: {selectedObject.fontSize}px</Label>
                        <Slider
                          value={[selectedObject.fontSize || 18]}
                          onValueChange={(value) => updateSelectedProperty('fontSize', value[0])}
                          min={8}
                          max={72}
                          step={1}
                        />
                      </div>
                    )}

                    {/* Opacity */}
                    <div>
                      <Label className="text-xs">Opacity: {Math.round((selectedObject.opacity || 1) * 100)}%</Label>
                      <Slider
                        value={[(selectedObject.opacity || 1) * 100]}
                        onValueChange={(value) => updateSelectedProperty('opacity', value[0] / 100)}
                        min={0}
                        max={100}
                        step={5}
                      />
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
            ) : (
              /* AI Builder Mode */
              <div className="h-full flex flex-col pt-16">
                {/* Chat Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {chatMessages.map((message) => (
                    <div
                      key={message.id}
                      className={cn(
                        "flex",
                        message.role === 'user' ? 'justify-end' : 'justify-start'
                      )}
                    >
                      <div
                        className={cn(
                          "max-w-[85%] rounded-lg px-3 py-2 text-sm",
                          message.role === 'user' 
                            ? 'bg-primary text-primary-foreground' 
                            : 'bg-muted text-muted-foreground'
                        )}
                      >
                        <div className="flex items-start gap-2">
                          {message.role === 'assistant' && (
                            <div className="h-4 w-4 mt-0.5 flex-shrink-0 rounded-full bg-gradient-to-br from-purple-400 via-purple-500 to-indigo-600 flex items-center justify-center shadow-sm">
                              <Bot className="h-2.5 w-2.5 text-white drop-shadow-sm" />
                            </div>
                          )}
                          <div className="flex-1">
                            {message.content}
                          </div>
                        </div>
                        <div className="text-xs opacity-70 mt-1">
                          {message.timestamp.toLocaleTimeString([], { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {/* Empty state */}
                  {chatMessages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-center p-6">
                      <div className="h-12 w-12 mb-4 rounded-full bg-gradient-to-br from-purple-400 via-purple-500 to-indigo-600 flex items-center justify-center shadow-lg">
                        <Bot className="h-7 w-7 text-white drop-shadow-sm" />
                      </div>
                      <h3 className="text-lg font-medium text-muted-foreground mb-2">
                        AI Design Assistant
                      </h3>
                      <p className="text-sm text-muted-foreground/70 mb-6 max-w-xs">
                        Ask me to help you design your slide. I can add elements, change colors, adjust layouts, and more.
                      </p>
                      
                      {/* Quick suggestions */}
                      <div className="space-y-2 w-full max-w-xs">
                        <p className="text-xs text-muted-foreground/60 mb-3">Try asking:</p>
                        {[
                          "Add a title and subtitle",
                          "Change the background to blue",
                          "Add some bullet points",
                          "Make the text larger and centered"
                        ].map((suggestion, index) => (
                          <Button
                            key={index}
                            variant="outline"
                            size="sm"
                            className="w-full text-left text-xs h-auto py-2 px-3 whitespace-normal"
                            onClick={() => handleSendMessage(suggestion)}
                          >
                            "{suggestion}"
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Chat Input */}
                <div className="border-t p-4">
                  <form onSubmit={handleChatSubmit} className="space-y-3">
                    <div className="flex gap-2">
                      <Input
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        placeholder="Describe what you want to add or change..."
                        className="flex-1"
                        disabled={isAiThinking}
                      />
                      <Button type="submit" disabled={!chatInput.trim() || isAiThinking}>
                        {isAiThinking ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    
                    {/* Quick actions */}
                    <div className="flex flex-wrap gap-1">
                      {[
                        "Add text",
                        "Change colors",
                        "Add shapes",
                        "Adjust layout"
                      ].map((action) => (
                        <Button
                          key={action}
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs"
                          onClick={() => setChatInput(action)}
                          disabled={isAiThinking}
                        >
                          {action}
                        </Button>
                      ))}
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TemplateEditor() {
  return (
    <Suspense fallback={<div className="min-h-screen builder-background" />}> 
      <TemplateEditorInner />
    </Suspense>
  );
}