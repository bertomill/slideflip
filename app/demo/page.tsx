"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Navigation, NavigationBrand, NavigationMenu, NavigationItem } from "@/components/ui/navigation";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Zap, Rocket, Star, ArrowRight } from "lucide-react";

export default function DemoPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Premium Navigation */}
      <Navigation variant="premium">
        <NavigationBrand>
          <div className="h-6 w-6 bg-foreground rounded-sm flex items-center justify-center">
            <div className="h-3 w-3 bg-background rounded-sm"></div>
          </div>
          <span className="font-semibold text-foreground">
            SlideFlip
          </span>
        </NavigationBrand>
        <div className="flex items-center gap-6">
          <NavigationMenu>
            <NavigationItem href="#" active>Home</NavigationItem>
            <NavigationItem href="#">Features</NavigationItem>
            <NavigationItem href="#">Pricing</NavigationItem>
            <NavigationItem href="#">About</NavigationItem>
          </NavigationMenu>
          <ThemeToggle />
        </div>
      </Navigation>

      <div className="container mx-auto px-4 py-12 space-y-12">
        {/* Hero Section */}
        <section className="text-center space-y-6">
          <Badge variant="secondary" className="mb-4">
            <Star className="h-3 w-3 mr-1" />
            Premium Components
          </Badge>
          <h1 className="text-4xl md:text-6xl font-bold text-foreground">
            Engineering Simplicity
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Where practicality meets artistry. Clean, purposeful design that gets out of your way.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button variant="engineering" size="lg">
              <Rocket className="h-4 w-4 mr-2" />
              Get Started
            </Button>
            <Button variant="outline" size="lg">
              Learn More
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </section>

        {/* Component Showcase */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Premium Buttons */}
          <Card variant="elevated">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-primary" />
                Premium Buttons
              </CardTitle>
              <CardDescription>
                Buttons with world-class animations and effects
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button variant="engineering" className="w-full">
                Engineering Button
              </Button>
              <Button variant="default" className="w-full">
                Default Button
              </Button>
              <Button variant="secondary" className="w-full">
                Secondary Button
              </Button>
              <Button variant="outline" className="w-full">
                Outline Button
              </Button>
            </CardContent>
          </Card>

          {/* Premium Inputs */}
          <Card variant="glass">
            <CardHeader>
              <CardTitle>Premium Inputs</CardTitle>
              <CardDescription>
                Sophisticated form controls with smooth interactions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input placeholder="Default input" />
              <Input placeholder="Focused input (try clicking)" />
              <Input placeholder="Another input example" />
            </CardContent>
          </Card>

          {/* Card Variants */}
          <Card variant="premium">
            <CardHeader>
              <CardTitle>Card Variants</CardTitle>
              <CardDescription>
                Multiple card styles for different use cases
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 border border-primary/20">
                  <p className="text-sm font-medium">Premium Card</p>
                  <p className="text-xs text-muted-foreground">With gradient background</p>
                </div>
                <div className="p-3 rounded-lg glass">
                  <p className="text-sm font-medium">Glass Card</p>
                  <p className="text-xs text-muted-foreground">With blur effect</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Feature Grid */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <Card variant="elevated" className="p-8">
            <div className="space-y-4">
              <div className="h-12 w-12 rounded-lg bg-foreground flex items-center justify-center">
                <Sparkles className="h-6 w-6 text-background" />
              </div>
              <h3 className="text-xl font-semibold">Purposeful Interactions</h3>
              <p className="text-muted-foreground">
                Every animation serves a purpose. Clean, fast, and precisely engineered.
              </p>
              <Button variant="outline" size="sm">
                Explore Animations
                <ArrowRight className="h-3 w-3 ml-2" />
              </Button>
            </div>
          </Card>

          <Card variant="glass" className="p-8">
            <div className="space-y-4">
              <div className="h-12 w-12 rounded-lg bg-foreground flex items-center justify-center">
                <Zap className="h-6 w-6 text-background" />
              </div>
              <h3 className="text-xl font-semibold">Extreme Simplicity</h3>
              <p className="text-muted-foreground">
                No unnecessary elements. Every pixel has a purpose. Form follows function.
              </p>
              <Button variant="ghost" size="sm">
                See Glass Effects
                <ArrowRight className="h-3 w-3 ml-2" />
              </Button>
            </div>
          </Card>
        </section>

        {/* CTA Section */}
        <section className="text-center space-y-6 py-12">
          <h2 className="text-3xl font-bold">Ready to build something amazing?</h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            Start creating with our premium component library inspired by the best design systems.
          </p>
          <Button variant="engineering" size="xl">
            <Rocket className="h-5 w-5 mr-2" />
            Start Building Now
          </Button>
        </section>
      </div>
    </div>
  );
}