"""
The genetic algorithm itself: a population of weight vectors plays
Tetris, the best performers are bred, and the process repeats across
generations until the weights converge on strong, stable play.

See docs/DESIGN.md for the reasoning behind every default below.
"""

import random
from dataclasses import dataclass, field
from typing import List, Optional

from engine.game import Game, PIECE_INDEX
from bot.search import find_best_move
from .individual import Individual, NUM_WEIGHTS


@dataclass
class GAConfig:
    population_size: int = 24
    generations: int = 15
    games_per_individual: int = 2
    piece_cap: int = 200
    tournament_size: int = 4
    elitism_count: int = 2
    mutation_rate: float = 0.12
    mutation_sigma: float = 0.25
    big_mutation_rate: float = 0.02
    seed: Optional[int] = None
    plateau_patience: int = 6


@dataclass
class GenerationStats:
    generation: int
    best_fitness: float
    average_fitness: float
    worst_fitness: float
    best_weights: List[float]


def _piece_index_of(piece_id):
    return PIECE_INDEX[piece_id]


def play_game(weights, rng_seed, piece_cap) -> dict:
    game = Game(rng_seed=rng_seed, piece_cap=piece_cap)
    singles = doubles = triples = tetrises = 0
    while not game.game_over:
        candidate = find_best_move(game, weights, _piece_index_of)
        if candidate is None:
            break
        result = game.apply(candidate.placement)
        if result.lines_cleared == 1:
            singles += 1
        elif result.lines_cleared == 2:
            doubles += 1
        elif result.lines_cleared == 3:
            triples += 1
        elif result.lines_cleared == 4:
            tetrises += 1

    topped_out = game.board.is_topped_out()
    return {
        "singles": singles,
        "doubles": doubles,
        "triples": triples,
        "tetrises": tetrises,
        "pieces_placed": game.pieces_placed,
        "topped_out": topped_out,
        "score": game.score,
    }


def fitness_of(weights, config: GAConfig, generation_seed: int) -> float:
    """Fitness is the real, Guideline-accurate game score (line clears,
    back-to-back, combo, and drop bonuses -- see engine/game.py),
    averaged over multiple games to smooth out piece-order luck. This
    is deliberately the same number shown as "Score" in the web app:
    the stated goal is a bot that scores as highly as possible at real
    Tetris, so the fitness function optimizes exactly that, rather
    than a hand-tuned proxy that could pull evolution toward a
    different, only-approximately-related objective."""
    total = 0.0
    for g in range(config.games_per_individual):
        result = play_game(weights, generation_seed * 1000 + g, config.piece_cap)
        total += result["score"]
    return total / config.games_per_individual


def tournament_select(population: List[Individual], rng: random.Random, k: int) -> Individual:
    contenders = rng.sample(population, k)
    return max(contenders, key=lambda ind: ind.fitness)


def uniform_crossover(a: Individual, b: Individual, rng: random.Random) -> Individual:
    weights = [rng.choice([a.weights[i], b.weights[i]]) for i in range(NUM_WEIGHTS)]
    return Individual(weights=weights)


def mutate(ind: Individual, config: GAConfig, rng: random.Random) -> Individual:
    weights = ind.weights[:]
    for i in range(NUM_WEIGHTS):
        if rng.random() < config.mutation_rate:
            if rng.random() < config.big_mutation_rate:
                weights[i] = rng.uniform(-1.0, 1.0)
            else:
                weights[i] += rng.gauss(0.0, config.mutation_sigma)
    return Individual(weights=weights)


def run_training(config: GAConfig, on_generation=None) -> dict:
    rng = random.Random(config.seed)
    population = [Individual.random(rng) for _ in range(config.population_size)]

    history: List[GenerationStats] = []
    best_ever: Optional[Individual] = None
    plateau_count = 0
    last_best = None

    for gen in range(1, config.generations + 1):
        gen_seed = rng.randint(0, 1_000_000) if config.seed is None else config.seed + gen
        for ind in population:
            ind.fitness = fitness_of(ind.weights, config, gen_seed)

        population.sort(key=lambda ind: ind.fitness, reverse=True)
        fitnesses = [ind.fitness for ind in population]
        stats = GenerationStats(
            generation=gen,
            best_fitness=fitnesses[0],
            average_fitness=sum(fitnesses) / len(fitnesses),
            worst_fitness=fitnesses[-1],
            best_weights=population[0].weights[:],
        )
        history.append(stats)
        if on_generation:
            on_generation(stats)

        if best_ever is None or population[0].fitness > best_ever.fitness:
            best_ever = population[0].clone()

        if last_best is not None and stats.best_fitness <= last_best + 1e-6:
            plateau_count += 1
        else:
            plateau_count = 0
        last_best = stats.best_fitness
        if plateau_count >= config.plateau_patience:
            break

        next_gen = [ind.clone() for ind in population[: config.elitism_count]]
        while len(next_gen) < config.population_size:
            parent_a = tournament_select(population, rng, config.tournament_size)
            parent_b = tournament_select(population, rng, config.tournament_size)
            child = uniform_crossover(parent_a, parent_b, rng)
            child = mutate(child, config, rng)
            next_gen.append(child)
        population = next_gen

    return {"best": best_ever, "history": history}
