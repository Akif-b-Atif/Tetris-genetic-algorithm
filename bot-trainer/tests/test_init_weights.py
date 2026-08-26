"""
Checks for the --init-weights loading logic in train.py: the JSON
formats it accepts, and how it reconciles a file that doesn't line up
exactly with the current WEIGHT_NAMES. Run with:
    python tests/test_init_weights.py
"""

import json
import os
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from train import load_init_weights, DEFAULT_INIT_WEIGHTS_PATH
from bot.evaluate import WEIGHT_NAMES


def _write(obj_or_text):
    fd, path = tempfile.mkstemp(suffix=".json")
    with os.fdopen(fd, "w") as f:
        if isinstance(obj_or_text, str):
            f.write(obj_or_text)
        else:
            json.dump(obj_or_text, f)
    return path


def test_default_template_is_all_zero_and_right_length():
    weights = load_init_weights(DEFAULT_INIT_WEIGHTS_PATH)
    assert len(weights) == len(WEIGHT_NAMES), "default template length must match WEIGHT_NAMES"
    assert all(w == 0.0 for w in weights), "default template should be zeroed out"
    print("test_default_template_is_all_zero_and_right_length passed")


def test_accepts_best_weights_shaped_file():
    path = _write({
        "weightNames": WEIGHT_NAMES,
        "weights": list(range(len(WEIGHT_NAMES))),
        "fitness": 1234.0,
        "featureScaleVersion": "v2-normalized",
    })
    weights = load_init_weights(path)
    assert weights == [float(i) for i in range(len(WEIGHT_NAMES))]
    print("test_accepts_best_weights_shaped_file passed")


def test_accepts_bare_list():
    path = _write([1.5] * len(WEIGHT_NAMES))
    weights = load_init_weights(path)
    assert weights == [1.5] * len(WEIGHT_NAMES)
    print("test_accepts_bare_list passed")


def test_pads_short_vector_with_zero():
    path = _write({"weights": [1, 2, 3]})
    weights = load_init_weights(path)
    assert len(weights) == len(WEIGHT_NAMES)
    assert weights[:3] == [1.0, 2.0, 3.0]
    assert all(w == 0.0 for w in weights[3:])
    print("test_pads_short_vector_with_zero passed")


def test_truncates_long_vector():
    path = _write({"weights": [9.0] * (len(WEIGHT_NAMES) + 5)})
    weights = load_init_weights(path)
    assert len(weights) == len(WEIGHT_NAMES)
    print("test_truncates_long_vector passed")


def test_aligns_by_name_when_names_are_reordered_or_partial():
    path = _write({
        "weightNames": ["holes", "max_height"],
        "weights": [-5.0, -2.0],
    })
    weights = load_init_weights(path)
    holes_i = WEIGHT_NAMES.index("holes")
    max_height_i = WEIGHT_NAMES.index("max_height")
    assert weights[holes_i] == -5.0
    assert weights[max_height_i] == -2.0
    # everything else defaults to 0
    for i, w in enumerate(weights):
        if i not in (holes_i, max_height_i):
            assert w == 0.0
    print("test_aligns_by_name_when_names_are_reordered_or_partial passed")


def test_rejects_missing_weights_key():
    path = _write({"weightNames": WEIGHT_NAMES})
    try:
        load_init_weights(path)
        assert False, "expected a ValueError for a missing 'weights' key"
    except ValueError:
        pass
    print("test_rejects_missing_weights_key passed")


if __name__ == "__main__":
    test_default_template_is_all_zero_and_right_length()
    test_accepts_best_weights_shaped_file()
    test_accepts_bare_list()
    test_pads_short_vector_with_zero()
    test_truncates_long_vector()
    test_aligns_by_name_when_names_are_reordered_or_partial()
    test_rejects_missing_weights_key()
    print("all tests passed")
