import React, { useRef, useState } from 'react';
import { Button } from './ui/button';
import { Upload, File, X } from 'lucide-react';
import { cn } from '../lib/utils';

const FileSelector = ({ onFileSelect, disabled }) => {
  const fileInputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      setSelectedFile(file);
      onFileSelect(file);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);

    if (disabled) return;

    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
      setSelectedFile(file);
      onFileSelect(file);
    }
  };

  const handleClick = () => {
    if (!disabled) {
      fileInputRef.current?.click();
    }
  };

  const handleRemove = (e) => {
    e.stopPropagation();
    setSelectedFile(null);
    onFileSelect(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="w-full">
      <div
        className={cn(
          "relative border-2 border-dashed rounded-lg p-8 transition-all cursor-pointer",
          "hover:border-primary/50 hover:bg-accent/50",
          isDragging && "border-primary bg-primary/5",
          disabled && "opacity-50 cursor-not-allowed pointer-events-none",
          selectedFile && "border-primary/50 bg-primary/5"
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          onChange={handleFileChange}
          disabled={disabled}
          className="hidden"
        />
        
        {selectedFile ? (
          <div className="flex flex-col items-center justify-center space-y-4">
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-primary/10">
              <File className="w-8 h-8 text-primary" />
            </div>
            <div className="text-center space-y-1">
              <p className="text-sm font-medium text-foreground">{selectedFile.name}</p>
              <p className="text-xs text-muted-foreground">
                {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
                disabled={disabled}
              >
                Changer de fichier
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleRemove}
                disabled={disabled}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center space-y-4">
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-muted">
              <Upload className="w-8 h-8 text-muted-foreground" />
            </div>
            <div className="text-center space-y-1">
              <p className="text-sm font-medium text-foreground">
                Glissez-déposez votre fichier Excel ici
              </p>
              <p className="text-xs text-muted-foreground">
                ou cliquez pour sélectionner
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              Formats acceptés : .xlsx, .xls
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default FileSelector;
