"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { 
  Upload, 
  FileUp, 
  Cloud, 
  ImageIcon, 
  Database, 
  CheckCircle2, 
  Loader2,
  Sparkles,
  ArrowRight,
  X
} from "lucide-react";

interface UploadStep {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
  status: 'waiting' | 'processing' | 'completed' | 'error';
}

interface UploadProgressShelfProps {
  isOpen: boolean;
  fileName?: string;
  currentStep?: string;
  error?: string;
  onClose?: () => void;
}

export function UploadProgressShelf({ 
  isOpen, 
  fileName = "document.pptx",
  currentStep = 'upload',
  error,
  onClose 
}: UploadProgressShelfProps) {
  const [steps, setSteps] = useState<UploadStep[]>([
    {
      id: 'upload',
      label: 'Uploading File',
      description: 'Sending your PowerPoint to our servers',
      icon: FileUp,
      status: 'waiting'
    },
    {
      id: 'convert',
      label: 'Analyzing Content',
      description: 'Extracting schema, colors, fonts, and layout',
      icon: Cloud,
      status: 'waiting'
    },
    {
      id: 'process',
      label: 'Processing Design',
      description: 'Capturing slide structure and styling',
      icon: ImageIcon,
      status: 'waiting'
    },
    {
      id: 'save',
      label: 'Saving Template',
      description: 'Adding to your template collection',
      icon: Database,
      status: 'waiting'
    }
  ]);

  // Update step statuses based on current step
  useEffect(() => {
    const stepOrder = ['upload', 'convert', 'process', 'save'];
    const currentIndex = stepOrder.indexOf(currentStep);
    
    setSteps(prevSteps => 
      prevSteps.map((step, index) => {
        const stepIndex = stepOrder.indexOf(step.id);
        if (stepIndex < currentIndex) {
          return { ...step, status: 'completed' };
        } else if (stepIndex === currentIndex) {
          return { ...step, status: error ? 'error' : 'processing' };
        } else {
          return { ...step, status: 'waiting' };
        }
      })
    );
  }, [currentStep, error]);

  const shelfVariants = {
    hidden: { 
      x: 400, 
      opacity: 0,
      scale: 0.95
    },
    visible: { 
      x: 0, 
      opacity: 1,
      scale: 1,
      transition: {
        type: "spring",
        stiffness: 300,
        damping: 30,
        staggerChildren: 0.1
      }
    },
    exit: { 
      x: 400, 
      opacity: 0,
      scale: 0.95,
      transition: {
        duration: 0.3
      }
    }
  };

  const stepVariants = {
    hidden: { 
      opacity: 0, 
      x: -20 
    },
    visible: { 
      opacity: 1, 
      x: 0,
      transition: {
        type: "spring",
        stiffness: 500,
        damping: 30
      }
    }
  };

  const iconVariants = {
    waiting: { scale: 1, rotate: 0 },
    processing: { 
      scale: [1, 1.1, 1],
      rotate: [0, 180, 360],
      transition: {
        duration: 2,
        repeat: Infinity,
        ease: "linear"
      }
    },
    completed: { 
      scale: [0.8, 1.2, 1],
      transition: {
        duration: 0.3
      }
    },
    error: {
      scale: 1,
      x: [0, -10, 10, -10, 10, 0],
      transition: {
        duration: 0.5
      }
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          variants={shelfVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="fixed bottom-6 right-6 z-50 w-96"
        >
          <div className="bg-background/95 backdrop-blur-lg border border-border rounded-2xl shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-4 border-b border-border">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold flex items-center gap-2">
                        <Upload className="h-4 w-4" />
                        Importing
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1 truncate">
                        {fileName}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 ml-2">
                      {currentStep === 'save' && steps[3].status === 'completed' && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="flex items-center gap-1 text-green-600 dark:text-green-400"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          <span className="text-xs font-medium">Done!</span>
                        </motion.div>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={onClose}
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Progress Steps */}
                <div className="p-4">
                  <div className="space-y-3">
                    {steps.map((step, index) => {
                      const Icon = step.icon;
                      const isActive = step.status === 'processing';
                      const isCompleted = step.status === 'completed';
                      const isError = step.status === 'error';
                      
                      return (
                        <motion.div
                          key={step.id}
                          variants={stepVariants}
                          className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                            isActive ? 'bg-primary/10 border border-primary/20' : 
                            isCompleted ? 'bg-green-500/10 border border-green-500/20' :
                            isError ? 'bg-red-500/10 border border-red-500/20' :
                            'bg-muted/30 border border-transparent'
                          }`}
                        >
                          {/* Icon */}
                          <div className="relative">
                            <motion.div
                              variants={iconVariants}
                              animate={step.status}
                              className={`h-10 w-10 rounded-full flex items-center justify-center ${
                                isActive ? 'bg-primary text-primary-foreground' :
                                isCompleted ? 'bg-green-500 text-white' :
                                isError ? 'bg-red-500 text-white' :
                                'bg-muted text-muted-foreground'
                              }`}
                            >
                              {isCompleted ? (
                                <CheckCircle2 className="h-5 w-5" />
                              ) : isActive ? (
                                <Loader2 className="h-5 w-5 animate-spin" />
                              ) : (
                                <Icon className="h-5 w-5" />
                              )}
                            </motion.div>
                            
                            {/* Connecting line */}
                            {index < steps.length - 1 && (
                              <div className={`absolute top-10 left-5 w-0.5 h-8 -translate-x-1/2 ${
                                isCompleted ? 'bg-green-500' : 'bg-border'
                              }`} />
                            )}
                          </div>

                          {/* Content */}
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className={`font-medium ${
                                isActive ? 'text-foreground' : 
                                isCompleted ? 'text-green-600 dark:text-green-400' :
                                isError ? 'text-red-600 dark:text-red-400' :
                                'text-muted-foreground'
                              }`}>
                                {step.label}
                              </span>
                              {isActive && (
                                <motion.div
                                  animate={{ opacity: [0.5, 1, 0.5] }}
                                  transition={{ duration: 1.5, repeat: Infinity }}
                                  className="flex gap-1"
                                >
                                  <span className="h-1 w-1 bg-primary rounded-full" />
                                  <span className="h-1 w-1 bg-primary rounded-full" />
                                  <span className="h-1 w-1 bg-primary rounded-full" />
                                </motion.div>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {error && isError ? error : step.description}
                            </p>
                          </div>

                          {/* Status indicator */}
                          {isActive && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0 }}
                              animate={{ opacity: 1, scale: 1 }}
                              className="flex items-center gap-1 text-primary"
                            >
                              <Sparkles className="h-4 w-4" />
                              <span className="text-xs font-medium">Processing</span>
                            </motion.div>
                          )}
                          
                          {isCompleted && (
                            <motion.div
                              initial={{ opacity: 0, x: 20 }}
                              animate={{ opacity: 1, x: 0 }}
                              className="text-green-500"
                            >
                              <ArrowRight className="h-4 w-4" />
                            </motion.div>
                          )}
                        </motion.div>
                      );
                    })}
                  </div>

                  {/* Final success message */}
                  {currentStep === 'save' && steps[3].status === 'completed' && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                      className="mt-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 bg-green-500 rounded-full flex items-center justify-center">
                          <CheckCircle2 className="h-6 w-6 text-white" />
                        </div>
                        <div>
                          <p className="font-medium text-green-600 dark:text-green-400">
                            Template imported successfully!
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Your PowerPoint has been added to your template collection.
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </div>
              </div>
          </motion.div>
      )}
    </AnimatePresence>
  );
}