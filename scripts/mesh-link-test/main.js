import { createLink } from "@meshconnect/web-link-sdk";

const res = await fetch("/link-token", { cache: "no-store" });
if (!res.ok) {
  throw new Error(await res.text());
}
const { linkToken } = await res.json();

const connection = createLink({
  renderType: "overlay",
  theme: "system",
});

connection.openLink(linkToken);
