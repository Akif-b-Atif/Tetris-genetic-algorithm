# Tetris & the Evolutionary Bot

A guideline-compliant, from-scratch Tetris implementation, paired with a bot that plays it by
scoring every legal placement against a hand-designed evaluation function whose weights were
tuned offline with a genetic algorithm.

The project is split into two halves that only communicate through a JSON file:

| Part | Location | Language | Job |
|---|---|---|---|
| Game + live bot | [`web/`](web) | TypeScript / React | Playable Tetris, and a bot that plays it in real time using pretrained weights |
| Weight trainer | [`bot-trainer/`](bot-trainer) | Python | A headless copy of the same rules, used to run the genetic algorithm and export a weight vector |

The Python trainer never runs in the browser and the web app never trains anything live — it
loads the result of a training run (`best_weights.json`, `training_history.json`) and plays with
it. See [`docs/DESIGN.md`](docs/DESIGN.md) for the reasoning behind that split, the feature set,
the evaluation function, and the genetic algorithm itself.

## Quick start

Play the game and watch the bot without touching Python at all — a pretrained weight vector
ships in the repo:

```bash
cd web
npm install
npm run dev
```

Open the printed local URL. Three tabs are available: **Play** (you), **Bot match** (the pretrained
bot, with its move-by-move reasoning shown alongside the board), and **Training lab** (the fitness
curve and final weights from the run that produced the bundled bot).

## Training your own bot

```bash
cd bot-trainer
python train.py --population 40 --generations 40 --games 3
cp output/best_weights.json output/training_history.json ../web/public/data/
```

`python train.py --smoke-test` runs a tiny end-to-end pass (six individuals, three generations)
to confirm the pipeline works before committing to a longer run. See
[`bot-trainer/README.md`](bot-trainer/README.md) for every tunable parameter.

Both output files are rewritten after every generation, not just once at the end — see ["Live
output"](bot-trainer/README.md#live-output) in `bot-trainer/README.md`.

By default every run starts from a random population. To seed training from an existing weight
vector instead — e.g. to keep evolving a previous run's result rather than starting over — pass
`--init-weights`:

```bash
python train.py --init-weights                           # use bot-trainer/init_weights/default.json
python train.py --init-weights output/best_weights.json  # continue a previous run
```

See ["Starting training from existing
weights"](bot-trainer/README.md#starting-training-from-existing-weights) in
`bot-trainer/README.md` for the file format and how seeding interacts with mutation.

## Repository layout

```
web/            Tetris + bot inference, React/TypeScript, runs entirely client-side
bot-trainer/    Python engine + genetic algorithm, run from the command line
docs/           Design and theory documentation
```

## Documentation

- [`docs/DESIGN.md`](docs/DESIGN.md) — full design document: game rules, feature extraction,
  evaluation function, and the genetic algorithm, with the reasoning behind each choice.
- [`web/README.md`](web/README.md) — running, building, and the structure of the web app.
- [`bot-trainer/README.md`](bot-trainer/README.md) — running the trainer and every CLI flag.
