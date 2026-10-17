export type ProjectStageRecord = {
  id: string;
  organizationId: string;
  projectId: string;
  name: string;
  description: string | null;
  position: number;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateProjectStageInput = {
  name: string;
  description?: string | null;
};

export type UpdateProjectStageInput = Partial<CreateProjectStageInput>;

export type ProjectStageCreateValues = {
  id: string;
  name: string;
  description: string | null;
};

export type ProjectStagePatchValues = Partial<
  Pick<ProjectStageRecord, "name" | "description">
>;

export type ReorderProjectStagesInput = {
  stageIds: string[];
};
