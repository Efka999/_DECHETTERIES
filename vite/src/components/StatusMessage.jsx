import React from 'react';
import { Alert, AlertDescription } from './ui/alert';
import { CheckCircle2, XCircle, Info, AlertTriangle, X } from 'lucide-react';
import { Button } from './ui/button';
import { cn } from '../lib/utils';

const StatusMessage = ({ type, message, onClose }) => {
  if (!message) return null;

  const icons = {
    success: CheckCircle2,
    error: XCircle,
    info: Info,
    warning: AlertTriangle
  };

  const Icon = icons[type] || Info;

  return (
    <Alert variant={type} className="relative">
      <Icon className="h-4 w-4" />
      <AlertDescription className="pr-8">
        {message}
      </AlertDescription>
      {onClose && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-2 top-2 h-6 w-6"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </Alert>
  );
};

export default StatusMessage;
