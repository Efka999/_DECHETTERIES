import React from 'react';
import { Alert, AlertDescription } from './ui/alert';
import { CheckCircle2, XCircle, Info, AlertTriangle } from 'lucide-react';

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
    <Alert variant={type}>
      <Icon className="h-4 w-4" />
      <AlertDescription>
        {message}
      </AlertDescription>
    </Alert>
  );
};

export default StatusMessage;
