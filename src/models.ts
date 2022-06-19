import type { Model, Optional } from "sequelize";
import type { Options } from "./options";
import type { CamelToSnakeCase } from "./util-types";

type TimestampAttributes<O extends Partial<Options>> = {
  [CreatedAt in O["underscoredAttributes"] extends true
    ? CamelToSnakeCase<"createdAt">
    : "createdAt"]: Date;
} & {
  [UpdatedAt in O["underscoredAttributes"] extends true
    ? CamelToSnakeCase<"updatedAt">
    : "updatedAt"]: Date;
};

type RevisionAttributes<O extends Partial<Options>> = {
  id: O["UUID"] extends true ? string : number;
  model: string;
  document: O["useJsonDataType"] extends true ? object : string;
  operation: string;
} & {
  [Revision in O["revisionAttribute"] extends string
    ? O["revisionAttribute"]
    : "revision"]: number;
} & {
  [DocumentId in O["underscoredAttributes"] extends true
    ? CamelToSnakeCase<"documentId">
    : "documentId"]: O["UUID"] extends true ? string : number;
} & {
  [UserId in O["userModel"] extends string
    ? O["userIdAttribute"] extends string
      ? O["underscoredAttributes"] extends true
        ? CamelToSnakeCase<O["userIdAttribute"]>
        : O["userIdAttribute"]
      : O["underscoredAttributes"] extends true
      ? CamelToSnakeCase<"userId">
      : "userId"
    : never]: O["UUID"] extends true ? string : number;
} & TimestampAttributes<O>;

type RevisionCreationAttributes<O extends Partial<Options>> = Optional<
  RevisionAttributes<O>,
  "id"
>;

export type Revision<O extends Partial<Options>> = Model<
  RevisionAttributes<O>,
  RevisionCreationAttributes<O>
> &
  RevisionAttributes<O>;

type RevisionChangeAttributes<O extends Partial<Options>> = {
  id: O["UUID"] extends true ? string : number;
  path: string;
  document: O["useJsonDataType"] extends true ? object : string;
  diff: O["useJsonDataType"] extends true ? object : string;
} & {
  [RevisionId in O["revisionIdAttribute"] extends string
    ? O["underscoredAttributes"] extends true
      ? CamelToSnakeCase<O["revisionIdAttribute"]>
      : O["revisionIdAttribute"]
    : O["underscoredAttributes"] extends true
    ? CamelToSnakeCase<"revisionId">
    : "revisionId"]: O["UUID"] extends true ? string : number;
} & TimestampAttributes<O>;

type RevisionChangeCreationAttributes<O extends Partial<Options>> = Optional<
  RevisionChangeAttributes<O>,
  "id"
>;

export type RevisionChange<O extends Partial<Options>> = Model<
  RevisionChangeAttributes<O>,
  RevisionChangeCreationAttributes<O>
> &
  RevisionChangeAttributes<O>;
