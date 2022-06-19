import type { Model, Optional } from "sequelize";
import type { SequelizeRevisionOptions } from "./options";
import type { CamelToSnakeCase } from "./util-types";

type TimestampAttributes<O extends SequelizeRevisionOptions> = {
  [CreatedAt in O["underscoredAttributes"] extends true
    ? CamelToSnakeCase<"createdAt">
    : "createdAt"]: Date;
} & {
  [UpdatedAt in O["underscoredAttributes"] extends true
    ? CamelToSnakeCase<"updatedAt">
    : "updatedAt"]: Date;
};

type MetaDataAttributes<O extends SequelizeRevisionOptions> = {
  [Field in keyof O["metaDataFields"]]: any;
};

type RevisionAttributes<O extends SequelizeRevisionOptions> = {
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
} & MetaDataAttributes<O> &
  TimestampAttributes<O>;

type RevisionCreationAttributes<O extends SequelizeRevisionOptions> = Optional<
  RevisionAttributes<O>,
  "id"
>;

export type Revision<O extends SequelizeRevisionOptions> = Model<
  RevisionAttributes<O>,
  RevisionCreationAttributes<O>
> &
  RevisionAttributes<O>;

type RevisionChangeAttributes<O extends SequelizeRevisionOptions> = {
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

type RevisionChangeCreationAttributes<O extends SequelizeRevisionOptions> =
  Optional<RevisionChangeAttributes<O>, "id">;

export type RevisionChange<O extends SequelizeRevisionOptions> = Model<
  RevisionChangeAttributes<O>,
  RevisionChangeCreationAttributes<O>
> &
  RevisionChangeAttributes<O>;
