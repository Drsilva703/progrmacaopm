<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Store the shared schedule in Cloud as one revisioned document; conditional updates and serialized operation replay prevent stale whole-document overwrites.
- Realtime notifications plus periodic refresh keep sessions current; pending edits block refresh and unload warns before unsaved work is lost.
- Browser-era data is imported only through an explicit whole-schedule replacement confirmation; never seed or normalize the shared dataset on page load.
- Size daily-sheet columns from rendered cell values and loaded fonts within CSS-defined per-column bounds; keep measurement browser-only and independent of schedule persistence.
- Store resource unavailabilities as an optional collection in the revisioned schedule document; share inclusive interval matching across the daily sheet, availability view and management screen to keep old schedules compatible without page-load normalization.
- Keep the daily-sheet title inside the table header, spanning the data columns from Pedido to Horário saída, so it stays centered on the schedule; in print hide the controls inside cells rather than the cells themselves so column alignment survives.
