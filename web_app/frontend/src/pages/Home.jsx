import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import FileSelector from '../components/FileSelector';
import ProgressBar from '../components/ProgressBar';
import StatusMessage from '../components/StatusMessage';
import GlobalHeader from '../components/GlobalHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { checkStatus, transformFile, downloadFile } from '../services/api';
import { RefreshCw, BarChart3, Download } from 'lucide-react';

function Home() {
  const navigate = useNavigate();
  const [selectedFile, setSelectedFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(null);
  const [statusMessage, setStatusMessage] = useState(null);
  const [statusType, setStatusType] = useState('info');
  const [serverStatus, setServerStatus] = useState('checking');
  const [outputFilename, setOutputFilename] = useState(null);

  // Vérifier le statut du serveur au démarrage
  useEffect(() => {
    const verifyServer = async () => {
      try {
        await checkStatus();
        setServerStatus('online');
        setStatusMessage('Serveur connecté');
        setStatusType('success');
        setTimeout(() => setStatusMessage(null), 3000);
      } catch (error) {
        setServerStatus('offline');
        setStatusMessage('Le serveur ne répond pas. Vérifiez qu\'il est démarré.');
        setStatusType('error');
      }
    };

    verifyServer();
  }, []);

  const handleFileSelect = (file) => {
    setSelectedFile(file);
    setStatusMessage(null);
    setProgress(null);
  };

  const handleTransform = async () => {
    if (!selectedFile) {
      setStatusMessage('Veuillez sélectionner un fichier');
      setStatusType('warning');
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    setStatusMessage('Traitement en cours...');
    setStatusType('info');

    let progressInterval = null;

    try {
      // Simuler une progression (le backend ne fournit pas de progression réelle)
      progressInterval = setInterval(() => {
        setProgress((prev) => {
          if (prev === null) return 10;
          if (prev >= 90) return prev;
          return prev + 10;
        });
      }, 500);

      const result = await transformFile(selectedFile);

      if (progressInterval) {
        clearInterval(progressInterval);
      }
      setProgress(100);

      if (result.success) {
        setStatusMessage('Transformation réussie ! Le fichier a été sauvegardé dans le dossier output/');
        setStatusType('success');

        // Sauvegarder le nom du fichier de sortie pour les stats et le téléchargement
        const statsFilename = result.output_relative_path || result.output_path || result.output_filename;
        setOutputFilename(statsFilename);
        try {
          localStorage.setItem('last_output_filename', statsFilename);
        } catch (storageError) {
          // Ignore storage failures (private mode, etc.)
        }
      } else {
        throw new Error(result.message || 'Erreur lors de la transformation');
      }
    } catch (error) {
      if (progressInterval) {
        clearInterval(progressInterval);
      }
      setProgress(null);
      setStatusMessage(error.message || 'Une erreur s\'est produite');
      setStatusType('error');
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <GlobalHeader />
      <div className="max-w-4xl mx-auto min-h-[calc(100vh-2rem)] flex flex-col p-4 md:p-8">
        <header className="text-center mb-8">
          <div className="mb-2 flex justify-center">
            <img
              src="/logo-emmaus-environnement.webp"
              alt="Emmaüs Environnement"
              className="h-8 w-auto md:h-10 opacity-80"
            />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold mb-2">
            GDR DUMP BETA
          </h1>
        </header>

        <main className="flex-1 space-y-6">
          {serverStatus === 'offline' && (
            <StatusMessage
              type="error"
              message="Le serveur backend n'est pas accessible. Veuillez le démarrer avec le launcher."
            />
          )}

          <Card>
            <CardHeader>
              <CardTitle>Fichier d'entrée</CardTitle>
              <CardDescription>
                Sélectionnez ou glissez-déposez votre fichier Excel (.xlsx, .xls)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FileSelector
                onFileSelect={handleFileSelect}
                disabled={isProcessing}
              />
            </CardContent>
          </Card>

          {selectedFile && (
            <Card>
              <CardHeader>
                <CardTitle>Transformation</CardTitle>
                <CardDescription>
                  Lancez la transformation de votre fichier
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ProgressBar
                  progress={progress}
                  message={statusMessage}
                  isComplete={progress === 100 && statusType === 'success'}
                  isError={statusType === 'error'}
                />

                {!isProcessing && progress !== 100 && (
                  <Button
                    onClick={handleTransform}
                    disabled={!selectedFile || serverStatus === 'offline'}
                    size="lg"
                    className="w-full"
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Lancer la Transformation
                  </Button>
                )}

                {progress === 100 && statusType === 'success' && outputFilename && (
                  <div className="flex gap-2">
                    <Button
                      onClick={() => {
                        const filename = outputFilename.includes('/')
                          ? outputFilename.split('/').pop()
                          : outputFilename;
                        downloadFile(filename, outputFilename);
                      }}
                      variant="outline"
                      size="lg"
                      className="flex-1"
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Télécharger le Fichier
                    </Button>
                    <Button
                      onClick={() => navigate('/stats', { state: { outputFilename } })}
                      variant="outline"
                      size="lg"
                      className="flex-1"
                    >
                      <BarChart3 className="mr-2 h-4 w-4" />
                      Voir les Statistiques
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {statusMessage && statusType !== 'info' && (
            <StatusMessage
              type={statusType}
              message={statusMessage}
              onClose={() => setStatusMessage(null)}
            />
          )}
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

export default Home;
