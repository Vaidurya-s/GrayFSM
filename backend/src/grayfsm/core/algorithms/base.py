"""
Base class for FSM optimization algorithms.

This module defines the abstract interface that all optimization algorithms
must implement, along with a registry system for algorithm plugins.
"""

from abc import ABC, abstractmethod
from typing import Dict, Any, Type
from ..fsm_model import FSM, OptimizedFSM


class OptimizationAlgorithm(ABC):
    """
    Abstract base class for FSM optimization algorithms.

    All optimization algorithms must inherit from this class and implement
    the required methods.
    """

    @property
    @abstractmethod
    def name(self) -> str:
        """
        Algorithm name.

        Returns:
            Unique identifier for this algorithm
        """
        pass

    @property
    def description(self) -> str:
        """
        Algorithm description.

        Returns:
            Human-readable description of the algorithm
        """
        return "No description available"

    @abstractmethod
    def optimize(self, fsm: FSM, options: Dict[str, Any] = None) -> OptimizedFSM:
        """
        Optimize FSM using this algorithm.

        Args:
            fsm: Input FSM to optimize
            options: Algorithm-specific options (optional)

        Returns:
            Optimized FSM with dummy states inserted

        Raises:
            ValueError: If FSM is invalid or optimization fails
        """
        pass

    def validate_fsm(self, fsm: FSM) -> None:
        """
        Validate FSM before optimization (optional hook).

        Args:
            fsm: FSM to validate

        Raises:
            ValueError: If FSM is invalid for this algorithm
        """
        # Default: no additional validation beyond FSM's own validation
        pass

    def __repr__(self) -> str:
        """String representation."""
        return f"{self.__class__.__name__}(name='{self.name}')"


class AlgorithmRegistry:
    """
    Registry for optimization algorithms.

    Allows dynamic registration and retrieval of algorithm implementations,
    supporting a plugin architecture for future extensions.
    """

    _algorithms: Dict[str, Type[OptimizationAlgorithm]] = {}

    @classmethod
    def register(cls, algorithm_class: Type[OptimizationAlgorithm]) -> None:
        """
        Register an algorithm class.

        Args:
            algorithm_class: Algorithm class to register

        Raises:
            ValueError: If algorithm name conflicts with existing registration
        """
        # Instantiate temporarily to get name
        instance = algorithm_class()
        name = instance.name

        if name in cls._algorithms:
            existing = cls._algorithms[name]
            if existing != algorithm_class:
                raise ValueError(
                    f"Algorithm name '{name}' already registered "
                    f"by {existing.__name__}"
                )

        cls._algorithms[name] = algorithm_class

    @classmethod
    def get(cls, name: str) -> Type[OptimizationAlgorithm]:
        """
        Get algorithm class by name.

        Args:
            name: Algorithm name

        Returns:
            Algorithm class

        Raises:
            KeyError: If algorithm not found
        """
        if name not in cls._algorithms:
            available = ', '.join(cls._algorithms.keys())
            raise KeyError(
                f"Algorithm '{name}' not found. "
                f"Available algorithms: {available}"
            )
        return cls._algorithms[name]

    @classmethod
    def get_instance(cls, name: str, **kwargs) -> OptimizationAlgorithm:
        """
        Get algorithm instance by name.

        Args:
            name: Algorithm name
            **kwargs: Arguments to pass to algorithm constructor

        Returns:
            Algorithm instance
        """
        algorithm_class = cls.get(name)
        return algorithm_class(**kwargs)

    @classmethod
    def list_algorithms(cls) -> Dict[str, Type[OptimizationAlgorithm]]:
        """
        List all registered algorithms.

        Returns:
            Dictionary mapping algorithm names to classes
        """
        return cls._algorithms.copy()

    @classmethod
    def is_registered(cls, name: str) -> bool:
        """
        Check if an algorithm is registered.

        Args:
            name: Algorithm name

        Returns:
            True if algorithm is registered
        """
        return name in cls._algorithms

    @classmethod
    def clear(cls) -> None:
        """Clear all registrations (primarily for testing)."""
        cls._algorithms.clear()
