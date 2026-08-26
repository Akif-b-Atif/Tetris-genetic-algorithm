"""
Command-line entry point for training the bot's evaluation weights.

Usage:
    python train.py
    python train.py --population 40 --generations 30 --games 3
    python train.py --smoke-test
    python train.py --generations 0 --plateau-patience 0  # run until Ctrl+C
    python train.py --init-weights                      # use init_weights/default.json
    python train.py --init-weights output/best_weights.json  # continue a previous run

Writes two files to --out-dir (default: ./output), updated after every generation (not just
once at the end -- see "Live output" in bot-trainer/README.md):
    best_weights.json     -- the strongest weight vector found so far
    training_history.json -- per-generation fitness stats so far, for the
                              web app's training dashboard

By default a run stops once --generations is reached or fitness plateaus for
--plateau-patience generations, whichever comes first. Set either (or both) to 0 to disable it;
with both disabled, training runs indefinitely until you stop it yourself with Ctrl+C in the
console -- see "Running indefinitely" in bot-trainer/README.md. Ctrl+C is caught and handled
cleanly (no stack trace); because output is already live-written after every generation, nothing
is lost besides whatever generation was still in progress.

By default every run starts from a fully random population, same as before. Pass
--init-weights to seed the starting population from a saved weight vector instead -- see
"Starting training from existing weights" in bot-trainer/README.md.
"""

import argparse
import json
import os
import time

from bot.evaluate import WEIGHT_NAMES, FEATURE_SCALE_VERSION
from ga.trainer import GAConfig, run_training

DEFAULT_INIT_WEIGHTS_PATH = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "init_weights", "default.json"
)


def load_init_weights(path):
    """Loads a starting weight vector for --init-weights. Accepts either
    the same object shape train.py writes as best_weights.json
    ({"weightNames": [...], "weights": [...], ...}) or a bare JSON list
    of numbers, so a previous run's output can be fed straight back in
    to continue evolving it. Missing/extra/reordered weights are
    reconciled against the current WEIGHT_NAMES rather than silently
    misapplied -- see bot/evaluate.py's note on the same hazard."""
    with open(path) as f:
        data = json.load(f)

    if isinstance(data, list):
        raw_weights, raw_names, version = data, None, None
    elif isinstance(data, dict):
        raw_weights = data.get("weights")
        raw_names = data.get("weightNames")
        version = data.get("featureScaleVersion")
        if raw_weights is None:
            raise ValueError(f'{path}: expected a top-level "weights" list')
    else:
        raise ValueError(f"{path}: expected a JSON list or object, got {type(data).__name__}")

    if raw_names is not None and raw_names != WEIGHT_NAMES:
        # Align by name instead of trusting position, so a file saved
        # under a reordered or older WEIGHT_NAMES doesn't silently apply
        # a weight to the wrong feature.
        by_name = dict(zip(raw_names, raw_weights))
        missing = [n for n in WEIGHT_NAMES if n not in by_name]
        extra = [n for n in raw_names if n not in WEIGHT_NAMES]
        if missing:
            print(f"warning: {path} has no value for {missing}; defaulting to 0.0")
        if extra:
            print(f"warning: {path} has unused weight(s) {extra}, ignoring")
        raw_weights = [by_name.get(name, 0.0) for name in WEIGHT_NAMES]

    weights = [float(w) for w in raw_weights]
    expected = len(WEIGHT_NAMES)
    if len(weights) < expected:
        print(
            f"warning: {path} has {len(weights)} weight(s), expected {expected}; "
            f"padding the missing trailing weight(s) with 0.0"
        )
        weights += [0.0] * (expected - len(weights))
    elif len(weights) > expected:
        print(
            f"warning: {path} has {len(weights)} weight(s), expected {expected}; "
            f"ignoring the extra trailing weight(s)"
        )
        weights = weights[:expected]

    if version and version != FEATURE_SCALE_VERSION:
        print(
            f"warning: {path} was saved with featureScaleVersion={version!r}, current is "
            f"{FEATURE_SCALE_VERSION!r} -- these weights were tuned against a different "
            f"feature scale and may not be a meaningful starting point"
        )

    return weights


def parse_args():
    p = argparse.ArgumentParser(description="Evolve Tetris bot weights with a genetic algorithm.")
    p.add_argument("--population", type=int, default=24)
    p.add_argument(
        "--generations",
        type=int,
        default=15,
        help=(
            "maximum generations to run. 0 (or any negative number) means no cap -- keep "
            "training generation after generation until you stop it yourself with Ctrl+C in "
            "the console. Results are written to --out-dir after every generation regardless "
            "(see 'Live output' / 'Running indefinitely' in bot-trainer/README.md), so nothing "
            "is lost when you do."
        ),
    )
    p.add_argument("--games", type=int, default=2, help="games played per individual, per generation")
    p.add_argument("--piece-cap", type=int, default=200)
    p.add_argument("--tournament-size", type=int, default=4)
    p.add_argument("--elitism", type=int, default=2)
    p.add_argument("--mutation-rate", type=float, default=0.12)
    p.add_argument("--mutation-sigma", type=float, default=0.25)
    p.add_argument(
        "--plateau-patience",
        type=int,
        default=6,
        help=(
            "stop automatically if the best fitness in the population doesn't improve for this "
            "many generations in a row. 0 (or any negative number) disables this -- combine "
            "with --generations 0 to run purely until you stop it manually with Ctrl+C, with no "
            "automatic stop at all. Default: 6."
        ),
    )
    p.add_argument("--seed", type=int, default=None)
    p.add_argument("--smoke-test", action="store_true", help="tiny run to verify the pipeline end-to-end")
    p.add_argument("--out-dir", default="output")
    p.add_argument(
        "--init-weights",
        nargs="?",
        const=DEFAULT_INIT_WEIGHTS_PATH,
        default=None,
        metavar="PATH",
        help=(
            "seed the starting population from a saved weight vector instead of a random one "
            "(a training run's best_weights.json, or any file matching that format). Bare "
            f"--init-weights with no PATH uses {os.path.relpath(DEFAULT_INIT_WEIGHTS_PATH)} "
            "(zeroed out by default -- edit it, or pass a different PATH). Omit the flag "
            "entirely to train from scratch, same as before."
        ),
    )
    return p.parse_args()


def build_payloads(best, history, args):
    """Assembles the two output JSON payloads from whatever has been
    computed so far. Called after every generation (see write_outputs
    below), not just once at the end, so best/history only need to
    reflect progress up to the most recently completed generation."""
    weights_payload = {
        "weightNames": WEIGHT_NAMES,
        "featureScaleVersion": FEATURE_SCALE_VERSION,
        "weights": best.weights,
        "fitness": best.fitness,
        "trainedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "config": vars(args),
    }
    history_payload = {
        "weightNames": WEIGHT_NAMES,
        "featureScaleVersion": FEATURE_SCALE_VERSION,
        "generations": [
            {
                "generation": s.generation,
                "bestFitness": s.best_fitness,
                "averageFitness": s.average_fitness,
                "worstFitness": s.worst_fitness,
                "bestWeights": s.best_weights,
            }
            for s in history
        ],
    }
    return weights_payload, history_payload


def _write_json_atomic(path, data):
    # Write to a temp file in the same directory and rename over the
    # target, rather than writing the target in place. Since this now
    # runs after every generation (not just once at the end), a plain
    # in-place write would leave a brief window where a concurrent
    # reader -- e.g. the web app's Training Lab tab, if it's polling a
    # live run -- could see a truncated, invalid JSON file. os.replace
    # is atomic on both POSIX and Windows, so readers only ever see a
    # complete previous version or a complete new one, never a partial
    # write.
    tmp_path = f"{path}.tmp"
    with open(tmp_path, "w") as f:
        json.dump(data, f, indent=2)
    os.replace(tmp_path, path)


def write_outputs(best, history, args):
    weights_payload, history_payload = build_payloads(best, history, args)
    _write_json_atomic(os.path.join(args.out_dir, "best_weights.json"), weights_payload)
    _write_json_atomic(os.path.join(args.out_dir, "training_history.json"), history_payload)


def main():
    args = parse_args()

    init_weights = None
    if args.init_weights:
        init_weights = load_init_weights(args.init_weights)
        print(f"seeding initial population from {args.init_weights}")

    if args.smoke_test:
        config = GAConfig(
            population_size=6,
            generations=3,
            games_per_individual=1,
            piece_cap=60,
            seed=1,
            init_weights=init_weights,
        )
    else:
        config = GAConfig(
            population_size=args.population,
            generations=args.generations,
            games_per_individual=args.games,
            piece_cap=args.piece_cap,
            tournament_size=args.tournament_size,
            elitism_count=args.elitism,
            mutation_rate=args.mutation_rate,
            mutation_sigma=args.mutation_sigma,
            plateau_patience=args.plateau_patience,
            seed=args.seed,
            init_weights=init_weights,
        )

    if args.generations <= 0 and not args.smoke_test:
        stop_note = (
            "plateau detection is disabled too -- it will run until you stop it"
            if args.plateau_patience <= 0
            else f"it will still stop early after {args.plateau_patience} plateaued generations "
            "unless you also pass --plateau-patience 0"
        )
        print(f"no generation cap set -- press Ctrl+C in this console to stop training ({stop_note})")

    os.makedirs(args.out_dir, exist_ok=True)

    history_so_far = []

    def on_generation(stats, best_ever):
        print(
            f"gen {stats.generation:>3}  "
            f"best {stats.best_fitness:>9.1f}  "
            f"avg {stats.average_fitness:>9.1f}  "
            f"worst {stats.worst_fitness:>9.1f}"
        )
        history_so_far.append(stats)
        write_outputs(best_ever, history_so_far, args)

    start = time.time()
    try:
        result = run_training(config, on_generation=on_generation)
    except KeyboardInterrupt:
        # Ctrl+C during an unlimited (or just long) run. Every completed
        # generation was already written to disk by on_generation above,
        # so there's nothing left to save here -- just report where
        # things stand and exit cleanly instead of printing a traceback.
        elapsed = time.time() - start
        completed = len(history_so_far)
        print()  # move past the "^C" the terminal echoes
        if completed == 0:
            print(f"training interrupted after {elapsed:.1f}s, before any generation finished -- nothing was saved")
        else:
            print(f"training interrupted by user after {completed} generation(s) ({elapsed:.1f}s)")
            print(f"results through generation {completed} are saved in {args.out_dir}/best_weights.json and {args.out_dir}/training_history.json")
        return

    elapsed = time.time() - start
    print(f"training finished in {elapsed:.1f}s over {len(result['history'])} generations")

    # The last on_generation call already wrote the final state, but
    # write once more explicitly so the files are guaranteed to reflect
    # exactly result["best"] / result["history"] even if on_generation
    # is ever changed to not fire for the last generation.
    write_outputs(result["best"], result["history"], args)
    print(f"wrote {args.out_dir}/best_weights.json and {args.out_dir}/training_history.json")


if __name__ == "__main__":
    main()
