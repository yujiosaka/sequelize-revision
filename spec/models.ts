import { Model } from "sequelize";
import type { CreationOptional, InferAttributes, InferCreationAttributes } from "sequelize";

export class Project extends Model<InferAttributes<Project>, InferCreationAttributes<Project>> {
  declare id: CreationOptional<number>;
  declare name?: string | null;
  declare version?: string | number | null;
  declare revision?: number | null;
  declare info?: object | null;
}

export class ProjectSetting extends Model<InferAttributes<ProjectSetting>, InferCreationAttributes<ProjectSetting>> {
  declare project_id: CreationOptional<number>;
  declare key: CreationOptional<string>;
  declare value: string | number;
  declare revision?: number | null;
}

export class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
  declare id: CreationOptional<number>;
  declare name: string;
}
