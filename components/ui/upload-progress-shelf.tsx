"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Upload, 
  FileUp, 
  Cloud, 
  ImageIcon, 
  Database, 
  CheckCircle2, 
  Loader2,
  Sparkles,
  ArrowRight
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
      label: 'Converting to PNG',
      description: 'Using CloudConvert for perfect reproduction',
      icon: Cloud,
      status: 'waiting'
    },
    {
      id: 'process',
      label: 'Processing Image',
      description: 'Creating high-quality slide preview',
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
      y: 100, 
      opacity: 0,
      scale: 0.95
    },
    visible: { 
      y: 0, 
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
      y: 100, 
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
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          {/* Progress Shelf */}
          <motion.div
            variants={shelfVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed bottom-0 left-0 right-0 z-50 p-6"
          >
            <div className="max-w-3xl mx-auto">
              <div className="bg-background/95 backdrop-blur-lg border border-border rounded-2xl shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6 border-b border-border">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold flex items-center gap-2">
                        <Upload className="h-5 w-5" />
                        Importing PowerPoint
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {fileName}
                      </p>
                    </div>
                    {currentStep === 'save' && steps[3].status === 'completed' && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="flex items-center gap-2 text-green-600 dark:text-green-400"
                      >
                        <CheckCircle2 className="h-5 w-5" />
                        <span className="text-sm font-medium">Complete!</span>
                      </motion.div>
                    )}
                  </div>
                </div>

                {/* Progress Steps */}
                <div className="p-6">
                  <div className="space-y-4">
                    {steps.map((step, index) => {
                      const Icon = step.icon;
                      const isActive = step.status === 'processing';
                      const isCompleted = step.status === 'completed';
                      const isError = step.status === 'error';
                      
                      return (
                        <motion.div
                          key={step.id}
                          variants={stepVariants}
                          className={`flex items-center gap-4 p-4 rounded-lg transition-colors ${
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
                      className="mt-6 p-4 bg-green-500/10 border border-green-500/20 rounded-lg"
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
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}