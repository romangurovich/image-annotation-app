import { Bucket } from "encore.dev/storage/objects";

export const imagesBucket = new Bucket("images", {
  public: true,
});
