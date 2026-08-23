# Bot Trainer

A standalone, headless copy of the game's rules, used to run the genetic algorithm that produces
the bot's evaluation weights. Nothing in this directory runs in a browser; it exists purely to be
run from the command line and produce a JSON file.

See [`../docs/DESIGN.md`](../docs/DESIGN.md) for the reasoning behind the feature set, the
evaluation function, and the genetic algorithm's defaults.

## Requirements

Python 3.9 or newer. No third-party dependencies — everything here is standard library, on
purpose, so training doesn't require setting up an environment.

## Running a training session

```bash
python train.py
```

With no arguments this runs a moderate default session (24 individuals, up to 15 generations, 2
games per individual per generation) and writes `output/best_weights.json` and
`output/training_history.json`. Copy both into `web/public/data/` to update what the web app
plays with and displays.

To verify the pipeline works end-to-end before committing to a long run:

```bash
python train.py --smoke-test
```

### CLI options

| Flag | Default | Meaning |
|---|---|---|
| `--population` | 24 | Individuals per generation |
| `--generations` | 15 | Maximum generations to run |
| `--games` | 2 | Games played per individual, per generation (averaged for a less noisy fitness signal) |
| `--piece-cap` | 200 | Pieces placed before a game is cut off, win or lose |
| `--tournament-size` | 4 | Contenders sampled per tournament-selection draw |
| `--elitism` | 2 | Top individuals carried unchanged into the next generation |
| `--mutation-rate` | 0.12 | Chance any given weight is mutated in a child |
| `--mutation-sigma` | 0.25 | Standard deviation of the Gaussian noise added on mutation |
| `--seed` | none | Fix the RNG seed for a reproducible run |
| `--out-dir` | `output` | Where the two JSON files are written |

Training stops early if the best fitness in the population plateaus for several generations in a
row — see `plateau_patience` in `ga/trainer.py` if you want to change that patience.

## Running the tests

```bash
python tests/test_engine.py
```

A small set of assertion-based checks against hand-built board states (a board with exactly one
known hole should report `holes == 1`, and so on), plus one full headless game run through the
search and applied end to end. No test framework is required.

## Layout

```
engine/     board, pieces, SRS rotation/kicks, 7-bag, line clears, the Game state machine
bot/        feature extraction, the linear evaluation function, the exhaustive placement search
ga/         the individual representation and the genetic algorithm's generation loop
train.py    command-line entry point
tests/      assertion-based correctness checks
```

## A note on performance

A single 200-piece game with one-ply search takes well under a second. The real cost is
`games_per_individual x population_size x generations` — a session with the defaults above and 40
generations is on the order of a few thousand simulated games. This is pure-Python and
single-threaded by design (see the root design doc for why Python was chosen for this half of the
project at all); if you want to scale up population size or generation count substantially,
parallelizing fitness evaluation across processes (each individual's games are fully independent)
is the natural next step.
