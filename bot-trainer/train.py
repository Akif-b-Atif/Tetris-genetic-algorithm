"""
Command-line entry point for training the bot's evaluation weights.

Usage:
    python train.py
    python train.py --population 40 --generations 30 --games 3
    python train.py --smoke-test

Writes two files to --out-dir (default: ./output):
    best_weights.json     -- the strongest weight vector found
    training_history.json -- per-generation fitness stats, for the
                              web app's training dashboard
"""

import argparse
import json
import os
import time

from bot.evaluate import WEIGHT_NAMES
from ga.trainer import GAConfig, run_training


def parse_args():
    p = argparse.ArgumentParser(description="Evolve Tetris bot weights with a genetic algorithm.")
    p.add_argument("--population", type=int, default=24)
    p.add_argument("--generations", type=int, default=15)
    p.add_argument("--games", type=int, default=2, help="games played per individual, per generation")
    p.add_argument("--piece-cap", type=int, default=200)
    p.add_argument("--tournament-size", type=int, default=4)
    p.add_argument("--elitism", type=int, default=2)
    p.add_argument("--mutation-rate", type=float, default=0.12)
    p.add_argument("--mutation-sigma", type=float, default=0.25)
    p.add_argument("--seed", type=int, default=None)
    p.add_argument("--smoke-test", action="store_true", help="tiny run to verify the pipeline end-to-end")
    p.add_argument("--out-dir", default="output")
    return p.parse_args()


def main():
    args = parse_args()

    if args.smoke_test:
        config = GAConfig(population_size=6, generations=3, games_per_individual=1, piece_cap=60, seed=1)
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
            seed=args.seed,
        )

    os.makedirs(args.out_dir, exist_ok=True)

    def on_generation(stats):
        print(
            f"gen {stats.generation:>3}  "
            f"best {stats.best_fitness:>9.1f}  "
            f"avg {stats.average_fitness:>9.1f}  "
            f"worst {stats.worst_fitness:>9.1f}"
        )

    start = time.time()
    result = run_training(config, on_generation=on_generation)
    elapsed = time.time() - start
    print(f"training finished in {elapsed:.1f}s over {len(result['history'])} generations")

    best = result["best"]
    weights_payload = {
        "weightNames": WEIGHT_NAMES,
        "weights": best.weights,
        "fitness": best.fitness,
        "trainedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "config": vars(args),
    }
    history_payload = {
        "weightNames": WEIGHT_NAMES,
        "generations": [
            {
                "generation": s.generation,
                "bestFitness": s.best_fitness,
                "averageFitness": s.average_fitness,
                "worstFitness": s.worst_fitness,
                "bestWeights": s.best_weights,
            }
            for s in result["history"]
        ],
    }

    with open(os.path.join(args.out_dir, "best_weights.json"), "w") as f:
        json.dump(weights_payload, f, indent=2)
    with open(os.path.join(args.out_dir, "training_history.json"), "w") as f:
        json.dump(history_payload, f, indent=2)

    print(f"wrote {args.out_dir}/best_weights.json and {args.out_dir}/training_history.json")


if __name__ == "__main__":
    main()
