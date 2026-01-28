import React, { useEffect, useMemo, useState } from 'react';
import GlobalHeader from '../components/GlobalHeader';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { getDumpAvailableYears, getDumpStatus, getDumpRawData, getDumpRawDataOptions } from '../services/api';
import { formatExactDate } from '../utils/statistics';
import { Input } from '../components/ui/input';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger
} from '../components/ui/sidebar';

const PAGE_SIZE = 50;

const RawData = () => {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [availableYears, setAvailableYears] = useState([]);
  const [selectedYear, setSelectedYear] = useState(null);
  const [filters, setFilters] = useState({
    q: '',
    lieu_collecte: '',
    categorie: '',
    sous_categorie: '',
    flux: '',
    orientation: '',
    source_file: '',
    source_sheet: '',
    date_from: '',
    date_to: ''
  });
  const [appliedFilters, setAppliedFilters] = useState({
    q: '',
    lieu_collecte: '',
    categorie: '',
    sous_categorie: '',
    flux: '',
    orientation: '',
    source_file: '',
    source_sheet: '',
    date_from: '',
    date_to: ''
  });
  const [filterOptions, setFilterOptions] = useState({
    lieu_collecte: [],
    categorie: [],
    sous_categorie: [],
    flux: [],
    orientation: [],
    source_file: [],
    source_sheet: []
  });

  const [pageSize, setPageSize] = useState(50);
  const [pageInput, setPageInput] = useState('1');

  const currentPage = Math.floor(offset / pageSize) + 1;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getDumpRawData(pageSize, offset, selectedYear, appliedFilters);
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
  }, [offset, selectedYear, appliedFilters, pageSize]);

  useEffect(() => {
    const loadYears = async () => {
      try {
        const result = await getDumpAvailableYears();
        if (result?.success) {
          const years = result.years || [];
          setAvailableYears(years);

          if (!selectedYear) {
            const currentYear = new Date().getFullYear();
            const latest = years.length > 0 ? years[years.length - 1] : null;
            let nextYear = latest || currentYear;

            if (years.includes(currentYear)) {
              try {
                const status = await getDumpStatus(currentYear);
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
    const loadOptions = async () => {
      try {
        const result = await getDumpRawDataOptions(selectedYear);
        if (result?.success) {
          setFilterOptions(result.options || {});
        }
      } catch (err) {
        // ignore
      }
    };
    loadOptions();
  }, [selectedYear]);

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

  const handleApplyFilters = () => {
    setOffset(0);
    setPageInput('1');
    setAppliedFilters(filters);
  };

  const handleResetFilters = () => {
    const empty = {
      q: '',
      lieu_collecte: '',
      categorie: '',
      sous_categorie: '',
      flux: '',
      orientation: '',
      source_file: '',
      source_sheet: '',
      date_from: '',
      date_to: ''
    };
    setFilters(empty);
    setAppliedFilters(empty);
    setOffset(0);
    setPageInput('1');
  };

  const hasActiveFilters = Object.values(appliedFilters).some((value) => value);
  useEffect(() => {
    setPageInput(String(currentPage));
  }, [currentPage]);

  const handlePageJump = () => {
    const target = Math.max(1, Math.min(totalPages, Number(pageInput) || 1));
    setOffset((target - 1) * pageSize);
    setPageInput(String(target));
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <GlobalHeader />
      <SidebarProvider>
        <Sidebar>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Filtres</SidebarGroupLabel>
              <div className="space-y-3 px-3 pb-4 text-sm">
                {availableYears.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-muted-foreground">Année</div>
                    <select
                      value={selectedYear || ''}
                      onChange={(event) => {
                        setOffset(0);
                        setSelectedYear(Number(event.target.value));
                      }}
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm"
                    >
                      {availableYears.map((year) => (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="space-y-1">
                  <div className="text-muted-foreground">Recherche</div>
                  <Input
                    value={filters.q}
                    onChange={(event) => setFilters((prev) => ({ ...prev, q: event.target.value }))}
                    placeholder="Texte, flux, fichier..."
                  />
                </div>

                <div className="space-y-1">
                  <div className="text-muted-foreground">Lieu collecte</div>
                  <Input
                    list="raw-lieu-collecte"
                    value={filters.lieu_collecte}
                    onChange={(event) => setFilters((prev) => ({ ...prev, lieu_collecte: event.target.value }))}
                    placeholder="Ex: Pépinière"
                  />
                  <datalist id="raw-lieu-collecte">
                    {(filterOptions.lieu_collecte || []).map((value) => (
                      <option key={value} value={value} />
                    ))}
                  </datalist>
                </div>

                <div className="space-y-1">
                  <div className="text-muted-foreground">Catégorie</div>
                  <Input
                    list="raw-categorie"
                    value={filters.categorie}
                    onChange={(event) => setFilters((prev) => ({ ...prev, categorie: event.target.value }))}
                    placeholder="Ex: 4.MEUBLES"
                  />
                  <datalist id="raw-categorie">
                    {(filterOptions.categorie || []).map((value) => (
                      <option key={value} value={value} />
                    ))}
                  </datalist>
                </div>

                <div className="space-y-1">
                  <div className="text-muted-foreground">Flux</div>
                  <Input
                    list="raw-flux"
                    value={filters.flux}
                    onChange={(event) => setFilters((prev) => ({ ...prev, flux: event.target.value }))}
                    placeholder="Ex: ABJ"
                  />
                  <datalist id="raw-flux">
                    {(filterOptions.flux || []).map((value) => (
                      <option key={value} value={value} />
                    ))}
                  </datalist>
                </div>

                <div className="space-y-1">
                  <div className="text-muted-foreground">Orientation</div>
                  <Input
                    list="raw-orientation"
                    value={filters.orientation}
                    onChange={(event) => setFilters((prev) => ({ ...prev, orientation: event.target.value }))}
                    placeholder="Ex: Déchets ultimes"
                  />
                  <datalist id="raw-orientation">
                    {(filterOptions.orientation || []).map((value) => (
                      <option key={value} value={value} />
                    ))}
                  </datalist>
                </div>

                <div className="space-y-1">
                  <div className="text-muted-foreground">Fichier source</div>
                  <Input
                    list="raw-source-file"
                    value={filters.source_file}
                    onChange={(event) => setFilters((prev) => ({ ...prev, source_file: event.target.value }))}
                    placeholder="Rechercher dans les données..."
                  />
                  <datalist id="raw-source-file">
                    {(filterOptions.source_file || []).map((value) => (
                      <option key={value} value={value} />
                    ))}
                  </datalist>
                </div>

                <div className="space-y-1">
                  <div className="text-muted-foreground">Feuille source</div>
                  <Input
                    list="raw-source-sheet"
                    value={filters.source_sheet}
                    onChange={(event) => setFilters((prev) => ({ ...prev, source_sheet: event.target.value }))}
                    placeholder="Ex: A"
                  />
                  <datalist id="raw-source-sheet">
                    {(filterOptions.source_sheet || []).map((value) => (
                      <option key={value} value={value} />
                    ))}
                  </datalist>
                </div>

                <div className="space-y-1">
                  <div className="text-muted-foreground">Du</div>
                  <Input
                    type="date"
                    value={filters.date_from}
                    onChange={(event) => setFilters((prev) => ({ ...prev, date_from: event.target.value }))}
                  />
                </div>

                <div className="space-y-1">
                  <div className="text-muted-foreground">Au</div>
                  <Input
                    type="date"
                    value={filters.date_to}
                    onChange={(event) => setFilters((prev) => ({ ...prev, date_to: event.target.value }))}
                  />
                </div>

                <div className="flex flex-col gap-2 pt-2">
                  <Button
                    onClick={handleApplyFilters}
                    size="sm"
                    className="bg-brand text-brand-foreground hover:bg-brand/90"
                  >
                    Appliquer
                  </Button>
                  <Button onClick={handleResetFilters} size="sm" variant="outline" disabled={!hasActiveFilters}>
                    Réinitialiser
                  </Button>
                </div>
              </div>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>

        <SidebarInset className="p-2 md:p-3">
          <div className="w-full mx-auto space-y-6">
            <div className="flex flex-col gap-2">
              <h1 className="text-3xl md:text-4xl font-bold">Données brutes</h1>
              <p className="text-muted-foreground">
                {total > 0 ? `${total} lignes disponibles` : 'Aucune donnée disponible'}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <SidebarTrigger />
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Card>
              <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <CardTitle>Table des données</CardTitle>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Taille</span>
                    <select
                      value={pageSize}
                      onChange={(event) => {
                        const nextSize = Number(event.target.value);
                        setPageSize(nextSize);
                        setOffset(0);
                        setPageInput('1');
                      }}
                      className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm"
                    >
                      {[50, 100, 200].map((size) => (
                        <option key={size} value={size}>
                          {size}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Aller à</span>
                    <Input
                      value={pageInput}
                      onChange={(event) => setPageInput(event.target.value)}
                      className="h-9 w-20"
                      inputMode="numeric"
                    />
                    <Button variant="outline" size="sm" onClick={handlePageJump} disabled={loading}>
                      OK
                    </Button>
                    <span className="text-muted-foreground">/ {totalPages}</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setOffset((prev) => Math.max(0, prev - pageSize))}
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
                    onClick={() => setOffset((prev) => Math.min((totalPages - 1) * pageSize, prev + pageSize))}
                    disabled={offset + pageSize >= total || loading}
                  >
                    Suivant
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-3 md:p-4">
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
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
};

export default RawData;
