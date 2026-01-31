import React, { useEffect, useState } from 'react';
import ProgressBar from '../components/ProgressBar';
import StatusMessage from '../components/StatusMessage';
import GlobalHeader from '../components/GlobalHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import {
  checkStatus,
  importDumpFile,
  getDumpStatus,
  getDumpAvailableYears,
  listOutputFiles,
  downloadOutputFile,
  listInputFiles,
  uploadInputFile
} from '../services/api';
import { RefreshCw, Database, Download, Upload } from 'lucide-react';

function ImportPage() {
  const [serverStatus, setServerStatus] = useState('checking');
  const [availableYears, setAvailableYears] = useState([]);
  const [dumpYear, setDumpYear] = useState(2025);
  const [dumpStatus, setDumpStatus] = useState(null);
  const [dumpLoading, setDumpLoading] = useState(false);
  const [dumpMessage, setDumpMessage] = useState(null);
  const [dumpType, setDumpType] = useState('info');
  
  // File management states
  const [outputFiles, setOutputFiles] = useState([]);
  const [inputFiles, setInputFiles] = useState([]);
  const [fileLoading, setFileLoading] = useState(false);
  const [fileMessage, setFileMessage] = useState(null);
  const [fileType, setFileType] = useState('info');
  const fileInputRef = React.useRef(null);

  useEffect(() => {
    const verifyServer = async () => {
      try {
        await checkStatus();
        setServerStatus('online');
      } catch (error) {
        setServerStatus('offline');
      }
    };

    verifyServer();
  }, []);

  useEffect(() => {
    const loadYears = async () => {
      try {
        const result = await getDumpAvailableYears();
        if (result?.success) {
          const years = result.years || [];
          setAvailableYears(years);
          if (years.length > 0 && !years.includes(dumpYear)) {
            setDumpYear(years[years.length - 1]);
          }
        }
      } catch (err) {
        // ignore
      }
    };
    loadYears();
  }, []);

  useEffect(() => {
    const loadDumpStatus = async () => {
      try {
        const result = await getDumpStatus(dumpYear);
        if (result?.success) {
          setDumpStatus(result);
        }
      } catch (error) {
        // Ignore errors
      }
    };
    if (serverStatus === 'online') {
      loadDumpStatus();
    }
  }, [dumpYear, serverStatus]);

  // Load file lists when page loads
  useEffect(() => {
    const loadFiles = async () => {
      if (serverStatus === 'offline') return;
      try {
        const output = await listOutputFiles();
        if (output?.success) setOutputFiles(output.files || []);
        
        const input = await listInputFiles();
        if (input?.success) setInputFiles(input.files || []);
      } catch (error) {
        // Ignore errors silently
      }
    };
    
    loadFiles();
  }, [serverStatus]);

  const handleDumpImport = async (force = false) => {
    setDumpLoading(true);
    setDumpMessage('Import du dump en cours...');
    setDumpType('info');
    try {
      const result = await importDumpFile(null, dumpYear, force);
      if (result?.success) {
        setDumpMessage(`Import réussi: ${result.rows} lignes importées.`);
        setDumpType('success');
        // Reload status
        const statusResult = await getDumpStatus(dumpYear);
        if (statusResult?.success) {
          setDumpStatus(statusResult);
        }
      } else {
        throw new Error(result?.message || 'Erreur lors de l\'import');
      }
    } catch (error) {
      setDumpMessage(error.message || 'Erreur lors de l\'import du dump');
      setDumpType('error');
    } finally {
      setDumpLoading(false);
    }
  };

  const handleDownloadOutputFile = async (filename) => {
    setFileLoading(true);
    try {
      await downloadOutputFile(filename);
      setFileMessage(`Fichier ${filename} téléchargé avec succès`);
      setFileType('success');
    } catch (error) {
      setFileMessage(error.message || 'Erreur lors du téléchargement');
      setFileType('error');
    } finally {
      setFileLoading(false);
    }
  };

  const handleUploadInputFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    setFileLoading(true);
    try {
      const result = await uploadInputFile(file);
      if (result?.success) {
        setFileMessage(`Fichier ${result.filename} uploadé avec succès`);
        setFileType('success');
        
        // Reload file list
        const input = await listInputFiles();
        if (input?.success) setInputFiles(input.files || []);
      } else {
        throw new Error(result?.error || 'Erreur lors de l\'upload');
      }
    } catch (error) {
      setFileMessage(error.message || 'Erreur lors de l\'upload');
      setFileType('error');
    } finally {
      setFileLoading(false);
      // Reset file input
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <GlobalHeader />
      {serverStatus !== 'online' && (
        <div className="sticky top-[64px] z-[45] w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="max-w-full mx-auto p-4 md:p-6 px-4 md:px-6">
            <StatusMessage
              type={serverStatus === 'offline' ? 'error' : 'info'}
              message={
                serverStatus === 'offline'
                  ? "Le serveur backend n'est pas accessible. Veuillez le démarrer avec 'npm run dev:full' dans le dossier vite/."
                  : 'Vérification de la connexion au serveur...'
              }
            />
          </div>
        </div>
      )}
      <div className="max-w-full mx-auto min-h-[calc(100vh-2rem)] flex flex-col p-3 md:p-4">
        <header className="text-center mb-8">
          <div className="mb-2 flex justify-center">
            <img
              src="/logo-emmaus-environnement.webp"
              alt="Emmaüs Environnement"
              className="h-8 w-auto md:h-10 opacity-80"
            />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold mb-2">Import</h1>
          <p className="text-muted-foreground">
            Importez les données du dump dans la base de données et consultez les statistiques.
          </p>
        </header>

        <main className="flex-1 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Import Dump</CardTitle>
              <CardDescription>
                Importez le fichier de dump complet (2025_Analyse Catégories.xlsx) dans la base de données dump.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                {availableYears.length > 0 && (
                  <select
                    value={dumpYear}
                    onChange={(event) => setDumpYear(Number(event.target.value))}
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm"
                  >
                    {availableYears.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                )}
                <Button
                  onClick={() => handleDumpImport(false)}
                  disabled={dumpLoading || serverStatus === 'offline'}
                  className="bg-brand text-brand-foreground hover:bg-brand/90"
                >
                  <Database className="mr-2 h-4 w-4" />
                  Importer le dump
                </Button>
                <Button
                  onClick={() => handleDumpImport(true)}
                  disabled={dumpLoading || serverStatus === 'offline'}
                  variant="outline"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Réimporter
                </Button>
              </div>

              {dumpStatus && (
                <div className="text-sm text-muted-foreground">
                  {dumpStatus.rows} lignes · {dumpStatus.files} fichiers
                  {dumpStatus.last_import?.filename && ` · Dernier import: ${dumpStatus.last_import.filename}`}
                </div>
              )}

              {dumpMessage && (
                <StatusMessage
                  type={dumpType}
                  message={dumpMessage}
                  onClose={() => setDumpMessage(null)}
                />
              )}

              {dumpLoading && (
                <ProgressBar
                  progress={null}
                  message="Import du dump en cours..."
                  isComplete={false}
                  isError={false}
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Fichiers d'Export</CardTitle>
              <CardDescription>
                Téléchargez les fichiers Excel générés dans le dossier output.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {outputFiles.length > 0 ? (
                <div className="space-y-2">
                  {outputFiles.map((file) => (
                    <div key={file.name} className="flex items-center justify-between rounded-md border p-3">
                      <div className="flex-1">
                        <p className="text-sm font-medium">{file.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {(file.size / 1024).toFixed(2)} KB · {new Date(file.modified * 1000).toLocaleDateString()}
                        </p>
                      </div>
                      <Button
                        onClick={() => handleDownloadOutputFile(file.name)}
                        disabled={fileLoading || serverStatus === 'offline'}
                        size="sm"
                        variant="outline"
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Télécharger
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Aucun fichier d'export disponible</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Fichiers d'Entrée</CardTitle>
              <CardDescription>
                Uploadez des fichiers Excel d'entrée dans le dossier input.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleUploadInputFile}
                  disabled={fileLoading || serverStatus === 'offline'}
                  className="hidden"
                />
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={fileLoading || serverStatus === 'offline'}
                  variant="outline"
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Uploader un fichier
                </Button>
              </div>

              {inputFiles.length > 0 ? (
                <div className="space-y-2">
                  {inputFiles.map((file) => (
                    <div key={file.name} className="flex items-center justify-between rounded-md border p-3">
                      <div className="flex-1">
                        <p className="text-sm font-medium">{file.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {(file.size / 1024).toFixed(2)} KB · {new Date(file.modified * 1000).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Aucun fichier d'entrée</p>
              )}

              {fileMessage && (
                <StatusMessage
                  type={fileType}
                  message={fileMessage}
                  onClose={() => setFileMessage(null)}
                />
              )}
            </CardContent>
          </Card>
        </main>

        <footer className="mt-8 text-sm text-muted-foreground">
          <div className="flex items-center justify-center gap-2 text-center">
            <img
              src="/logo.svg"
              alt="Emmaüs Environnement"
              className="h-6 w-auto opacity-80"
            />
            <p>© Christophe GUY 2026</p>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default ImportPage;
