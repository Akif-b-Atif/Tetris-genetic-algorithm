# Web App

The playable game, and the bot's live inference, both running entirely client-side in
TypeScript and React. This app never trains anything — it loads a pretrained weight vector from
`public/data/best_weights.json` and plays with it. See [`../bot-trainer/`](../bot-trainer) for the
half of the project that produces that file, and [`../docs/DESIGN.md`](../docs/DESIGN.md) for the
full design rationale.

## Running locally

```bash
npm install
npm run dev
```

## Building

```bash
npm run build
```

Output goes to `dist/`, a fully static bundle — no server component is needed to host it.

## Structure

```
src/engine/         board, pieces, SRS rotation/kicks, 7-bag, the Game state machine
src/engine/humanControl.ts   the extra state human play needs: live cursor, gravity, lock delay
src/bot/             feature extraction, the evaluation function, exhaustive placement search
src/ui/              React components: the board canvas, side panels, and the three tabs
public/data/         the pretrained weight vector and training history the bot and dashboard read
```

`src/engine` and `src/bot` are framework-agnostic — nothing in either directory imports React.
That split is what makes it possible to unit-test the engine and search headlessly, and it keeps
the door open to reusing them outside this particular UI.

### Locking a piece: always pass its real row

`Game.apply()` takes a `Placement`. For interactive play, always include `row`: the piece's
actual current row, exactly as `HumanControl` is already tracking it. Interactive play routes
through `HumanControl`, which does this for you — `hold()` and any direct calls into `Game.apply()`
outside of `HumanControl` should follow the same rule. Omitting `row` tells `Game.apply()` to fall
back to a straight hard drop from spawn, which is only correct for a placement that really is a
straight drop from spawn (the bot's search never performs tucks or slides, so it's the only caller
that omits `row`). Any placement reached by moving sideways after the piece has already fallen
past an overhang — a T-spin tuck, or any similar slide — needs the explicit row, or the piece will
lock several rows too high, on top of the overhang instead of in the notch beneath it. See the
"Tucks and slides" note in [`../docs/DESIGN.md`](../docs/DESIGN.md) for the full explanation, and
`src/engine/__tests__/tuck.test.ts` for a regression test covering it.

## Updating the bundled bot

After running a training session in `bot-trainer/`:

```bash
cp ../bot-trainer/output/best_weights.json ../bot-trainer/output/training_history.json public/data/
```

Refresh the app — the Bot Match tab and Training Lab tab both read directly from those two files.
