import type { ContentBlock, ContentBlockType } from "@municipalos/validation";

export const BLOCK_LABELS: Record<ContentBlockType, string> = {
  heading: "Heading",
  text: "Text",
  callout: "Callout",
  links: "Link list",
  contact: "Contact card",
  service_links: "Service buttons",
};

export const BLOCK_HELP: Record<ContentBlockType, string> = {
  heading: "A section title.",
  text: "One or more paragraphs of plain text.",
  callout: "A highlighted notice or warning.",
  links: "A list of links to pages, forms or other websites.",
  contact: "Name, phone, email, address and hours.",
  service_links: "Buttons to “Report a problem” and “Track a request”.",
};

export function newBlock(type: ContentBlockType, id: string): ContentBlock {
  switch (type) {
    case "heading":
      return { type, id, text: "", level: 2 };
    case "text":
      return { type, id, text: "" };
    case "callout":
      return { type, id, tone: "info", text: "" };
    case "links":
      return { type, id, items: [{ label: "", url: "" }] };
    case "contact":
      return { type, id, name: "" };
    case "service_links":
      return { type, id };
  }
}
