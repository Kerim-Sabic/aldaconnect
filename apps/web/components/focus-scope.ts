/** Keep keyboard focus inside an open workspace dialog or mobile drawer. */
export function focusScope(container: HTMLElement, dismiss: () => void) {
  const previous = document.activeElement;
  const previousOverflow = document.body.style.overflow;
  const selector =
    'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary, [tabindex="0"]';
  const controls = () =>
    Array.from(container.querySelectorAll<HTMLElement>(selector)).filter(
      (element) =>
        element.getClientRects().length > 0 &&
        getComputedStyle(element).visibility !== "hidden",
    );
  document.body.style.overflow = "hidden";
  (controls()[0] ?? container).focus({ preventScroll: true });
  const onKey = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      dismiss();
    }
    if (event.key !== "Tab") return;
    const items = controls();
    const first = items[0];
    const last = items.at(-1);
    if (!first || !last) {
      event.preventDefault();
      container.focus();
    } else if (
      event.shiftKey &&
      (document.activeElement === first ||
        !container.contains(document.activeElement))
    ) {
      event.preventDefault();
      last.focus();
    } else if (
      !event.shiftKey &&
      (document.activeElement === last ||
        !container.contains(document.activeElement))
    ) {
      event.preventDefault();
      first.focus();
    }
  };
  document.addEventListener("keydown", onKey);
  return () => {
    document.removeEventListener("keydown", onKey);
    document.body.style.overflow = previousOverflow;
    if (previous instanceof HTMLElement && previous.isConnected)
      previous.focus({ preventScroll: true });
    else document.getElementById("main")?.focus({ preventScroll: true });
  };
}
