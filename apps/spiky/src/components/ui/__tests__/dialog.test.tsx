import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { Dialog } from "@/components/ui/dialog";

afterEach(() => {
  cleanup();
});

describe("Dialog", () => {
  it("keeps closed dialogs out of the layout (no bare flex class)", () => {
    render(
      <Dialog open={false} onOpenChange={() => {}} title="Closed">
        <p>Hidden body</p>
      </Dialog>,
    );

    const dialog = document.querySelector("dialog");
    expect(dialog).toBeTruthy();
    expect(dialog!.open).toBe(false);

    const classes = dialog!.className.split(/\s+/).filter(Boolean);
    // Bare `flex` overrides UA/CSS hide and paints closed wizards into the page.
    expect(classes).not.toContain("flex");
    expect(classes).not.toContain("block");
    expect(classes).toContain("open:flex");
    expect(classes).toContain("open:flex-col");

    expect(getComputedStyle(dialog!).display).toBe("none");
  });

  it("still hides when a caller passes a stray flex className", () => {
    render(
      <Dialog
        open={false}
        onOpenChange={() => {}}
        title="Closed"
        className="flex w-[min(100%-2rem,36rem)]"
      >
        <p>Should stay hidden</p>
      </Dialog>,
    );

    const dialog = document.querySelector("dialog");
    expect(dialog).toBeTruthy();
    expect(dialog!.open).toBe(false);
    expect(getComputedStyle(dialog!).display).toBe("none");
  });

  it("calls showModal when open is true", () => {
    const showModal = vi.fn(function showModal(this: HTMLDialogElement) {
      this.setAttribute("open", "");
    });
    HTMLDialogElement.prototype.showModal = showModal;

    render(
      <Dialog open onOpenChange={() => {}} title="Edit">
        <p>Body</p>
      </Dialog>,
    );

    expect(showModal).toHaveBeenCalled();
  });
});
