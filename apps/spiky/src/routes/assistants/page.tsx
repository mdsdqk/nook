import { AssistantsConnectPanel } from "@/components/assistants-connect-panel";

export function AssistantsPage() {
  return (
    <>
      <header className="hidden h-14 shrink-0 items-center border-b border-white/5 px-page md:flex">
        <h1 className="text-title-md font-medium text-white">Assistants</h1>
      </header>

      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto px-page py-stack-md">
        <p className="mb-stack-md text-body-sm text-on-surface/55 md:hidden">
          Ask Claude or ChatGPT about your money.
        </p>
        <AssistantsConnectPanel />
      </main>
    </>
  );
}
