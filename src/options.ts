import { BelongsToOptions } from "sequelize";

export interface Options {
  exclude: string[];
  revisionAttribute: string;
  revisionIdAttribute: string;
  revisionModel: string;
  revisionChangeModel: string;
  enableRevisionChangeModel: boolean;
  UUID: boolean;
  underscored: boolean;
  underscoredAttributes: boolean;
  userModel?: string;
  userIdAttribute: string;
  enableCompression: boolean;
  enableMigration: boolean;
  enableStrictDiff: boolean;
  continuationNamespace?: string;
  continuationKey: string;
  metaDataFields?: { [key: string]: boolean };
  metaDataContinuationKey: string;
  tableName?: string;
  changeTableName?: string;
  belongsToUserOptions?: BelongsToOptions;
}

export const defaultOptions: Options = {
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
  revisionIdAttribute: "revisionId",
  revisionModel: "Revision",
  revisionChangeModel: "RevisionChange",
  enableRevisionChangeModel: false,
  UUID: false,
  underscored: false,
  underscoredAttributes: false,
  userModel: undefined,
  userIdAttribute: "userId",
  enableCompression: false,
  enableMigration: false,
  enableStrictDiff: true,
  continuationNamespace: undefined,
  continuationKey: "userId",
  metaDataFields: undefined,
  metaDataContinuationKey: "metaData",
  tableName: undefined,
  changeTableName: undefined,
  belongsToUserOptions: undefined,
};
