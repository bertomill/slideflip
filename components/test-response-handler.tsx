"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Download, Eye } from "lucide-react";
import { SlideData } from "@/app/builder/page";

interface TestResponseHandlerProps {
  slideData: SlideData;
  updateSlideData: (updates: Partial<SlideData>) => void;
}

export function TestResponseHandler({ slideData, updateSlideData }: TestResponseHandlerProps) {
  const [isSimulating, setIsSimulating] = useState(false);

  const simulateBackendResponse = async () => {
    setIsSimulating(true);
    
    // Simulate backend processing time
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Simulate slide generation started
    updateSlideData({ 
      isGenerating: true, 
      generationError: undefined,
      generationStatus: "Starting slide generation process..."
    });
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Simulate processing status
    updateSlideData({ 
      generationStatus: "Analyzing uploaded files and generating slide content..."
    });
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Simulate completion with both HTML and PPT file
    const mockHtml = `
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px; color: white; font-family: Arial, sans-serif;">
        <h1 style="font-size: 48px; margin-bottom: 20px; text-align: center;">Generated Presentation</h1>
        <div style="background: rgba(255,255,255,0.1); padding: 30px; border-radius: 10px;">
          <h2 style="font-size: 32px; margin-bottom: 15px;">Quarterly Sales Results</h2>
          <ul style="font-size: 18px; line-height: 1.6;">
            <li>Revenue increased by 15% compared to last quarter</li>
            <li>New product line contributed 25% of total sales</li>
            <li>Customer satisfaction score reached 4.8/5.0</li>
            <li>Market share expanded to 12.5%</li>
          </ul>
        </div>
      </div>
    `;
    
    const mockPptPath = "output/slide_20240101_120000_quarterly_sales.pptx";
    
    updateSlideData({
      slideHtml: mockHtml,
      pptFilePath: mockPptPath,
      isGenerating: false,
      generationError: undefined,
      generationStatus: undefined
    });
    
    setIsSimulating(false);
  };

  const resetData = () => {
    updateSlideData({
      slideHtml: undefined,
      pptFilePath: undefined,
      isGenerating: false,
      generationError: undefined,
      generationStatus: undefined
    });
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Eye className="h-5 w-5 text-primary" />
          Test Backend Response Handler
        </CardTitle>
        <CardDescription>
          Simulate backend responses to test frontend handling
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Status */}
        <div className="p-4 rounded-lg border">
          <h3 className="font-medium mb-2">Current Status:</h3>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span>HTML Content:</span>
              {slideData.slideHtml ? (
                <Badge variant="secondary" className="bg-green-100 text-green-800">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Available
                </Badge>
              ) : (
                <Badge variant="secondary">Not Available</Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span>PPT File:</span>
              {slideData.pptFilePath ? (
                <Badge variant="secondary" className="bg-green-100 text-green-800">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Available
                </Badge>
              ) : (
                <Badge variant="secondary">Not Available</Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span>Generation Status:</span>
              {slideData.isGenerating ? (
                <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                  In Progress
                </Badge>
              ) : (
                <Badge variant="secondary">Idle</Badge>
              )}
            </div>
            {slideData.generationStatus && (
              <div className="text-xs text-muted-foreground">
                Status: {slideData.generationStatus}
              </div>
            )}
          </div>
        </div>

        {/* Test Controls */}
        <div className="flex gap-2">
          <Button 
            onClick={simulateBackendResponse}
            disabled={isSimulating}
            className="flex-1"
          >
            {isSimulating ? (
              <>
                <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full mr-2" />
                Simulating...
              </>
            ) : (
              <>
                <Eye className="h-4 w-4 mr-2" />
                Simulate Response
              </>
            )}
          </Button>
          <Button 
            variant="outline" 
            onClick={resetData}
            disabled={isSimulating}
          >
            Reset
          </Button>
        </div>

        {/* Preview */}
        {slideData.slideHtml && (
          <div className="border rounded-lg overflow-hidden">
            <div className="p-3 bg-muted border-b">
              <h3 className="font-medium">HTML Preview:</h3>
            </div>
            <div 
              dangerouslySetInnerHTML={{ __html: slideData.slideHtml }}
              className="transform scale-50 origin-top-left"
              style={{ width: '200%', height: '200%' }}
            />
          </div>
        )}

        {/* Download Test */}
        {slideData.pptFilePath && (
          <div className="p-4 rounded-lg bg-muted/30 border">
            <h3 className="font-medium mb-2">Download Test:</h3>
            <div className="flex items-center gap-2">
              <span className="text-sm">File: {slideData.pptFilePath}</span>
              <Button size="sm" variant="outline">
                <Download className="h-3 w-3 mr-1" />
                Test Download
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
} 