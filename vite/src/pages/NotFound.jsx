import React from 'react';
import { useNavigate } from 'react-router-dom';
import GlobalHeader from '../components/GlobalHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Home, ArrowLeft, AlertCircle } from 'lucide-react';

function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <GlobalHeader />
      <div className="max-w-6xl mx-auto min-h-[calc(100vh-2rem)] flex flex-col p-4 md:p-8">
        <main className="flex-1 flex items-center justify-center">
          <Card className="w-full max-w-md text-center">
            <CardHeader>
              <div className="flex justify-center mb-4">
                <div className="rounded-full bg-destructive/10 p-4">
                  <AlertCircle className="h-12 w-12 text-destructive" />
                </div>
              </div>
              <CardTitle className="text-4xl md:text-5xl font-bold mb-2">404</CardTitle>
              <CardDescription className="text-lg">
                Page non trouvée
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Désolé, la page que vous recherchez n'existe pas ou a été déplacée.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
                <Button
                  onClick={() => navigate('/')}
                  size="lg"
                  className="w-full sm:w-auto bg-brand text-brand-foreground hover:bg-brand/90"
                >
                  <Home className="mr-2 h-4 w-4" />
                  Retour à l'accueil
                </Button>
                <Button
                  onClick={() => navigate(-1)}
                  variant="outline"
                  size="lg"
                  className="w-full sm:w-auto"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Page précédente
                </Button>
              </div>
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

export default NotFound;
