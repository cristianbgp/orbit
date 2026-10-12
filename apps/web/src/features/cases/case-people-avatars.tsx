import type { LegalCaseTeam } from "@/lib/api/generated/models";
import { CasePeopleGroups } from "./case-people-groups";
import { CaseTeamAvatars } from "./case-team-avatars";

export function CasePeopleAvatars({
  caseName,
  team,
  followers,
}: {
  caseName: string;
  team: LegalCaseTeam;
  followers: LegalCaseTeam;
}) {
  return (
    <CasePeopleGroups
      caseName={caseName}
      team={
        <CaseTeamAvatars caseName={caseName} team={team} scrollable={false} />
      }
      followers={
        <CaseTeamAvatars
          caseName={caseName}
          team={followers}
          kind="followers"
          scrollable={false}
        />
      }
    />
  );
}
