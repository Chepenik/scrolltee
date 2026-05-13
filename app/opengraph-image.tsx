import { ImageResponse } from "next/og";
import { SOCIAL_IMAGE_ALT } from "./seo";
import { ScrollTeeSocialImage, SOCIAL_IMAGE_SIZE } from "./social-image";

export const alt = SOCIAL_IMAGE_ALT;
export const size = SOCIAL_IMAGE_SIZE;
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(<ScrollTeeSocialImage />, {
    ...SOCIAL_IMAGE_SIZE
  });
}
