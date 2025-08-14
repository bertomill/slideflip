// components/flows-list.tsx
// Component to display and manage user flows

"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  FileText, 
  Calendar, 
  Clock, 
  Download, 
  Edit, 
  Archive,
  Play,
  AlertCircle 
} from 'lucide-react';
import { FlowRecord } from '@/lib/flows-db';

interface FlowsListProps {
  className?: string;
  showActions?: boolean;
  limit?: number;
}

export function FlowsList({ className = '', showActions = true, limit }: FlowsListProps) {
  const [flows, setFlows] = useState<FlowRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load flows
  useEffect(() => {
    const loadFlows = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const params = new URLSearchParams();
        if (limit) params.set('limit', limit.toString());

        const response = await fetch(`/api/flows?${params}`);
        if (!response.ok) {
          throw new Error('Failed to load flows');
        }

        const data = await response.json();
        setFlows(data.flows || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    };

    loadFlows();
  }, [limit]);

  // Get progress percentage
  const getProgressPercentage = (flow: FlowRecord): number => {
    if (flow.status === 'completed') return 100;
    
    const stepPercentages = { 1: 25, 2: 50, 3: 75, 4: 100 };
    return stepPercentages[flow.current_step as keyof typeof stepPercentages] || 0;
  };

  // Get status color
  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'completed': return 'bg-green-500';
      case 'in_progress': return 'bg-blue-500';
      case 'draft': return 'bg-yellow-500';
      case 'archived': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  // Continue editing a flow
  const continueFlow = (flowId: string) => {
    window.location.href = `/build?flow_id=${flowId}`;
  };

  // Archive a flow
  const archiveFlow = async (flowId: string) => {
    try {
      const response = await fetch(`/api/flows/${flowId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setFlows(flows.filter(f => f.id !== flowId));
      }
    } catch (error) {
      console.error('Error archiving flow:', error);
    }
  };

  if (isLoading) {
    return (
      <div className={`space-y-4 ${className}`}>
        {[1, 2, 3].map(i => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4">
              <div className="h-4 bg-muted rounded mb-2" />
              <div className="h-3 bg-muted rounded w-2/3 mb-3" />
              <div className="h-2 bg-muted rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="p-4 text-center">
          <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
          <p className="text-red-600">Failed to load flows: {error}</p>
        </CardContent>
      </Card>
    );
  }

  if (flows.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="p-6 text-center">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground mb-3">No flows found</p>
          <Button onClick={() => window.location.href = '/build'}>
            Create Your First Flow
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {flows.map((flow) => (
        <Card key={flow.id} className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <CardTitle className="text-lg line-clamp-1">
                  {flow.title || flow.description}
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                  {flow.title ? flow.description : 'No additional description'}
                </p>
              </div>
              
              <div className="flex items-center gap-2 ml-4">
                <Badge 
                  variant="secondary" 
                  className={`${getStatusColor(flow.status)} text-white`}
                >
                  {flow.status.charAt(0).toUpperCase() + flow.status.slice(1)}
                </Badge>
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-0">
            {/* Progress Bar */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground">
                  Step {flow.current_step} of 4
                </span>
                <span className="text-xs text-muted-foreground">
                  {getProgressPercentage(flow)}%
                </span>
              </div>
              <Progress value={getProgressPercentage(flow)} className="h-2" />
            </div>

            {/* Metadata */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-muted-foreground mb-4">
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                <span>Created {new Date(flow.created_at).toLocaleDateString()}</span>
              </div>
              
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span>Updated {new Date(flow.updated_at).toLocaleDateString()}</span>
              </div>

              <div className="flex items-center gap-1">
                <FileText className="h-3 w-3" />
                <span>{flow.documents?.length || 0} documents</span>
              </div>

              {flow.slide_generated_at && (
                <div className="flex items-center gap-1">
                  <Download className="h-3 w-3" />
                  <span>Generated</span>
                </div>
              )}
            </div>

            {/* Step Details */}
            <div className="text-xs text-muted-foreground mb-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div className={`p-2 rounded ${flow.current_step >= 1 ? 'bg-green-50 text-green-700' : 'bg-muted'}`}>
                  Upload {flow.current_step >= 1 && '✓'}
                </div>
                <div className={`p-2 rounded ${flow.current_step >= 2 ? 'bg-green-50 text-green-700' : 'bg-muted'}`}>
                  Research {flow.current_step >= 2 && '✓'}
                </div>
                <div className={`p-2 rounded ${flow.current_step >= 3 ? 'bg-green-50 text-green-700' : 'bg-muted'}`}>
                  Theme {flow.current_step >= 3 && '✓'}
                </div>
                <div className={`p-2 rounded ${flow.current_step >= 4 ? 'bg-green-50 text-green-700' : 'bg-muted'}`}>
                  Preview {flow.current_step >= 4 && '✓'}
                </div>
              </div>
            </div>

            {/* Actions */}
            {showActions && (
              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    onClick={() => continueFlow(flow.id)}
                    className="flex items-center gap-1"
                  >
                    {flow.status === 'completed' ? (
                      <>
                        <Edit className="h-3 w-3" />
                        Edit
                      </>
                    ) : (
                      <>
                        <Play className="h-3 w-3" />
                        Continue
                      </>
                    )}
                  </Button>
                  
                  {flow.status === 'completed' && flow.slide_json && (
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => {
                        // TODO: Implement direct download
                        window.location.href = `/build?flow_id=${flow.id}`;
                      }}
                    >
                      <Download className="h-3 w-3 mr-1" />
                      Export
                    </Button>
                  )}
                </div>

                <Button 
                  size="sm" 
                  variant="ghost"
                  onClick={() => archiveFlow(flow.id)}
                  className="text-red-600 hover:text-red-700"
                >
                  <Archive className="h-3 w-3" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// Compact version for dashboard/sidebar
export function FlowsListCompact({ limit = 5, className = '' }: { limit?: number; className?: string }) {
  return (
    <FlowsList 
      className={className}
      showActions={false}
      limit={limit}
    />
  );
}