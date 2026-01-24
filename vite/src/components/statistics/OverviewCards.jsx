import React from 'react';
import StatCard from './StatCard';
import { Package, MapPin, TrendingUp } from 'lucide-react';
import { formatKg, buildGlobalMonthlyData } from '../../utils/statistics';

const OverviewCards = ({ stats, monthlyData }) => {
  // Si monthlyData n'est pas fourni, le calculer
  const data = monthlyData || buildGlobalMonthlyData(stats);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <StatCard
        title="Total général"
        value={`${formatKg(stats.global_totals.TOTAL)} kg`}
        description="Toutes déchetteries confondues"
        icon={Package}
      />
      <StatCard
        title="Déchetteries"
        value={stats.num_dechetteries}
        description="Déchetteries actives"
        icon={MapPin}
      />
      <StatCard
        title="Période"
        value={data.length}
        description="Jours avec données"
        icon={TrendingUp}
      />
    </div>
  );
};

export default OverviewCards;
