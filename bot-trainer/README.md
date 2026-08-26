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
`output/training_history.json`, updated after every generation (see "Live output" below). Copy
both into `web/public/data/` to update what the web app plays with and displays.

To verify the pipeline works end-to-end before committing to a long run:

```bash
python train.py --smoke-test
```

### CLI options

| Flag | Default | Meaning |
|---|---|---|
| `--population` | 24 | Individuals per generation |
| `--generations` | 15 | Maximum generations to run. `0` (or negative) means no cap — see "Running indefinitely" below |
| `--games` | 2 | Games played per individual, per generation (averaged for a less noisy fitness signal) |
| `--piece-cap` | 200 | Pieces placed before a game is cut off, win or lose |
| `--tournament-size` | 4 | Contenders sampled per tournament-selection draw |
| `--elitism` | 2 | Top individuals carried unchanged into the next generation |
| `--mutation-rate` | 0.12 | Chance any given weight is mutated in a child |
| `--mutation-sigma` | 0.25 | Standard deviation of the Gaussian noise added on mutation |
| `--plateau-patience` | 6 | Stop early if the best fitness doesn't improve for this many generations in a row. `0` (or negative) disables this — see "Running indefinitely" below |
| `--seed` | none | Fix the RNG seed for a reproducible run |
| `--init-weights [PATH]` | none (random population) | Seed generation zero from a saved weight vector instead of starting from scratch — see below |
| `--out-dir` | `output` | Where the two JSON files are written |

By default a run can end two ways before reaching `--generations`: the best fitness plateaus for
`--plateau-patience` generations in a row (see `ga/trainer.py`), or, if you've set `--generations
0`, only by you stopping it — see the next two sections.

## Live output

`best_weights.json` and `training_history.json` are (re)written after *every* generation, not
just once at the end — `best_weights.json` always holds the fittest individual seen so far, and
`training_history.json` grows by one entry per generation as the run progresses. This means:

- You can point the web app's Training Lab tab at `output/` (or copy the files into
  `web/public/data/`) and watch a long run's fitness curve update as it trains, rather than
  waiting for it to finish.
- Killing a run early (`Ctrl+C`, a crash, running out of time) never loses progress — whatever
  was written after the last completed generation is a valid, complete pair of output files on
  its own. See "Running indefinitely" just below for the intended way to do this deliberately.
- Each write replaces the previous file atomically (write to a temp file, then rename over the
  target), so a reader polling the output directory mid-run never sees a half-written file.

## Running indefinitely

Pass `--generations 0` (or any negative number) to remove the generation cap entirely. The run
then keeps going — playing games, evaluating fitness, breeding the next generation — for as long
as you let it, with no built-in end point:

```bash
python train.py --generations 0
```

Press `Ctrl+C` in the console whenever you want to stop. `train.py` catches that (`KeyboardInterrupt`)
and shuts down cleanly instead of printing a stack trace — it prints how many generations
completed and confirms the two output files already reflect that final state (see "Live output"
above; nothing extra needs to be saved at that point, since every generation's results were
already written to disk as it finished). The only work lost is whatever partial generation was
in progress at the moment you hit `Ctrl+C`.

Note that `--plateau-patience` still defaults to `6`, so an unlimited run will, by default, stop
itself automatically once fitness stalls for 6 generations rather than truly running forever. To
disable that too and rely purely on `Ctrl+C`:

```bash
python train.py --generations 0 --plateau-patience 0
```

`train.py` prints a one-line reminder of which of these applies at the start of any run with
`--generations 0`.

## Starting training from existing weights

By default, `train.py` behaves exactly as before: generation zero is a fully random population,
and every run starts from scratch. Passing `--init-weights` changes that: instead of randomizing
the whole population, one individual is set to *exactly* the weight vector you supply, and the
rest of the population is filled with mutated copies of it (using the same `--mutation-rate` /
`--mutation-sigma` as the rest of the run). Evolution then proceeds as normal from there — the
seeded individual is carried forward unchanged by elitism unless something in the mutated
population beats it, so a run can never do *worse* than the weights it started with, and it will
"tweak" them generation over generation the same way it would tweak any other individual.

```bash
# Use the predecided default file (init_weights/default.json), zeroed out unless you've edited it
python train.py --init-weights

# Point at any file in the same shape, e.g. continue evolving a previous run's result
python train.py --init-weights output/best_weights.json

# Or any other path
python train.py --init-weights path/to/my_weights.json
```

**File format.** `--init-weights` accepts the same JSON shape `train.py` itself writes as
`best_weights.json`:

```json
{
  "weightNames": ["aggregate_height", "max_height", "..."],
  "weights": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
}
```

A bare list of 12 numbers (`[0, 0, 0, ...]`, no `weightNames`) is also accepted. The twelve
weights are, in order: the eight board-shape features (`aggregate_height`, `max_height`,
`bumpiness`, `height_variance`, `holes`, `row_transitions`, `column_transitions`, `well_sum`),
then the four one-hot line-clear features (`clear_single`, `clear_double`, `clear_triple`,
`clear_tetris`) — see `bot/evaluate.py` and `docs/DESIGN.md` for what each one means. If
`weightNames` is present, weights are matched up by name rather than position, so a file with
weights in a different order, or missing/extra entries, still lines up correctly (with a printed
warning for anything that doesn't match); a file with too few or too many bare weights is padded
or truncated the same way, also with a warning.

**Where the file lives.** [`init_weights/default.json`](init_weights/default.json) is the
predecided default: `--init-weights` with no path uses it, and it ships zeroed out (every weight
`0`, which is a neutral starting point — the bot doesn't yet weight any feature). Edit that file
in place to always start from your own numbers, or pass an explicit path to use a different file
per run — for example, to continue evolving `output/best_weights.json` from a previous session
rather than always starting over.

## Running the tests

```bash
python tests/test_engine.py
python tests/test_init_weights.py
python tests/test_trainer.py
```

`test_engine.py` is a small set of assertion-based checks against hand-built board states (a
board with exactly one known hole should report `holes == 1`, and so on), plus one full headless
game run through the search and applied end to end. `test_init_weights.py` covers the
`--init-weights` file loading: the default template, the named and bare-list formats, and how
short/long/reordered weight vectors are reconciled. `test_trainer.py` covers the generation loop's
stopping conditions: the plain generation cap, the plateau-based early stop, and the
`--generations 0` / `--plateau-patience 0` unlimited mode. No test framework is required for any
of them.

## Layout

```
engine/       board, pieces, SRS rotation/kicks, 7-bag, line clears, the Game state machine
bot/          feature extraction, the linear evaluation function, the exhaustive placement search
ga/           the individual representation and the genetic algorithm's generation loop
init_weights/ predecided home for --init-weights files (default.json ships zeroed out)
train.py      command-line entry point
tests/        assertion-based correctness checks
```

## A note on performance

A single 200-piece game with one-ply search takes well under a second. The real cost is
`games_per_individual x population_size x generations` — a session with the defaults above and 40
generations is on the order of a few thousand simulated games. This is pure-Python and
single-threaded by design (see the root design doc for why Python was chosen for this half of the
project at all); if you want to scale up population size or generation count substantially,
parallelizing fitness evaluation across processes (each individual's games are fully independent)
is the natural next step. This also means an unlimited (`--generations 0`) run has no runaway-memory
concern to worry about beyond `training_history.json` growing by one entry per generation on
disk — it's the CPU time that accumulates, not memory, so leaving one running overnight and
stopping it with `Ctrl+C` in the morning is a reasonable way to use it.
