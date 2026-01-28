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
  getDumpAvailableYears
} from '../services/api';
import { RefreshCw, Database } from 'lucide-react';

function ImportPage() {
  const [serverStatus, setServerStatus] = useState('checking');
  const [availableYears, setAvailableYears] = useState([]);
  const [dumpYear, setDumpYear] = useState(2025);
  const [dumpStatus, setDumpStatus] = useState(null);
  const [dumpLoading, setDumpLoading] = useState(false);
  const [dumpMessage, setDumpMessage] = useState(null);
  const [dumpType, setDumpType] = useState('info');

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

  return (
    <div className="min-h-screen bg-background text-foreground">
      <GlobalHeader />
      {serverStatus !== 'online' && (
        <div className="sticky top-[64px] z-[45] w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="max-w-full mx-auto px-3 md:px-4 py-3">
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
