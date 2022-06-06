import { Model, Optional } from "sequelize";

type ProjectAttributes = {
  id: number;
  name?: string;
  version?: string | number;
  revision?: number;
};

type UserAttributes = {
  id: number;
  name: string;
};

export class Project extends Model<
  ProjectAttributes,
  Optional<ProjectAttributes, "id">
> {
  declare id: number;
  declare name?: string;
  declare version?: string | number;
  declare revision?: number;
}

export class User extends Model<
  UserAttributes,
  Optional<UserAttributes, "id">
> {
  declare id: number;
  declare name: string;
}
