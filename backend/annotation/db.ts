import { SQLDatabase } from "encore.dev/storage/sqldb";

export const annotationDB = new SQLDatabase("annotation", {
  migrations: "./migrations",
});
