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

## Updating the bundled bot

After running a training session in `bot-trainer/`:

```bash
cp ../bot-trainer/output/best_weights.json ../bot-trainer/output/training_history.json public/data/
```

Refresh the app — the Bot Match tab and Training Lab tab both read directly from those two files.
