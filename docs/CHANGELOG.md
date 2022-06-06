# [5.1.0](https://github.com/yujiosaka/sequelize-revision/compare/v5.0.2...v5.1.0) (2022-06-06)


### Bug Fixes

* stop exposing undocument options ([20ba4ae](https://github.com/yujiosaka/sequelize-revision/commit/20ba4aef1423fb7569f2146f4fd340d65d1f8bd8))


### Features

* use debug module for logging ([d426758](https://github.com/yujiosaka/sequelize-revision/commit/d426758940b0c9faa03bfbb356bd6bb62801d2a5))
* use underscored attributes for timestamps ([ee6fe21](https://github.com/yujiosaka/sequelize-revision/commit/ee6fe21d3f53cfc8c0c25915220b267274ef8c53))

## [5.0.2](https://github.com/yujiosaka/sequelize-revision/compare/v5.0.1...v5.0.2) (2022-05-31)


### Bug Fixes

* fix diff package missed in dependencies ([86639e6](https://github.com/yujiosaka/sequelize-revision/commit/86639e6c67ff5def049adb3e1760746b8195550e))

## [5.0.1](https://github.com/yujiosaka/sequelize-revision/compare/v5.0.0...v5.0.1) (2022-05-19)


### Bug Fixes

* remove default value from external key model definition ([bf4dbc3](https://github.com/yujiosaka/sequelize-revision/commit/bf4dbc3e5bb04a5bbf10246a03337b04beb6a850))

# [5.0.0](https://github.com/yujiosaka/sequelize-revision/compare/v4.0.0...v5.0.0) (2022-05-19)


### Bug Fixes

* remove default value from external key ([e1364ef](https://github.com/yujiosaka/sequelize-revision/commit/e1364efc334b18e51557545686e2453b7e281154))


### BREAKING CHANGES

* default value is no longer set for external key for migrations

# [4.0.0](https://github.com/yujiosaka/sequelize-revision/compare/v3.1.0...v4.0.0) (2022-04-13)


### Bug Fixes

* use INTEGER data type for documentId by default ([8852a67](https://github.com/yujiosaka/sequelize-revision/commit/8852a6744a56fb99893d0a0ecea03a53dc241c44))
* use medium length TEXT data type for document and diff ([8eff381](https://github.com/yujiosaka/sequelize-revision/commit/8eff3810877daf83b3c3b02fe8b9572b08adfd85))


### Features

* support `changeTableName` option ([8bc7304](https://github.com/yujiosaka/sequelize-revision/commit/8bc730487e40d507b698f53298efb2e391bbe7a3))
* support `useJsonDataType` option ([6a16778](https://github.com/yujiosaka/sequelize-revision/commit/6a1677887dd5d3c4b5099ff1d31e4f17333be9fd))


### Performance Improvements

* use STRING data type for storing model ([ed375ac](https://github.com/yujiosaka/sequelize-revision/commit/ed375ac685d6581bf6ae0f168e674181e96067f3))


### BREAKING CHANGES

* JSON data type is used by default unless you disable it

# [3.1.0](https://github.com/yujiosaka/sequelize-revision/compare/v3.0.2...v3.1.0) (2022-04-12)


### Bug Fixes

* improve typing ([91d2268](https://github.com/yujiosaka/sequelize-revision/commit/91d2268ac763a5c02bb26b1963ba627fb8dd1024))
* make models attributes public ([56d11c5](https://github.com/yujiosaka/sequelize-revision/commit/56d11c5ab7bfd864c73cc3018f015d35baefadee))


### Features

* make models accessible from the instance ([eb94871](https://github.com/yujiosaka/sequelize-revision/commit/eb94871ed07e2cb5feda9d7fc578bfb1fb7b53b0))
* support saving meta data ([b61394a](https://github.com/yujiosaka/sequelize-revision/commit/b61394a956070499b38968aaf6e8bcdc2246b4e5))

## [3.0.2](https://github.com/yujiosaka/sequelize-revision/compare/v3.0.1...v3.0.2) (2022-04-11)


### Bug Fixes

* retry automate changelog ([a87d1bf](https://github.com/yujiosaka/sequelize-revision/commit/a87d1bfa7e5c3a852f0ba20ba1652c0f735eebd8))
