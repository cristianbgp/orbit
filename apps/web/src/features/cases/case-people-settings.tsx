import { CaseTeamSettings } from "./case-team-settings";

export function CasePeopleSettings({
  caseId,
  disabled,
  compact = false,
  readOnly = false,
}: {
  caseId: string;
  disabled: boolean;
  compact?: boolean;
  readOnly?: boolean;
}) {
  return (
    <div className="grid items-start gap-5 xl:grid-cols-2">
      <CaseTeamSettings
        caseId={caseId}
        disabled={disabled}
        compact={compact}
        readOnly={readOnly}
      />
      <CaseTeamSettings
        caseId={caseId}
        disabled={disabled}
        compact={compact}
        readOnly={readOnly}
        responsibility="follower"
      />
    </div>
  );
}
