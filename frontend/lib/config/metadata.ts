import type { Metadata } from "next";
import { APP_DESCRIPTION, APP_NAME, APP_TAGLINE, getMetadataBase } from "./app";

function buildMetadataDescription(description?: string): string {
  return description ?? APP_DESCRIPTION;
}

function buildMetadataTitle(title?: string): string {
  return title ? `${title} | ${APP_NAME}` : APP_NAME;
}

export function buildPageMetadata(title?: string, description?: string): Metadata {
  const resolvedTitle = buildMetadataTitle(title);
  const resolvedDescription = buildMetadataDescription(description);

  return {
    title: resolvedTitle,
    description: resolvedDescription,
    openGraph: {
      title: resolvedTitle,
      description: resolvedDescription,
      siteName: APP_NAME,
    },
    twitter: {
      card: "summary",
      title: resolvedTitle,
      description: resolvedDescription,
    },
  };
}

export const rootMetadata: Metadata = {
  metadataBase: getMetadataBase(),
  applicationName: APP_NAME,
  title: APP_NAME,
  description: `${APP_NAME}, ${APP_TAGLINE}. ${APP_DESCRIPTION}`,
  openGraph: {
    title: APP_NAME,
    description: `${APP_NAME}, ${APP_TAGLINE}. ${APP_DESCRIPTION}`,
    siteName: APP_NAME,
  },
  twitter: {
    card: "summary",
    title: APP_NAME,
    description: `${APP_NAME}, ${APP_TAGLINE}. ${APP_DESCRIPTION}`,
  },
};
