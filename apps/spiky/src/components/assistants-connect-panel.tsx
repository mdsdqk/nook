import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  mcpUrlConfigError,
  resolveMcpUrl,
} from "@/lib/mcp-url";

export function AssistantsConnectPanel() {
  const resolved = resolveMcpUrl(import.meta.env.VITE_MCP_URL);
  const configError = mcpUrlConfigError();
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const copyResetRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (copyResetRef.current !== null) {
        window.clearTimeout(copyResetRef.current);
      }
    };
  }, []);

  async function copyEndpoint() {
    if (!resolved.ok) return;
    setCopyError(null);
    try {
      await navigator.clipboard.writeText(resolved.endpoint);
      setCopied(true);
      if (copyResetRef.current !== null) {
        window.clearTimeout(copyResetRef.current);
      }
      copyResetRef.current = window.setTimeout(() => {
        setCopied(false);
        copyResetRef.current = null;
      }, 2000);
    } catch {
      setCopied(false);
      setCopyError("Could not copy - select the URL and copy manually.");
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-stack-lg">
      <section>
        <h2 className="text-title-md font-medium text-white">
          Let your AI talk to Nook
        </h2>
        <p className="mt-1 text-body-sm text-on-surface/55">
          Connect Claude or ChatGPT to Nook so you can ask about spending,
          balances, and what you own - right in the chat you already use.
        </p>
      </section>

      <section className="border-t border-white/5 pt-stack-md">
        <h3 className="text-label-caps text-on-surface-variant">
          MCP server URL
        </h3>
        {!resolved.ok ? (
          <p
            className="mt-3 rounded-md border border-error/40 px-3 py-3 text-body-sm text-error"
            role="alert"
          >
            {configError ?? "MCP URL is not configured."} Set{" "}
            <code className="font-mono text-[0.9em]">VITE_MCP_URL</code> on
            Spiky to your public MCP origin (no trailing slash).
          </p>
        ) : (
          <>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
              <code className="min-w-0 flex-1 break-all rounded-md border border-white/10 bg-white/[0.03] px-3 py-2.5 font-mono text-body-sm text-white">
                {resolved.endpoint}
              </code>
              <Button
                type="button"
                className="shrink-0"
                onClick={() => {
                  void copyEndpoint();
                }}
              >
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            {copyError ? (
              <p className="mt-2 text-body-sm text-error" role="alert">
                {copyError}
              </p>
            ) : null}
            {resolved.loopback ? (
              <p className="mt-2 text-body-sm text-on-surface/45">
                Loopback URL - fine for local MCP. Claude/ChatGPT custom
                connectors need a public HTTPS MCP origin.
              </p>
            ) : null}
          </>
        )}
      </section>

      <section className="border-t border-white/5 pt-stack-md">
        <h3 className="text-label-caps text-on-surface-variant">Claude</h3>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-body-sm text-on-surface/70">
          <li>
            Settings → Connectors → Add custom connector (wording may vary by
            plan).
          </li>
          <li>Paste the MCP server URL above.</li>
          <li>
            Leave OAuth Client ID and Client Secret blank (dynamic registration).
          </li>
          <li>
            Connect - approve access in Spiky as your signed-in user.
          </li>
        </ol>
      </section>

      <section className="border-t border-white/5 pt-stack-md">
        <h3 className="text-label-caps text-on-surface-variant">ChatGPT</h3>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-body-sm text-on-surface/70">
          <li>Add a custom MCP / connector with the same MCP server URL.</li>
          <li>
            Leave client id/secret blank unless your org requires static
            clients.
          </li>
          <li>Approve access in Spiky when prompted.</li>
        </ol>
      </section>

      <section className="border-t border-white/5 pt-stack-md">
        <h3 className="text-label-caps text-on-surface-variant">Scopes</h3>
        <ul className="mt-3 space-y-2 text-body-sm text-on-surface/70">
          <li>
            <code className="font-mono text-[0.9em] text-white/90">
              nook.read
            </code>{" "}
            - list accounts, transactions, statements, holdings.
          </li>
          <li>
            <code className="font-mono text-[0.9em] text-white/90">
              nook.write
            </code>{" "}
            - parse statements, sync ledger, record wealth updates.
          </li>
        </ul>
        <p className="mt-3 text-body-sm text-on-surface/45">
          Paste the URL into a custom connector. After that, you can manage
          your money from that chat whenever you like.
        </p>
      </section>
    </div>
  );
}
