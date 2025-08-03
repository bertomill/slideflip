import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Calendar, MoreVertical } from "lucide-react";

export default async function ProjectsPage() {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) {
    redirect("/auth/login");
  }

  // TODO: Replace with actual project data from database
  const mockProjects = [
    {
      id: 1,
      title: "Marketing Presentation Q4",
      description: "Quarterly marketing review and strategy presentation",
      createdAt: "2024-01-15",
      status: "completed",
      slideCount: 24
    },
    {
      id: 2,
      title: "Product Launch Deck",
      description: "New product launch presentation for stakeholders",
      createdAt: "2024-01-10",
      status: "draft",
      slideCount: 18
    },
    {
      id: 3,
      title: "Team Training Materials",
      description: "Onboarding and training slides for new team members",
      createdAt: "2024-01-05",
      status: "completed",
      slideCount: 32
    }
  ];

  return (
    <div className="flex-1 w-full flex flex-col gap-8 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">My Projects</h1>
          <p className="text-muted-foreground mt-2">
            Manage and view all your presentation projects
          </p>
        </div>
        <Button>
          <FileText className="h-4 w-4 mr-2" />
          New Project
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {mockProjects.map((project) => (
          <Card key={project.id} className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg font-semibold line-clamp-2">
                    {project.title}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                    {project.description}
                  </p>
                </div>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <FileText className="h-4 w-4" />
                    <span>{project.slideCount} slides</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    <span>{new Date(project.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
                <Badge 
                  variant={project.status === 'completed' ? 'default' : 'secondary'}
                  className="capitalize"
                >
                  {project.status}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {mockProjects.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <FileText className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">No projects yet</h3>
          <p className="text-muted-foreground mb-4">
            Create your first presentation project to get started
          </p>
          <Button>
            <FileText className="h-4 w-4 mr-2" />
            Create Project
          </Button>
        </div>
      )}
    </div>
  );
}