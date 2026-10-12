export type ClientType = "person" | "company";

export type ClientRecord = {
  id: string;
  organizationId: string;
  type: ClientType;
  name: string;
  documentType: string | null;
  documentNumber: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type OptionalClientField = string | null | undefined;

export type CreateClientInput = {
  type: ClientType;
  name: string;
  documentType?: OptionalClientField;
  documentNumber?: OptionalClientField;
  email?: OptionalClientField;
  phone?: OptionalClientField;
  address?: OptionalClientField;
  notes?: OptionalClientField;
};

export type UpdateClientInput = Partial<CreateClientInput>;

export type ClientValues = {
  type: ClientType;
  name: string;
  documentType: string | null;
  documentNumber: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
};

export type ClientPatchValues = Partial<ClientValues>;

export type ClientActor = {
  userId: string;
  organizationId: string;
};

export type ClientFilters = {
  search?: string;
  type?: ClientType;
  page?: number;
  pageSize?: number;
};

export type ClientListFilters = {
  search?: string;
  type?: ClientType;
  page: number;
  pageSize: number;
};

export type ClientPagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};
