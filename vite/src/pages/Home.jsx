import React from 'react';
import { useNavigate } from 'react-router-dom';
import GlobalHeader from '../components/GlobalHeader';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { BarChart3, Calendar, Database, Upload } from 'lucide-react';

function Home() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <GlobalHeader />
      <div className="max-w-full mx-auto h-[calc(100vh-64px)] flex flex-col p-4 md:p-6 px-4 md:px-6">
        <header className="text-center mb-10">
          <div className="mb-2 flex justify-center">
            <img
              src="/logo-emmaus-environnement.webp"
              alt="Emmaüs Environnement"
              className="h-8 w-auto md:h-10 opacity-80"
            />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold mb-3">GDR Dump (Beta)</h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Centralisez l’import, l’analyse et la consultation des données de collecte.
          </p>
        </header>

        <main className="grid gap-6 md:grid-cols-3 w-full mx-auto items-stretch flex-1">
          <Card className="flex h-full flex-col">
            <CardHeader className="space-y-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-brand/10 text-brand">
                <Upload className="h-4 w-4" />
              </div>
              <CardTitle>Import</CardTitle>
              <CardDescription>
                Importez les fichiers de dump dans la base de données.
              </CardDescription>
            </CardHeader>
            <CardContent className="mt-auto w-fit">
              <Button
                onClick={() => navigate('/import')}
                className="w-fit bg-brand text-brand-foreground hover:bg-brand/90"
              >
                <Upload className="mr-2 h-4 w-4" />
                Ouvrir Import
              </Button>
            </CardContent>
          </Card>

          <Card className="flex h-full flex-col">
            <CardHeader className="space-y-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-brand/10 text-brand">
                <BarChart3 className="h-4 w-4" />
              </div>
              <CardTitle>Statistiques</CardTitle>
              <CardDescription>
                Explorez les tendances annuelles et les détails par déchetterie.
              </CardDescription>
            </CardHeader>
            <CardContent className="mt-auto w-fit">
              <Button onClick={() => navigate('/stats')} variant="outline" className="w-fit">
                <BarChart3 className="mr-2 h-4 w-4" />
                Voir les stats
              </Button>
            </CardContent>
          </Card>

          <Card className="flex h-full flex-col">
            <CardHeader className="space-y-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-brand/10 text-brand">
                <Database className="h-4 w-4" />
              </div>
              <CardTitle>Données brutes</CardTitle>
              <CardDescription>
                Consultez les lignes ingérées pour vérification et export.
              </CardDescription>
            </CardHeader>
            <CardContent className="mt-auto w-fit">
              <Button onClick={() => navigate('/raw-data')} variant="outline" className="w-fit">
                <Database className="mr-2 h-4 w-4" />
                Parcourir
              </Button>
            </CardContent>
          </Card>
        </main>

        <section className="mt-8 w-full mx-auto">
          <Card>
            <CardHeader className="space-y-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-brand/10 text-brand">
                <Calendar className="h-4 w-4" />
              </div>
              <CardTitle>À venir</CardTitle>
              <CardDescription>
                Nous préparerons un outil pour créer les plannings des employés de déchetterie.
              </CardDescription>
            </CardHeader>
          </Card>
        </section>

        <footer className="mt-10 text-sm text-muted-foreground">
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
