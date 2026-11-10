/**
 * Outbound message delivery. Notification *records* live in the database (`notifications` table)
 * and are written by the API inside the same transaction as the change that caused them. This
 * package only defines how a queued email leaves the system.
 *
 * No real email provider is configured yet: `ConsoleEmailTransport` logs the message so the
 * workflow is observable in development. A provider-backed transport implements the same
 * interface.
 */
export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
}

export interface EmailTransport {
  readonly name: string;
  send(message: EmailMessage): Promise<void>;
}

export class ConsoleEmailTransport implements EmailTransport {
  readonly name = "console";
  async send(message: EmailMessage): Promise<void> {
    console.info(
      `[email:console] to=${redactEmail(message.to)} subject=${JSON.stringify(message.subject)}`,
    );
  }
}

/** Captures messages in memory; used by automated tests. */
export class MemoryEmailTransport implements EmailTransport {
  readonly name = "memory";
  readonly sent: EmailMessage[] = [];
  async send(message: EmailMessage): Promise<void> {
    this.sent.push(message);
  }
}

export function redactEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "***";
  return `${local.slice(0, 1)}***@${domain}`;
}

export interface ResidentUpdateInput {
  municipalityName: string;
  reference: string;
  categoryName: string;
  headline: string;
  message?: string | null;
  trackingUrl?: string | null;
}

export function residentUpdateEmail(input: ResidentUpdateInput): Omit<EmailMessage, "to"> {
  const lines = [
    `${input.municipalityName} — request ${input.reference} (${input.categoryName})`,
    "",
    input.headline,
  ];
  if (input.message) lines.push("", input.message);
  if (input.trackingUrl) lines.push("", `Track this request: ${input.trackingUrl}`);
  lines.push("", "This mailbox is not monitored. For emergencies call 911.");
  return { subject: `${input.headline} — ${input.reference}`, text: lines.join("\n") };
}
