import { BelongsToOptions } from "sequelize";

export interface Options {
  debug: boolean;
  log?: (...data: any[]) => void;
  exclude: string[];
  revisionAttribute: string;
  revisionModel: string;
  revisionChangeModel: string;
  enableRevisionChangeModel: boolean;
  UUID: boolean;
  underscored: boolean;
  underscoredAttributes: boolean;
  defaultAttributes: {
    documentId: string;
    revisionId: string;
  };
  userModel?: string;
  userModelAttribute: string;
  enableCompression: boolean;
  enableMigration: boolean;
  enableStrictDiff: boolean;
  continuationNamespace?: string;
  continuationKey: string;
  metaDataFields?: { [key: string]: boolean };
  metaDataContinuationKey: string;
  postgres: boolean;
  tableName?: string;
  belongsToUserOptions?: BelongsToOptions;
}

export type SequelizeRevisionOptions = Partial<Options>;

export const defaultOptions = {
  debug: false,
  log: undefined,
  exclude: [
    "id",
    "createdAt",
    "updatedAt",
    "deletedAt",
    "created_at",
    "updated_at",
    "deleted_at",
    "revision",
  ],
  revisionAttribute: "revision",
  revisionModel: "Revision",
  revisionChangeModel: "RevisionChange",
  enableRevisionChangeModel: false,
  UUID: false,
  underscored: false,
  underscoredAttributes: false,
  defaultAttributes: {
    documentId: "documentId",
    revisionId: "revisionId",
  },
  userModel: undefined,
  userModelAttribute: "userId",
  enableCompression: false,
  enableMigration: false,
  enableStrictDiff: true,
  continuationNamespace: undefined,
  continuationKey: "userId",
  metaDataFields: undefined,
  metaDataContinuationKey: "metaData",
  postgres: false,
  tableName: undefined,
  belongsToUserOptions: undefined,
};
