import "@tanstack/react-start/server-only";
import { Resend } from "resend";
import { bindings, required } from "./env";
export async function sendAccountEmail(
  to: string,
  subject: string,
  text: string,
) {
  const e = bindings();
  const result = await new Resend(
    required(e.RESEND_API_KEY, "RESEND_API_KEY"),
  ).emails.send({
    from: required(e.EMAIL_FROM, "EMAIL_FROM"),
    to,
    subject,
    text,
  });
  if (result.error) throw new Error("Email delivery failed");
}
