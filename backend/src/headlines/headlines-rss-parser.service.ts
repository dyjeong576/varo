import { Injectable } from "@nestjs/common";
import { XMLParser } from "fast-xml-parser";
import { ParsedHeadlineItem } from "./headlines.types";

@Injectable()
export class HeadlinesRssParserService {
  private readonly parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    textNodeName: "#text",
  });

  parse(xml: string): ParsedHeadlineItem[] {
    const parsed = this.parser.parse(xml) as Record<string, unknown>;
    const items = this.readItems(parsed);

    return items
      .map((item) => this.toHeadlineItem(item))
      .filter((item): item is ParsedHeadlineItem => item !== null);
  }

  private readItems(parsed: Record<string, unknown>): Record<string, unknown>[] {
    const rss = parsed.rss as { channel?: { item?: unknown } } | undefined;
    const atom = parsed.feed as { entry?: unknown } | undefined;

    return this.toArray(rss?.channel?.item ?? atom?.entry);
  }

  private toHeadlineItem(item: Record<string, unknown>): ParsedHeadlineItem | null {
    const title = this.cleanText(this.readText(item.title));
    const url = this.readUrl(item);

    if (!title || !url) {
      return null;
    }

    return {
      title,
      url,
      summary: this.cleanText(
        this.readText(item.description) ||
          this.readText(item.summary) ||
          this.readText(item.content),
      ) || null,
      publishedAt: this.readDate(item.pubDate) ?? this.readDate(item.published) ?? this.readDate(item.updated),
      rawItem: item,
    };
  }

  private readUrl(item: Record<string, unknown>): string {
    const link = item.link;

    if (typeof link === "string") {
      return link.trim();
    }

    if (link && typeof link === "object") {
      const href = (link as { "@_href"?: unknown })["@_href"];

      if (typeof href === "string") {
        return href.trim();
      }

      const text = this.readText(link);

      if (text) {
        return text.trim();
      }
    }

    return this.readText(item.guid).trim();
  }

  private readText(value: unknown): string {
    if (typeof value === "string" || typeof value === "number") {
      return String(value);
    }

    if (value && typeof value === "object") {
      const text = (value as { "#text"?: unknown })["#text"];

      if (typeof text === "string" || typeof text === "number") {
        return String(text);
      }
    }

    return "";
  }

  private readDate(value: unknown): Date | null {
    const text = this.readText(value).trim();

    if (!text) {
      return null;
    }

    const date = new Date(text);

    return Number.isNaN(date.getTime()) ? null : date;
  }

  private toArray(value: unknown): Record<string, unknown>[] {
    if (Array.isArray(value)) {
      return value.filter(
        (item): item is Record<string, unknown> => !!item && typeof item === "object",
      );
    }

    if (value && typeof value === "object") {
      return [value as Record<string, unknown>];
    }

    return [];
  }

  private cleanText(value: string): string {
    return value
      .replace(/<!\[CDATA\[(.*?)\]\]>/gs, "$1")
      .replace(/<[^>]*>/g, " ")
      .replace(/&quot;/g, "\"")
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/\s+/g, " ")
      .trim();
  }
}
