import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import FileSelector from '../components/FileSelector';
import ProgressBar from '../components/ProgressBar';
import StatusMessage from '../components/StatusMessage';
import GlobalHeader from '../components/GlobalHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import {
  checkStatus,
  transformFile,
  downloadFile,
  startImportJob,
  getImportJob,
  generateAnnualFile,
  getDbStatus,
  getAvailableYears,
  getInputFiles,
  getOutputFiles
} from '../services/api';
import { RefreshCw, BarChart3, Download, Database, FileSpreadsheet, FolderOpen } from 'lucide-react';

function ImportPage() {
  const navigate = useNavigate();
  const [selectedFile, setSelectedFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(null);
  const [statusMessage, setStatusMessage] = useState(null);
  const [statusType, setStatusType] = useState('info');
  const [serverStatus, setServerStatus] = useState('checking');
  const [outputFilename, setOutputFilename] = useState(null);

  const [availableYears, setAvailableYears] = useState([]);
  const [selectedYear, setSelectedYear] = useState(null);
  const [dbStatus, setDbStatus] = useState(null);

  const [ingestLoading, setIngestLoading] = useState(false);
  const [ingestMessage, setIngestMessage] = useState(null);
  const [ingestType, setIngestType] = useState('info');
  const [ingestLogs, setIngestLogs] = useState([]);
  const [ingestExpanded, setIngestExpanded] = useState(true);
  const [ingestJobId, setIngestJobId] = useState(null);
  const [ingestProgress, setIngestProgress] = useState({ current: 0, total: 0, percent: 0 });
  const ingestPollRef = useRef(null);
  const ingestLogRef = useRef(null);
  const ingestCursorRef = useRef(0);

  const [annualLoading, setAnnualLoading] = useState(false);
  const [annualMessage, setAnnualMessage] = useState(null);
  const [annualType, setAnnualType] = useState('info');
  const [annualOutputs, setAnnualOutputs] = useState([]);
  const [inputFiles, setInputFiles] = useState([]);
  const [outputFiles, setOutputFiles] = useState([]);
  const [filesMessage, setFilesMessage] = useState(null);
  const [filesType, setFilesType] = useState('info');

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
        const result = await getAvailableYears();
        if (result?.success) {
          const years = result.years || [];
          setAvailableYears(years);

          if (!selectedYear) {
            const currentYear = new Date().getFullYear();
            const latest = result.latest || (years.length > 0 ? years[years.length - 1] : null);
            let nextYear = latest || currentYear;

            if (years.includes(currentYear)) {
              try {
                const status = await getDbStatus(currentYear);
                if (!status?.success || !status?.rows) {
                  nextYear = currentYear - 1;
                } else {
                  nextYear = currentYear;
                }
              } catch (err) {
                nextYear = currentYear - 1;
              }
            }

            setSelectedYear(nextYear);
          }
        }
      } catch (err) {
        // ignore
      }
    };
    loadYears();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedYear) return;
    const loadStatus = async () => {
      try {
        const status = await getDbStatus(selectedYear);
        if (status?.success) {
          setDbStatus(status);
        }
      } catch (err) {
        setDbStatus(null);
      }
    };
    loadStatus();
  }, [selectedYear]);

  useEffect(() => {
    const storedJobId = localStorage.getItem('ingest_job_id');
    const storedCursor = Number(localStorage.getItem('ingest_job_cursor') || 0);
    if (storedJobId) {
      setIngestJobId(storedJobId);
      ingestCursorRef.current = storedCursor;
      setIngestExpanded(true);
      setIngestLogs((prev) => (prev.length ? prev : ['[INFO] Reprise du journal d’import...']));
    }
  }, []);

  useEffect(() => {
    if (!ingestJobId) return;

    const stopPolling = () => {
      if (ingestPollRef.current) {
        clearInterval(ingestPollRef.current);
        ingestPollRef.current = null;
      }
    };

    const poll = async () => {
      try {
        const result = await getImportJob(ingestJobId, ingestCursorRef.current);
        if (!result?.success) {
          throw new Error(result?.message || 'Impossible de lire le journal.');
        }

        const newLogs = result.logs || [];
        if (newLogs.length > 0) {
          setIngestLogs((prev) => [...prev, ...newLogs]);
          const nextIndex = result.next_index ?? ingestCursorRef.current;
          ingestCursorRef.current = nextIndex;
          localStorage.setItem('ingest_job_cursor', String(nextIndex));
        }

        const job = result.job || {};
        if (job.progress) {
          setIngestProgress(job.progress);
        }

        if (job.status === 'completed') {
          stopPolling();
          localStorage.removeItem('ingest_job_id');
          localStorage.removeItem('ingest_job_cursor');

          const files = job.result?.files || [];
          const totalRows = files.reduce((sum, file) => sum + (file.rows || 0), 0);
          const invalidRows = files.reduce((sum, file) => sum + (file.invalid_rows || 0), 0);
          const hasErrors = files.some((file) => file.status === 'error');

          setIngestMessage(
            `Import terminé : ${job.result?.file_count || files.length} fichiers, ${totalRows} lignes.`
            + (invalidRows ? ` ${invalidRows} lignes invalides.` : '')
            + (hasErrors ? ' Certains fichiers sont invalides.' : '')
          );
          setIngestType(hasErrors ? 'warning' : 'success');
          setIngestLoading(false);

          try {
            const status = await getDbStatus(selectedYear);
            if (status?.success) {
              setDbStatus(status);
            }
          } catch (err) {
            // ignore
          }
        }

        if (job.status === 'failed') {
          stopPolling();
          localStorage.removeItem('ingest_job_id');
          localStorage.removeItem('ingest_job_cursor');
          setIngestMessage(job.error || 'Erreur lors de l\'ingestion');
          setIngestType('error');
          setIngestLoading(false);
        }
      } catch (error) {
        stopPolling();
        setIngestMessage(error.message || 'Erreur lors du journal d\'import');
        setIngestType('error');
        setIngestLoading(false);
      }
    };

    poll();
    ingestPollRef.current = setInterval(poll, 1500);

    return () => stopPolling();
  }, [ingestJobId, selectedYear]);

  useEffect(() => {
    if (!ingestExpanded || !ingestLogRef.current) return;
    ingestLogRef.current.scrollTop = ingestLogRef.current.scrollHeight;
  }, [ingestLogs, ingestExpanded]);

  useEffect(() => {
    const loadFiles = async () => {
      try {
        const [inputResult, outputResult] = await Promise.all([
          getInputFiles(),
          getOutputFiles()
        ]);
        if (inputResult?.success) {
          setInputFiles(inputResult.files || []);
        }
        if (outputResult?.success) {
          setOutputFiles(outputResult.files || []);
        }
      } catch (error) {
        setFilesMessage(error.message || 'Erreur lors du chargement des fichiers');
        setFilesType('error');
      }
    };
    loadFiles();
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

        const statsFilename = result.output_relative_path || result.output_path || result.output_filename;
        setOutputFilename(statsFilename);
        try {
          localStorage.setItem('last_output_filename', statsFilename);
        } catch (storageError) {
          // Ignore storage failures
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

  const handleIngest = async (force = false) => {
    if (!selectedYear) {
      setIngestMessage('Sélectionnez une année avant l\'import.');
      setIngestType('warning');
      return;
    }
    setIngestLoading(true);
    setIngestMessage('Ingestion en cours...');
    setIngestType('info');
    setIngestLogs(['[INFO] Ingestion en cours...']);
    setIngestExpanded(true);
    ingestCursorRef.current = 0;
    setIngestProgress({ current: 0, total: 0, percent: 0 });
    try {
      const result = await startImportJob(force, selectedYear, true);
      if (!result?.success || !result.job_id) {
        throw new Error(result?.message || 'Impossible de démarrer l\'import.');
      }
      setIngestJobId(result.job_id);
      ingestCursorRef.current = 0;
      localStorage.setItem('ingest_job_id', result.job_id);
      localStorage.setItem('ingest_job_cursor', '0');
    } catch (error) {
      setIngestMessage(error.message || 'Erreur lors de l\'ingestion');
      setIngestType('error');
      setIngestLogs((prev) => (prev.length ? prev : ['[ERREUR] Échec de l’ingestion.']));
    } finally {
      // L'état loading sera arrêté par le poller
    }
  };

  const handleAnnualGenerate = async () => {
    if (!selectedYear) {
      setAnnualMessage('Sélectionnez une année avant la génération.');
      setAnnualType('warning');
      return;
    }
    setAnnualLoading(true);
    setAnnualMessage('Génération en cours...');
    setAnnualType('info');
    setAnnualOutputs([]);
    try {
      const result = await generateAnnualFile(selectedYear);
      if (!result?.success) {
        throw new Error(result?.error || result?.message || 'Erreur lors de la génération');
      }
      setAnnualOutputs(result.outputs || []);
      setAnnualMessage(result.message || 'Génération terminée.');
      setAnnualType('success');
    } catch (error) {
      setAnnualMessage(error.message || 'Erreur lors de la génération');
      setAnnualType('error');
    } finally {
      setAnnualLoading(false);
    }
  };

  const handleRefreshFiles = async () => {
    setFilesMessage('Actualisation en cours...');
    setFilesType('info');
    try {
      const [inputResult, outputResult] = await Promise.all([
        getInputFiles(),
        getOutputFiles()
      ]);
      if (inputResult?.success) {
        setInputFiles(inputResult.files || []);
      }
      if (outputResult?.success) {
        setOutputFiles(outputResult.files || []);
      }
      setFilesMessage('Liste actualisée.');
      setFilesType('success');
    } catch (error) {
      setFilesMessage(error.message || 'Erreur lors de l’actualisation');
      setFilesType('error');
    }
  };

  const handleCopyOutputPath = async () => {
    try {
      const result = await getOutputFiles();
      const dir = result?.directory;
      if (dir) {
        await navigator.clipboard.writeText(dir);
        setFilesMessage(`Chemin copié: ${dir}`);
        setFilesType('success');
      } else {
        throw new Error('Chemin output indisponible');
      }
    } catch (error) {
      setFilesMessage(error.message || 'Impossible de copier le chemin output');
      setFilesType('error');
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <GlobalHeader />
      {serverStatus !== 'online' && (
        <div className="sticky top-[64px] z-[45] w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="max-w-6xl mx-auto px-4 md:px-8 py-3">
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
      <div className="max-w-6xl mx-auto min-h-[calc(100vh-2rem)] flex flex-col p-4 md:p-8">
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
            Préparez les données brutes, générez les fichiers de sortie et lancez les analyses.
          </p>
        </header>

        <main className="flex-1 space-y-6">

          <Card>
            <CardHeader>
              <CardTitle>Ingestion des données brutes</CardTitle>
              <CardDescription>
                Importez les fichiers Excel du dossier input dans la base SQLite.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                {availableYears.length > 0 && (
                  <select
                    value={selectedYear || ''}
                    onChange={(event) => setSelectedYear(Number(event.target.value))}
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
                  onClick={() => handleIngest(false)}
                  disabled={ingestLoading || serverStatus === 'offline'}
                  className="bg-brand text-brand-foreground hover:bg-brand/90"
                >
                  <Database className="mr-2 h-4 w-4" />
                  Importer
                </Button>
                <Button
                  onClick={() => handleIngest(true)}
                  disabled={ingestLoading || serverStatus === 'offline'}
                  variant="outline"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Réimporter
                </Button>
              </div>

              {dbStatus && (
                <div className="text-sm text-muted-foreground">
                  {dbStatus.rows} lignes · {dbStatus.files} fichiers
                  {dbStatus.last_import?.filename && ` · Dernier import: ${dbStatus.last_import.filename}`}
                </div>
              )}

              {ingestMessage && (
                <StatusMessage
                  type={ingestType}
                  message={ingestMessage}
                  onClose={() => setIngestMessage(null)}
                />
              )}

              {(ingestLoading || (ingestProgress?.total ?? 0) > 0) && (
                <ProgressBar
                  progress={ingestProgress?.percent ?? null}
                  message={
                    ingestLoading
                      ? `Import en cours : ${ingestProgress.current || 0}/${ingestProgress.total || 0} lignes`
                      : null
                  }
                  isComplete={!ingestLoading && ingestType === 'success' && (ingestProgress?.total ?? 0) > 0}
                  isError={ingestType === 'error'}
                />
              )}

              {(ingestLoading || ingestLogs.length > 0) && (
                <div className="rounded-md border border-border bg-muted/30 p-3">
                  <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                    <span>Journal d’import</span>
                    <button
                      type="button"
                      className="text-xs underline-offset-4 hover:underline"
                      onClick={() => setIngestExpanded((prev) => !prev)}
                    >
                      {ingestExpanded ? 'Masquer' : 'Afficher'}
                    </button>
                  </div>
                  {ingestExpanded && (
                    <div
                      ref={ingestLogRef}
                      className="max-h-48 overflow-auto text-xs font-mono whitespace-pre-wrap text-muted-foreground"
                    >
                      {ingestLogs.join('\n')}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Générer les fichiers de sortie</CardTitle>
              <CardDescription>
                Créez les fichiers Excel T1/T2 depuis le dossier input.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                {availableYears.length > 0 && (
                  <select
                    value={selectedYear || ''}
                    onChange={(event) => setSelectedYear(Number(event.target.value))}
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
                  onClick={handleAnnualGenerate}
                  disabled={annualLoading || serverStatus === 'offline'}
                  className="bg-brand text-brand-foreground hover:bg-brand/90"
                >
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  Générer
                </Button>
              </div>

              {annualOutputs.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {annualOutputs.map((output) => (
                    <Button
                      key={output.filename}
                      variant="outline"
                      onClick={() => downloadFile(output.filename, output.output_path)}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      {output.label || output.filename}
                    </Button>
                  ))}
                </div>
              )}

              {annualMessage && (
                <StatusMessage
                  type={annualType}
                  message={annualMessage}
                  onClose={() => setAnnualMessage(null)}
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Fichiers détectés</CardTitle>
              <CardDescription>
                Vérifiez la liste des fichiers disponibles dans input/ et output/.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <Button onClick={handleRefreshFiles} variant="outline">
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Actualiser
                </Button>
                <Button onClick={handleCopyOutputPath} variant="outline">
                  <FolderOpen className="mr-2 h-4 w-4" />
                  Copier le chemin output
                </Button>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-md border border-border p-3">
                  <div className="text-sm font-medium">input/</div>
                  {inputFiles.length > 0 ? (
                    <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                      {inputFiles.map((name) => (
                        <li key={name}>{name}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm text-muted-foreground">Aucun fichier détecté.</p>
                  )}
                </div>
                <div className="rounded-md border border-border p-3">
                  <div className="text-sm font-medium">output/</div>
                  {outputFiles.length > 0 ? (
                    <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                      {outputFiles.map((name) => (
                        <li key={name}>{name}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm text-muted-foreground">Aucun fichier détecté.</p>
                  )}
                </div>
              </div>

              {filesMessage && (
                <StatusMessage
                  type={filesType}
                  message={filesMessage}
                  onClose={() => setFilesMessage(null)}
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Fichier d'entrée (upload)</CardTitle>
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
                    className="w-full bg-brand text-brand-foreground hover:bg-brand/90"
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
                      onClick={() => navigate('/stats')}
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

export default ImportPage;
