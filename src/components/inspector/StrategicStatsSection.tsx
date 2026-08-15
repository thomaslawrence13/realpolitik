import type { CountryProfile } from '../../types';

interface Props {
  profile: CountryProfile;
}

interface StatItem {
  label: string;
  value: string;
  note?: string;
  tone?: 'positive' | 'negative' | 'neutral';
}

const StatGroup = ({ title, icon, items }: { title: string; icon: string; items: StatItem[] }) => {
  if (items.length === 0) return null;
  return (
    <section className="strategic-stat-group">
      <h4><span aria-hidden>{icon}</span>{title}</h4>
      <div className="strategic-stat-grid">
        {items.map((item) => (
          <div className="strategic-stat" key={`${title}-${item.label}`}>
            <span>{item.label}</span>
            <strong data-tone={item.tone}>{item.value}</strong>
            {item.note && <em>{item.note}</em>}
          </div>
        ))}
      </div>
    </section>
  );
};

export function StrategicStatsSection({ profile }: Props) {
  const demographics: StatItem[] = profile.demographics ? [
    { label: 'Population', value: `${profile.demographics.populationMillions.toLocaleString()}M` },
    { label: 'Median age', value: `${profile.demographics.medianAge.toFixed(1)} years` },
    { label: 'Urbanization', value: `${profile.demographics.urbanizationPct.toFixed(0)}%` },
    { label: 'Youth share', value: `${profile.demographics.youthSharePct.toFixed(0)}%`, note: 'ages 15–29' },
  ] : [];
  const resilience: StatItem[] = [
    ...(profile.energy ? [
      {
        label: 'Energy balance',
        value: profile.energy.energyImportDependencePct >= 0
          ? `${profile.energy.energyImportDependencePct.toFixed(0)}% imports`
          : `${Math.abs(profile.energy.energyImportDependencePct).toFixed(0)}% net export`,
        tone: profile.energy.energyImportDependencePct > 50 ? 'negative' as const : 'neutral' as const,
      },
      { label: 'Net oil', value: `${profile.energy.netOilExportMbd > 0 ? '+' : ''}${profile.energy.netOilExportMbd} mb/d` },
      { label: 'Net gas', value: `${profile.energy.netGasExportBcm > 0 ? '+' : ''}${profile.energy.netGasExportBcm} bcm/y` },
    ] : []),
    ...(profile.foodWater ? [
      {
        label: 'Water stress', value: `${profile.foodWater.waterStressIndex}/5`,
        tone: profile.foodWater.waterStressIndex >= 4 ? 'negative' as const : 'neutral' as const,
      },
      {
        label: 'Food balance',
        value: profile.foodWater.foodImportDependencePct >= 0
          ? `${profile.foodWater.foodImportDependencePct.toFixed(0)}% imports`
          : `${Math.abs(profile.foodWater.foodImportDependencePct).toFixed(0)}% net export`,
      },
    ] : []),
  ];
  const capacity: StatItem[] = [
    ...(profile.fiscal ? [
      { label: 'External debt', value: `${profile.fiscal.externalDebtGdpPct.toFixed(0)}% GDP`, tone: profile.fiscal.externalDebtGdpPct >= 90 ? 'negative' as const : 'neutral' as const },
      { label: 'Sovereign tier', value: profile.fiscal.sovereignRatingTier, tone: profile.fiscal.sovereignRatingTier === 'distressed' ? 'negative' as const : 'neutral' as const },
      { label: 'FX reserves', value: `${profile.fiscal.fxReservesMonthsImports.toFixed(1)} months`, note: 'import cover' },
    ] : []),
    ...(profile.cyber ? [
      { label: 'Cyber posture', value: `${profile.cyber.offensiveTier} / ${profile.cyber.defensiveTier}`, note: 'offence / defence' },
      { label: 'Internet freedom', value: `${profile.cyber.internetFreedomScore}/100`, tone: profile.cyber.internetFreedomScore >= 70 ? 'positive' as const : profile.cyber.internetFreedomScore < 40 ? 'negative' as const : 'neutral' as const },
    ] : []),
  ];
  const influence: StatItem[] = [
    ...(profile.softPower ? [{ label: 'Soft power', value: `${profile.softPower.reachScore}/100` }] : []),
    ...(profile.diplomatic ? [
      { label: 'UN alignment', value: `${profile.diplomatic.unVotingAlignmentBlocA}% US`, note: `${profile.diplomatic.unVotingAlignmentBlocB}% Russia` },
      { label: 'Defense pacts', value: profile.diplomatic.defensePacts.length.toLocaleString(), note: profile.diplomatic.defensePacts.slice(0, 2).join(' · ') || 'none recorded' },
      { label: 'Memberships', value: profile.diplomatic.igoMemberships.length.toLocaleString(), note: profile.diplomatic.igoMemberships.slice(0, 3).join(' · ') },
    ] : []),
    ...(profile.criticalMinerals?.length ? [{ label: 'Critical minerals', value: profile.criticalMinerals.length.toLocaleString(), note: 'tracked supply-chain roles' }] : []),
  ];

  if (![demographics, resilience, capacity, influence].some((items) => items.length > 0)) return null;
  return (
    <div className="profile-section strategic-profile-section">
      <h3 className="profile-section-title"><span className="profile-section-icon" aria-hidden>◈</span>Strategic profile</h3>
      <StatGroup title="People" icon="◉" items={demographics} />
      <StatGroup title="Resilience" icon="◇" items={resilience} />
      <StatGroup title="State capacity" icon="◆" items={capacity} />
      <StatGroup title="Influence" icon="◎" items={influence} />
    </div>
  );
}
