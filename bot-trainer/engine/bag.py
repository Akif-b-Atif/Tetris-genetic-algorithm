"""7-bag randomizer: every run of 7 pieces contains each tetromino exactly once."""

import random
from .pieces import PIECE_IDS


class SevenBag:
    def __init__(self, rng=None):
        self._rng = rng or random.Random()
        self._bag = []

    def _refill(self):
        self._bag = PIECE_IDS[:]
        self._rng.shuffle(self._bag)

    def next(self):
        if not self._bag:
            self._refill()
        return self._bag.pop()

    def peek(self, n):
        out = []
        bag = self._bag[:]
        while len(out) < n:
            if not bag:
                bag = PIECE_IDS[:]
                self._rng.shuffle(bag)
            out.append(bag.pop())
        return out
