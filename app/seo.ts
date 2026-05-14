export const SITE_URL = "https://scrolltee.vercel.app";
export const SITE_NAME = "Scroll Tee";
export const SITE_DEFAULT_TITLE = "Scroll Tee";
export const SITE_DESCRIPTION =
  "Play Scroll Tee, a free arcade golf game built for browser controls, mouse-wheel swings, and quick mobile rounds.";

export const SITE_KEYWORDS = [
  "Scroll Tee",
  "browser golf game",
  "arcade golf game",
  "mouse wheel golf game",
  "free web golf game",
  "mobile golf game"
];

export const SOCIAL_IMAGE_ALT =
  "Scroll Tee arcade golf preview with a dramatic fairway, golf ball, club, flag, shot trail, and local multiplayer colors.";

export const structuredData = {
  "@context": "https://schema.org",
  "@type": ["WebApplication", "VideoGame"],
  name: SITE_NAME,
  description: SITE_DESCRIPTION,
  url: SITE_URL,
  applicationCategory: "GameApplication",
  operatingSystem: "Any modern web browser",
  browserRequirements: "Requires JavaScript and WebGL.",
  genre: ["Arcade", "Golf", "Sports"],
  gamePlatform: "Web browser",
  isAccessibleForFree: true,
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD"
  }
};
