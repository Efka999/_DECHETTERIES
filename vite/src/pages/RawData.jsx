import React, { useEffect, useMemo, useState } from 'react';
import GlobalHeader from '../components/GlobalHeader';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { getRawData } from '../services/api';
import { formatExactDate } from '../utils/statistics';

const PAGE_SIZE = 50;

const RawData = () => {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getRawData(PAGE_SIZE, offset);
      if (result && result.success) {
        setItems(result.items || []);
        setTotal(result.total || 0);
      } else {
        setError(result?.message || 'Impossible de charger les données brutes.');
      }
    } catch (err) {
      setError(err.message || 'Erreur lors du chargement des données brutes.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offset]);

  const columns = useMemo(
    () => [
      { key: 'date', label: 'Date' },
      { key: 'lieu_collecte', label: 'Lieu collecte' },
      { key: 'categorie', label: 'Catégorie' },
      { key: 'sous_categorie', label: 'Sous catégorie' },
      { key: 'flux', label: 'Flux' },
      { key: 'orientation', label: 'Orientation' },
      { key: 'poids', label: 'Poids' },
      { key: 'source_sheet', label: 'Feuille' },
      { key: 'source_file', label: 'Fichier' }
    ],
    []
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <GlobalHeader />
      <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl md:text-4xl font-bold">Données brutes</h1>
          <p className="text-muted-foreground">
            {total > 0 ? `${total} lignes disponibles` : 'Aucune donnée disponible'}
          </p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <CardTitle>Table des données</CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setOffset((prev) => Math.max(0, prev - PAGE_SIZE))}
                disabled={offset === 0 || loading}
              >
                <ChevronLeft className="mr-1 h-4 w-4" />
                Précédent
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {currentPage} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setOffset((prev) => Math.min((totalPages - 1) * PAGE_SIZE, prev + PAGE_SIZE))}
                disabled={offset + PAGE_SIZE >= total || loading}
              >
                Suivant
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-10 text-muted-foreground">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Chargement des données...
              </div>
            ) : (
              <div className="w-full overflow-auto rounded-md border">
                <table className="min-w-full text-sm">
                  <thead className="bg-muted/40">
                    <tr>
                      {columns.map((col) => (
                        <th
                          key={col.key}
                          className="whitespace-nowrap px-3 py-2 text-left font-medium text-muted-foreground"
                        >
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {items.length === 0 ? (
                      <tr>
                        <td className="px-3 py-6 text-center text-muted-foreground" colSpan={columns.length}>
                          Aucune donnée à afficher.
                        </td>
                      </tr>
                    ) : (
                      items.map((row) => (
                        <tr key={row.id} className="border-t">
                          {columns.map((col) => (
                            <td key={col.key} className="whitespace-nowrap px-3 py-2">
                              {col.key === 'date'
                                ? (row.date_raw || formatExactDate(row.date))
                                : (row[col.key] ?? '')}
                            </td>
                          ))}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default RawData;
