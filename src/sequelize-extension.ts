import "sequelize";

declare module "sequelize" {
  interface Hookable {
    noRevision?: boolean;
    userId?: any;
  }
}
