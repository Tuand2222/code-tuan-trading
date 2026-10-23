import type { Journal, Trade } from '../data/schema';
import { AdvancedReview } from './AdvancedReview';
import { ResearchTools } from './ResearchTools';
import { PlannedTrades } from './PlannedTrades';
import type { Scope, analyze } from '../core/analyze';
import { CustomDefinitions } from './CustomDefinitions';
import { DeepAnalysis } from './DeepAnalysis';
export function AdvancedWorkspace({
  journal,
  trades,
  scope,
  base,
}: {
  journal: Journal;
  trades: Trade[];
  scope: Scope;
  base?: ReturnType<typeof analyze>;
}) {
  return (
    <>
      <CustomDefinitions journal={journal} />
      <AdvancedReview journal={journal} trades={trades} />
      <ResearchTools
        key={journal.id + JSON.stringify(scope) + trades.map((t) => t.id + t.updatedAt).join()}
        journal={journal}
        trades={trades}
        scope={scope}
        base={base}
      />
      <PlannedTrades journal={journal} />
      <DeepAnalysis journal={journal} trades={trades} result={base} />
    </>
  );
}
