import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn, formatScore, getScoreColor, getScoreBgColor } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: React.ReactNode;
}

export function StatCard({ title, value, description, icon }: StatCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
      </CardContent>
    </Card>
  );
}

interface ScoreDisplayProps {
  score: number;
  label?: string;
  size?: "sm" | "md" | "lg";
}

export function ScoreDisplay({ score, label, size = "md" }: ScoreDisplayProps) {
  return (
    <div className="text-center">
      <div className={cn(
        "inline-flex items-center justify-center rounded-full font-bold",
        getScoreBgColor(score),
        getScoreColor(score),
        size === "lg" ? "h-24 w-24 text-5xl" : size === "md" ? "h-16 w-16 text-3xl" : "h-10 w-10 text-lg"
      )}>
        {Math.round(score)}
      </div>
      {label && <p className="text-sm text-muted-foreground mt-2">{label}</p>}
    </div>
  );
}

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {icon && <div className="mb-4 text-muted-foreground">{icon}</div>}
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-muted-foreground max-w-sm mb-6">{description}</p>
      {action}
    </div>
  );
}

interface ScoreBreakdownProps {
  scores: { label: string; value: number }[];
}

export function ScoreBreakdown({ scores }: ScoreBreakdownProps) {
  return (
    <div className="space-y-3">
      {scores.map((s) => (
        <div key={s.label}>
          <div className="flex justify-between text-sm mb-1">
            <span>{s.label}</span>
            <span className={cn("font-medium", getScoreColor(s.value))}>{formatScore(s.value)}</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all", s.value >= 80 ? "bg-emerald-500" : s.value >= 60 ? "bg-amber-500" : "bg-red-500")}
              style={{ width: `${s.value}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
