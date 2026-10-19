import { useEffect, useRef } from "react";

/** Measure visible cell values, never the unselected options of a menu. */
export function useSheetColumnWidths() {
  const ref = useRef<HTMLTableElement>(null);

  useEffect(() => {
    const table = ref.current;
    if (!table) return;
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) return;
    let frame = 0;
    let disposed = false;

    const measure = () => {
      const columns = Array.from(table.querySelectorAll("col"));
      const widths = columns.map((column, index) => {
        const limits = getComputedStyle(column);
        const min = parseFloat(limits.getPropertyValue("--column-min"));
        const max = parseFloat(limits.getPropertyValue("--column-max"));
        let width = min;
        for (const row of Array.from(table.rows)) {
          const cell = row.cells[index];
          if (!cell || cell.colSpan !== 1) continue;
          const control = cell.querySelector("input:not([type=checkbox]), select");
          const element = control ?? cell;
          const style = getComputedStyle(element);
          context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
          let text = cell.textContent?.trim() ?? "";
          let extra = 0;
          if (control instanceof HTMLSelectElement) {
            text = control.selectedOptions[0]?.text ?? "";
            control.title = text;
          } else if (control instanceof HTMLInputElement) {
            text = control.value || control.placeholder;
            if (control.type === "date" && control.value) {
              text = control.value.split("-").reverse().join("/");
            }
            extra = control.type === "date" || control.type === "time" ? 36 : control.type === "number" ? 22 : 0;
            control.title = text;
          }
          const padding = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
          width = Math.max(width, Math.ceil(context.measureText(text).width + padding + extra + 12));
        }
        const result = Math.min(max, Math.max(min, width));
        column.style.width = `${result}px`;
        return result;
      });
      table.style.width = `${widths.reduce((sum, width) => sum + width, 0)}px`;
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    schedule();
    // Typing resizes an unsaved input too, without changing its save behavior.
    table.addEventListener("input", schedule);
    table.addEventListener("change", schedule);
    document.fonts.ready.then(() => { if (!disposed) schedule(); });
    document.fonts.addEventListener("loadingdone", schedule);
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      table.removeEventListener("input", schedule);
      table.removeEventListener("change", schedule);
      document.fonts.removeEventListener("loadingdone", schedule);
    };
  });

  return ref;
}