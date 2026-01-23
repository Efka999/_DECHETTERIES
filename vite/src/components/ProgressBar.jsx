import React from 'react';
import { Progress } from './ui/progress';
import { CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '../lib/utils';

const ProgressBar = ({ progress, message, isComplete, isError }) => {
  if (!message && !isComplete && !isError && progress === null) {
    return null;
  }

  return (
    <div className="w-full space-y-4">
      {message && (
        <div className={cn(
          "flex items-center gap-2 text-sm",
          isError && "text-destructive",
          isComplete && "text-green-600 dark:text-green-400",
          !isError && !isComplete && "text-foreground"
        )}>
          {isComplete && <CheckCircle2 className="w-4 h-4" />}
          {isError && <AlertCircle className="w-4 h-4" />}
          {!isComplete && !isError && <Loader2 className="w-4 h-4 animate-spin" />}
          <span>{message}</span>
        </div>
      )}
      {!isComplete && !isError && progress !== null && (
        <div className="space-y-2">
          <Progress value={progress} className="h-2" />
          <div className="flex justify-between items-center text-xs text-muted-foreground">
            <span>Traitement en cours...</span>
            <span>{progress}%</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProgressBar;
