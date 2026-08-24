"""An individual is nothing more than the weight vector from bot/evaluate.py."""

import random
from dataclasses import dataclass, field
from typing import List

from bot.evaluate import WEIGHT_NAMES

NUM_WEIGHTS = len(WEIGHT_NAMES)

# Rough sign bias used only to seed initial random weights faster
# toward sensible territory (§5.3 of the design doc) -- evolution is
# free to override any of these; nothing here is hard-coded into the
# evaluation function itself.
_SIGN_BIAS = {
    "aggregate_height": -1,
    "max_height": -1,
    "bumpiness": -1,
    "height_variance": -1,
    "holes": -1,
    "row_transitions": -1,
    "column_transitions": -1,
    "well_sum": 0,
    "clear_single": 1,
    "clear_double": 1,
    "clear_triple": 1,
    "clear_tetris": 1,
}


@dataclass
class Individual:
    weights: List[float] = field(default_factory=list)
    fitness: float = 0.0

    @staticmethod
    def random(rng: random.Random) -> "Individual":
        weights = []
        for name in WEIGHT_NAMES:
            bias = _SIGN_BIAS.get(name, 0)
            magnitude = rng.uniform(0.0, 1.0)
            if bias == 0:
                magnitude *= rng.choice([-1, 1])
            else:
                magnitude *= bias
            weights.append(magnitude)
        return Individual(weights=weights)

    def clone(self) -> "Individual":
        return Individual(weights=self.weights[:], fitness=self.fitness)
