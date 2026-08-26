"""
Checks for ga/trainer.py's stopping conditions: the normal generation
cap, the plateau-based early stop, and the --generations 0 /
--plateau-patience 0 "run until stopped externally" mode train.py
exposes for Ctrl+C-controlled runs. Run with:
    python tests/test_trainer.py
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from ga.trainer import GAConfig, run_training
from ga.individual import NUM_WEIGHTS


# Small/fast settings shared by every test here -- these are checks on
# the stopping logic itself, not on training quality, so keep them cheap.
_FAST_KW = dict(population_size=6, games_per_individual=1, piece_cap=25, seed=1)


def test_stops_at_generation_cap_when_no_plateau():
    # plateau_patience disabled, so the only thing that can stop this
    # run is the generation cap itself.
    config = GAConfig(generations=4, plateau_patience=0, **_FAST_KW)
    result = run_training(config)
    assert len(result["history"]) == 4, f"expected exactly 4 generations, got {len(result['history'])}"
    assert [s.generation for s in result["history"]] == [1, 2, 3, 4]
    print("test_stops_at_generation_cap_when_no_plateau passed")


def test_zero_generations_and_zero_plateau_runs_until_externally_stopped():
    # Both disabled: run_training itself has no internal stopping
    # condition left, so we drive it a fixed number of generations via
    # on_generation and break out of it ourselves, the same way
    # train.py's Ctrl+C handling relies on the caller (not the trainer)
    # being the thing that ends the loop.
    config = GAConfig(generations=0, plateau_patience=0, **_FAST_KW)

    seen = []

    class _StopTraining(Exception):
        pass

    def on_generation(stats, best_ever):
        seen.append(stats.generation)
        if len(seen) >= 3:
            raise _StopTraining()

    try:
        run_training(config, on_generation=on_generation)
        assert False, "expected run_training to still be going and raise _StopTraining"
    except _StopTraining:
        pass

    assert seen == [1, 2, 3], f"expected generations 1-3 before we stopped it, got {seen}"
    print("test_zero_generations_and_zero_plateau_runs_until_externally_stopped passed")


def test_negative_generations_also_means_unlimited():
    config = GAConfig(generations=-1, plateau_patience=0, **_FAST_KW)
    seen = []

    class _StopTraining(Exception):
        pass

    def on_generation(stats, best_ever):
        seen.append(stats.generation)
        if len(seen) >= 2:
            raise _StopTraining()

    try:
        run_training(config, on_generation=on_generation)
        assert False, "negative generations should behave as unlimited, not as zero iterations"
    except _StopTraining:
        pass

    assert seen == [1, 2]
    print("test_negative_generations_also_means_unlimited passed")


def test_best_ever_passed_to_callback_never_regresses():
    config = GAConfig(generations=6, plateau_patience=0, **_FAST_KW)
    fitness_seen = []

    def on_generation(stats, best_ever):
        fitness_seen.append(best_ever.fitness)

    run_training(config, on_generation=on_generation)
    for earlier, later in zip(fitness_seen, fitness_seen[1:]):
        assert later >= earlier - 1e-9, "best_ever fitness should be non-decreasing across generations"
    print("test_best_ever_passed_to_callback_never_regresses passed")


def test_on_generation_best_weights_have_correct_length():
    config = GAConfig(generations=2, plateau_patience=0, **_FAST_KW)

    def on_generation(stats, best_ever):
        assert len(stats.best_weights) == NUM_WEIGHTS
        assert len(best_ever.weights) == NUM_WEIGHTS

    run_training(config, on_generation=on_generation)
    print("test_on_generation_best_weights_have_correct_length passed")


if __name__ == "__main__":
    test_stops_at_generation_cap_when_no_plateau()
    test_zero_generations_and_zero_plateau_runs_until_externally_stopped()
    test_negative_generations_also_means_unlimited()
    test_best_ever_passed_to_callback_never_regresses()
    test_on_generation_best_weights_have_correct_length()
    print("all tests passed")
