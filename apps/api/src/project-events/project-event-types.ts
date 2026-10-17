export type ProjectEventType = "legal" | "meeting" | "other";

export type ProjectEventActor = {
  userId: string;
  organizationId: string;
};

export type ProjectEventRecord = {
  id: string;
  organizationId: string;
  projectId: string;
  title: string;
  type: ProjectEventType;
  date: string;
  description: string | null;
  createdByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ProjectEventValues = {
  title: string;
  type: "legal";
  date: string;
  description: string | null;
};

export type CreateProjectEventInput = {
  title: string;
  type: "legal";
  date: string;
  description?: string | null;
};

export type UpdateProjectEventInput = Partial<CreateProjectEventInput>;
