# Design Document

This document explains how the game and the bot work: the rules the engine enforces, the
features the bot reduces a board to, how it turns those features into a decision, and how its
weights were found. It assumes no prior context beyond a general familiarity with Tetris.

## What this project is, and isn't

The bot is not a neural network and it does not use reinforcement learning in the Q-learning or
policy-gradient sense. There is no learned value function bootstrapped from a reward signal, and
nothing here is generating novel data.

What it actually is: a **genetic algorithm** (a type of evolutionary search) optimizing the
weights of a small, hand-designed linear evaluation function. A population of random weight
vectors plays games of Tetris; the vectors that produce the best play are bred with each other
and mutated into the next generation; the process repeats until the population converges on a
strong, stable set of weights. The whole "genome" is a handful of floating-point numbers, which
means the result is directly interpretable — the weights table in the Training Lab tab is a
complete description of why the bot plays the way it does, unlike a neural network's parameters.

This is a well-established, legitimate approach to Tetris AI, and arguably a better fit for a
project like this than deep RL would be: it trains fast, it's cheap to run, and every decision
the bot makes can be traced back to a small set of named numbers rather than an opaque model.

## Two halves, one contract

The game and the bot's live inference run entirely in the browser, in TypeScript. The genetic
algorithm that finds the bot's weights runs offline, in Python, from the command line. The two
share nothing at runtime — the only thing that crosses the boundary is a JSON file containing a
weight vector and a per-generation fitness history.

This mirrors how the same problem is usually approached in practice: train somewhere unconstrained
by a browser's execution model, then ship a lightweight artifact (here, twelve numbers) that a
much simpler runtime can use to make decisions instantly. It also means the web app has no
server-side dependency — it's a static site that happens to know how to play Tetris well, because
someone ran a training job once and committed the result.

The two implementations of the game engine (`bot-trainer/engine` in Python, `web/src/engine` in
TypeScript) are deliberately kept in close correspondence — same board dimensions, same rotation
system, same scoring — because the bot's search only produces a meaningful decision if the board
it's reasoning about behaves identically to the board it will actually play on.

## The game

- **Board:** 10 columns by 20 visible rows, with additional hidden rows above the visible area so
  pieces have room to spawn and rotate near the top of a tall stack without immediately colliding.
- **Rotation:** the Super Rotation System (SRS), including per-piece wall-kick tables. The I piece
  has its own kick table, distinct from the other five rotating pieces; the O piece doesn't rotate.
  A simplified rotation system would make some placements legal (or illegal) that SRS wouldn't,
  which would make the bot's search space subtly wrong relative to what it's actually playing on.
- **Piece generation:** the 7-bag randomizer. Every run of seven pieces contains each tetromino
  exactly once, which avoids the long droughts pure uniform-random selection can produce and gives
  the bot a more predictable near-term piece distribution.
- **Hold:** usable once per piece, matching the standard rule — you cannot hold, un-hold, and
  hold again on the same piece. The bot's search respects this exactly as a human player would be
  bound by it.
- **Scoring:** matches the Tetris Guideline at level 1 (no level-based multiplier, since neither
  engine implements level progression): single/double/triple/tetris line clears score
  100/300/500/800, a tetris immediately following another tetris scores 1.5x
  (back-to-back), consecutive line-clearing placements add a combo bonus, and both a manual soft
  drop (1 point/cell) and a hard drop (2 points/cell) score based on the distance actually
  covered by that action — a piece that lands purely from gravity earns no drop bonus, matching
  the real rules. T-spin detection and its associated bonus are not implemented; that's the one
  piece of Guideline scoring missing here; the reference values above are the ones in
  [Tetris Wiki's scoring article](https://tetris.wiki/Scoring).
- **Lock delay:** implemented for human play, where it matters for feel. The bot never uses it —
  it computes a target final placement and hard-drops directly into it, so a grace period to
  adjust after landing is irrelevant to how it decides anything.

## What the bot sees

Everything the bot reasons about comes from a candidate resulting board: "if I placed this piece
here, in this rotation, what would the board look like, and how good is that?" That board is
reduced to eight numeric features:

| Feature | Definition |
|---|---|
| Aggregate height | Sum of every column's height |
| Max height | Height of the tallest column |
| Bumpiness | Sum of absolute height differences between adjacent columns |
| Height variance | Population variance of column heights |
| Holes | Empty cells with at least one filled cell above them in the same column |
| Row transitions | Filled/empty transitions scanned across each row, walls counted as filled |
| Column transitions | Same idea, scanned down each column |
| Well sum | Total depth of columns sitting notably lower than both neighbors |

Height variance earns its place alongside bumpiness rather than being redundant with it: bumpiness
only looks at *adjacent* column differences, so a board that slopes gradually from tall on one
side to completely empty on the other — pillars built up on one half of the field while the other
sits untouched — can keep bumpiness low, since each individual step between neighboring columns is
small, even though the board as a whole is badly lopsided. Variance measures that global imbalance
directly regardless of how gradual the slope is, and it was added specifically because an early
evolved bot exhibited exactly this one-sided pillar-building pattern with bumpiness alone.

Line clears are handled separately, and deliberately not as a ninth feature. A single linear
weight on a 0–4 "lines cleared" count could never express that a four-line clear is worth more
than four times a one-line clear — that's what "linear" means. Instead, clearing exactly one,
two, three, or four lines is one-hot encoded as four independent boolean features
(`clear_single` … `clear_tetris`), each with its own weight, so the genetic algorithm is free to
discover how disproportionate that reward should be rather than having it assumed.

## Turning features into a decision

A candidate board's score is a weighted sum of its *normalized* feature vector, plus whichever
line-clear weight applies:

```
score = w0*(aggregate_height/scale0) + w1*(max_height/scale1) + ... + w_clear[lines_cleared]
```

### Feature normalization

Each board-shape feature is divided by a rough theoretical upper bound (derived from the board's
own dimensions — see `FEATURE_SCALE` in `bot/evaluate.py` / `evaluate.ts`) before it's weighted.
This exists to fix a real problem an earlier version of this project had: `aggregate_height`,
`holes`, and the transition counts routinely reach into the tens or hundreds on a realistic board,
while the one-hot line-clear features (`clear_single` … `clear_tetris`) are always exactly 0 or 1.
The genetic algorithm's initial weights and mutation step size are the same absolute scale for
every feature, regardless of the feature's own natural range (see `ga/individual.py`). Without
normalization, that mismatch means a weight on a line-clear feature has vastly less real influence
on which move actually gets picked than a weight of the same magnitude on a board-shape feature —
line-clear weights end up drifting close to randomly across generations, since there's little
fitness pressure keeping their sign or magnitude meaningful. Concretely: a training run without
normalization produced a bot with a *negative* weight on `clear_tetris`, not because tetrises are
actually bad, but because that weight was nearly irrelevant to which placement the search chose in
the first place, so evolution had no real reason to correct it.

Normalizing doesn't change what the evaluation function can express — it's a linear rescaling, and
the function is linear — it changes what a given weight *means*, so that a weight of similar
magnitude carries roughly comparable influence no matter which feature it's attached to. This is
tracked with an explicit `FEATURE_SCALE_VERSION` string in both engines; a saved weight file whose
version doesn't match the current one was tuned against a different scale entirely and needs
retraining, not just reloading — the web app's Bot Match tab detects and flags this automatically.

### A caveat worth knowing about: correlated features

Several of the eight features overlap in what they actually measure. A board with more holes
almost always has more column transitions too (each hole is itself a filled→empty→filled
transition), and both tend to rise together with aggregate height. In a linear model, correlated
inputs don't need to each carry their "intuitively correct" independent weight — the combination
just needs to come out right. In practice this means an individual weight can land somewhere
counterintuitive (say, a small or even positive weight on `aggregate_height`) without the overall
evaluation function actually being broken, if a correlated feature like `holes` is already doing
most of the real penalizing work. Normalization fixes the *scale* problem above, but it doesn't
remove this correlation, and there's no single fix for it beyond either trimming the feature set to
fewer, less-overlapping features, or simply not over-interpreting any one weight in isolation. This
project keeps the full eight-feature set rather than trimming it, on the view that more information
is generally still useful to a linear model even when some of it is redundant — but it's a
legitimate design choice to make differently if you want more directly interpretable individual
weights.

For the current piece, the bot enumerates every legal final placement — every rotation state,
every column, dropped straight down to its resting position using the same collision logic that
drives a real hard drop — scores each one, and keeps the best. It repeats the same search for
whichever piece holding would produce, and takes whichever branch scores higher overall. At most
four rotations times ten columns, doubled for the hold branch, is small enough to search
completely; no pruning is needed for a single ply. Multi-piece look-ahead (searching combinations
of the current and next piece together) is a natural next step but isn't implemented here.

## Finding the weights

An **individual** in the genetic algorithm is nothing more than the weight vector above — twelve
floating-point numbers. Its **fitness** is the real, Guideline-accurate score it earns playing one
or more full games with the search described above — the same number shown as "Score" in the web
app, including line clears, back-to-back bonuses, combo bonuses, and drop bonuses. Fitness is
deliberately not a separate hand-tuned proxy: the stated goal is a bot that scores as highly as
possible at real Tetris, so the training signal is exactly that score, not an approximation of it
that could pull evolution toward a subtly different objective (for instance, over-valuing tetrises
relative to what they're actually worth, and ending up with a bot that's excellent at maximizing
an artificial reward but not at maximizing the real thing).

Because Tetris involves real randomness, a single game is a noisy signal; each individual plays
multiple games per generation and its fitness is averaged, and games are capped at a fixed piece
count so one exceptionally long-lived individual can't stall an entire generation. Note that
topping out isn't given an extra fitness penalty beyond the score itself — it doesn't need one,
since a game that ends early simply stops accumulating score, which already prices in the cost of
dying. Likewise there's no separate per-piece survival bonus: real score already grows with every
piece placed (via the hard-drop bonus alone, before any line is even cleared), so even a
completely incompetent early individual's games carry a usable gradient for selection, rather than
tying at zero.

Each generation: the fittest individuals are carried forward unchanged (elitism, so the best
result found is never lost to an unlucky crossover); the rest of the next generation is produced
by tournament selection (sample a handful of individuals, take the fittest as a parent), uniform
crossover (each weight independently inherited from one parent or the other), and mutation
(Gaussian noise on most weights, with a small chance of a larger jump to help escape local
optima). Training stops after a fixed number of generations or once the best fitness plateaus for
several generations in a row, whichever comes first -- both of those limits are optional, though:
`train.py --generations 0 --plateau-patience 0` removes them entirely, and the loop keeps running
until stopped from outside (`Ctrl+C`). This is a reasonable way to run training, precisely because
of the elitism guarantee above and the live-output behaviour described in
`bot-trainer/README.md#running-indefinitely`: since the best individual seen so far can only ever
be replaced by something at least as fit, and both output files are rewritten after every
generation rather than only at the end, stopping an indefinite run at an arbitrary moment always
leaves you with a valid, complete result -- there's no notion of catching it "mid-write" or
losing the best weights found by interrupting it.

### Where generation zero comes from

By default, generation zero — the population a run starts from before any selection has
happened — is fully random, biased only by the rough signs in `_SIGN_BIAS` (§ga/individual.py)
that nudge things like `holes` toward starting negative rather than wasting early generations
discovering the obvious. This is "training from scratch": every run is independent, and nothing
about a previous run's result carries over unless you copy it into `web/public/data/` at the end.

`train.py --init-weights` offers an alternative starting point: rather than randomizing every
individual, one individual in generation zero is set to *exactly* a weight vector you supply (a
previous run's `best_weights.json`, or a hand-edited file), and the rest of the population is
filled with mutated copies of it. Selection, crossover, and mutation all proceed completely
unchanged from there — the seeded individual is just another individual in the population, kept
around only by ordinary elitism, and it wins in later generations only if nothing outperforms it.
Concretely this means a seeded run can't do *worse* than its starting weights (elitism guarantees
the best-seen individual, which starts out being the seed, is never lost), while still leaving the
GA completely free to move away from them if a mutated variant proves stronger. This is useful for
picking up where a previous run left off, or for starting from a hand-designed guess at good
weights rather than a random one. See `bot-trainer/README.md` for the file format and CLI usage.

## Reading the training lab tab

The fitness-over-generations chart plots both the best individual per generation and the
population average; the gap between the two lines is itself informative — a wide, persistent gap
usually means the population still has useful genetic diversity to select from, while a gap that
collapses to near zero early is a sign the population has converged (possibly prematurely, if it
happens very early — see the mutation rate and elitism count in the trainer's configuration).

The weight table underneath is the actual evolved genome behind the bot in the Bot Match tab.
Watch how it plays a few games and the weights explain exactly why: a heavily negative weight on
holes and column transitions produces a bot that avoids burying cells under overhangs even at the
cost of a slightly taller stack elsewhere; a well-shaped weight on `well_sum` encourages it to
keep a single column open rather than fill it in, waiting for a favorable piece. Because every
feature is normalized before weighting (see "Turning features into a decision" above), weights
across different features are meant to be roughly comparable in magnitude — a weight of 2 on one
feature and 0.2 on another is a real difference in how much each matters, not an artifact of one
feature's raw values happening to be much larger. That said, a handful of these features overlap
in what they measure (also covered above), so don't read too much into any single weight's exact
sign or size in isolation from the others.
