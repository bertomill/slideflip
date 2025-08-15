"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft, 
  Edit2, 
  Share2, 
  Download, 
  Trash2, 
  Calendar,
  Clock,
  FileText,
  Eye
} from "lucide-react";
import Link from "next/link";

interface Presentation {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  status: string;
  slideHtml?: string | null;
  slides?: any[];
}

export default function PresentationPage() {
  const params = useParams();
  const router = useRouter();
  const [presentation, setPresentation] = useState<Presentation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.push("/auth/login");
      } else {
        setUser(user);
      }
    });
  }, [router]);

  useEffect(() => {
    const loadPresentation = async () => {
      if (!params.id || !user) return;

      try {
        setLoading(true);
        const response = await fetch(`/api/presentations/${params.id}`);
        
        if (!response.ok) {
          if (response.status === 404) {
            setError("Presentation not found");
          } else {
            setError("Failed to load presentation");
          }
          return;
        }

        const data = await response.json();
        setPresentation(data);
      } catch (err) {
        console.error("Error loading presentation:", err);
        setError("An error occurred while loading the presentation");
      } finally {
        setLoading(false);
      }
    };

    loadPresentation();
  }, [params.id, user]);

  const handleDelete = async () => {
    if (!presentation || !confirm("Are you sure you want to delete this presentation?")) return;

    try {
      const response = await fetch(`/api/presentations/${presentation.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        router.push("/presentations");
      } else {
        alert("Failed to delete presentation");
      }
    } catch (err) {
      console.error("Error deleting presentation:", err);
      alert("An error occurred while deleting the presentation");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading presentation...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6">
            <div className="text-center">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">{error}</h2>
              <p className="text-muted-foreground mb-4">
                The presentation you're looking for doesn't exist or you don't have access to it.
              </p>
              <Link href="/presentations">
                <Button>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Presentations
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!presentation) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <Link href="/presentations">
              <Button variant="ghost">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Presentations
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm">
                <Share2 className="h-4 w-4 mr-2" />
                Share
              </Button>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              <Link href={`/build?presentation=${presentation.id}`}>
                <Button size="sm">
                  <Edit2 className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              </Link>
              <Button variant="destructive" size="sm" onClick={handleDelete}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">
              {presentation.title}
            </h1>
            {presentation.description && (
              <p className="text-muted-foreground mb-4">
                {presentation.description}
              </p>
            )}
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                <span>Created {new Date(presentation.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                <span>Updated {new Date(presentation.updatedAt).toLocaleDateString()}</span>
              </div>
              <Badge variant={presentation.status === 'completed' ? 'default' : 'secondary'}>
                {presentation.status}
              </Badge>
            </div>
          </div>
        </div>

        {/* Presentation Content */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Presentation Preview
            </CardTitle>
          </CardHeader>
          <CardContent>
            {presentation.slideHtml ? (
              <div className="aspect-[16/9] bg-white rounded-lg overflow-hidden shadow-inner">
                <div
                  dangerouslySetInnerHTML={{ __html: presentation.slideHtml }}
                  className="w-full h-full"
                />
              </div>
            ) : presentation.slides && presentation.slides.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {presentation.slides.map((slide: any, index: number) => (
                  <div key={index} className="aspect-[16/9] bg-muted rounded-lg flex items-center justify-center">
                    <span className="text-muted-foreground">Slide {index + 1}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="aspect-[16/9] bg-muted rounded-lg flex items-center justify-center">
                <div className="text-center">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground">No slides available</p>
                  <Link href={`/build?presentation=${presentation.id}`}>
                    <Button className="mt-4">
                      <Edit2 className="h-4 w-4 mr-2" />
                      Start Editing
                    </Button>
                  </Link>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}