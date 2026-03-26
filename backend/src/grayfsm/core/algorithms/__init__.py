"""
Optimization algorithms package.

This module automatically registers all available algorithms.
"""

# Import algorithms to trigger registration
from .greedy import GreedyAlgorithm

# Export for convenience
__all__ = ['GreedyAlgorithm']
