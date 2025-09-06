type Stat = {
  label: string; // e.g. "{value} FPS"
  value: string | number;
  unit?: string;
};

type StatsProps = {
  stats?: Stat[];
};

const defaultStats: Stat[] = [
  { label: '{value} FPS', value: 26 },
  { label: '{value}ms inference', value: 21.6 },
];

const Stats = ({ stats = defaultStats }: StatsProps) => {
  const statString = stats
    .map(s => s.label.replace('{value}', String(s.value)))
    .join(', ');
  return <>{statString}</>;
};

export default Stats