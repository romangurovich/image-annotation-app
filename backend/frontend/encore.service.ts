import { api } from "encore.dev/api";
import { Service } from "encore.dev/service";

export default new Service("frontend");

export const assetsRoot = api.static({
  path: "/!path",
  expose: true,
  dir: "./dist",
  notFound: "./dist/index.html",
  notFoundStatus: 200,
});

export const assetsFrontend = api.static({
  path: "/frontend/*path",
  expose: true,
  dir: "./dist",
  notFound: "./dist/index.html",
  notFoundStatus: 200,
});
