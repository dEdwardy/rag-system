import { Legend, Pie, PieChart, PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip, Cell } from "recharts";

type RadarDatum = {
  subject: string;
  A: number;
  fullMark: number;
};

type QualityDistributionDatum = {
  name: string;
  value: number;
  color: string;
};

type ReportChartsProps = {
  locale: "zh" | "en";
  radarData: RadarDatum[];
  qualityDistributionData: QualityDistributionDatum[];
};

export function ReportCharts({ locale, radarData, qualityDistributionData }: ReportChartsProps) {
  return (
    <>
      {radarData.length > 0 ? (
        <div className="h-80">
          <ResponsiveContainer height="100%" width="100%">
            <RadarChart data={radarData} height={250} outerRadius={90} width={730}>
              <PolarGrid />
              <PolarAngleAxis dataKey="subject" />
              <PolarRadiusAxis angle={30} domain={[0, 100]} />
              <Radar dataKey="A" fill="#8884d8" fillOpacity={0.6} name={locale === "zh" ? "当前检查" : "Current check"} stroke="#8884d8" />
              <Legend />
              <Tooltip />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      ) : null}

      {qualityDistributionData.length > 0 ? (
        <div className="h-64">
          <ResponsiveContainer height="100%" width="100%">
            <PieChart>
              <Pie
                cx="50%"
                cy="50%"
                data={qualityDistributionData}
                dataKey="value"
                fill="#8884d8"
                label={({ name, percent }: { name?: string | number; percent?: number }) => {
                  const labelName = name == null ? (locale === "zh" ? "未命名" : "Unnamed") : String(name);
                  const labelPercent = typeof percent === "number" ? percent : 0;
                  return `${labelName}: ${(labelPercent * 100).toFixed(0)}%`;
                }}
                labelLine={false}
                outerRadius={80}
              >
                {qualityDistributionData.map((entry, index) => (
                  <Cell fill={entry.color} key={`${entry.name}-${index}`} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      ) : null}
    </>
  );
}
