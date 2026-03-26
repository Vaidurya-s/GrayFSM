"""
Data Factories for Test Data Generation

Uses Factory Boy and Faker to generate realistic test data.
"""

import factory
from factory import fuzzy
from faker import Faker
import random
from typing import List, Dict

fake = Faker()


class FSMFactory(factory.Factory):
    """Factory for generating FSM test data."""

    class Meta:
        model = dict

    name = factory.LazyAttribute(lambda _: fake.sentence(nb_words=3).rstrip('.'))
    description = factory.LazyAttribute(lambda _: fake.paragraph())
    fsm_type = fuzzy.FuzzyChoice(['moore', 'mealy'])
    visibility = fuzzy.FuzzyChoice(['public', 'private', 'unlisted'])
    tags = factory.LazyAttribute(lambda _: fake.words(nb=random.randint(1, 5)))

    @factory.lazy_attribute
    def states(self):
        """Generate random states."""
        num_states = random.randint(3, 10)
        return [f"S{i}" for i in range(num_states)]

    @factory.lazy_attribute
    def initial_state(self):
        """Set initial state."""
        return self.states[0] if self.states else "S0"

    @factory.lazy_attribute
    def transitions(self):
        """Generate random transitions."""
        transitions = []
        num_states = len(self.states)

        for i, state in enumerate(self.states):
            # Each state has 1-3 outgoing transitions
            num_transitions = random.randint(1, min(3, num_states - 1))
            targets = random.sample(
                [s for s in self.states if s != state],
                num_transitions
            )

            for target in targets:
                transition = {
                    "from_state": state,
                    "to_state": target,
                    "input": fake.word()
                }

                if self.fsm_type == 'mealy':
                    transition["output"] = str(random.randint(0, 1))

                transitions.append(transition)

        return transitions

    @factory.lazy_attribute
    def outputs(self):
        """Generate outputs for Moore machines."""
        if self.fsm_type == 'moore':
            bit_width = max(2, (len(self.states) - 1).bit_length())
            return {
                state: format(i, f'0{bit_width}b')
                for i, state in enumerate(self.states)
            }
        return None


class CategoryFactory(factory.Factory):
    """Factory for generating category test data."""

    class Meta:
        model = dict

    name = factory.LazyAttribute(lambda _: fake.word().capitalize())
    slug = factory.LazyAttribute(lambda obj: obj.name.lower())
    description = factory.LazyAttribute(lambda _: fake.sentence())
    level = fuzzy.FuzzyInteger(0, 3)


class OptimizationRequestFactory(factory.Factory):
    """Factory for generating optimization request data."""

    class Meta:
        model = dict

    algorithm = fuzzy.FuzzyChoice(['greedy', 'bfs_optimal', 'global_sa', 'global_ga'])
    async_mode = fuzzy.FuzzyChoice([True, False])

    @factory.lazy_attribute
    def options(self):
        """Generate algorithm-specific options."""
        base_options = {
            "timeout_ms": random.randint(5000, 30000)
        }

        if self.algorithm in ['global_sa', 'global_ga']:
            base_options["max_iterations"] = random.randint(100, 5000)

        if self.algorithm == 'global_sa':
            base_options["temperature"] = random.uniform(50.0, 150.0)

        if self.algorithm == 'global_ga':
            base_options["population_size"] = random.randint(50, 200)

        return base_options


class ExportRequestFactory(factory.Factory):
    """Factory for generating export request data."""

    class Meta:
        model = dict

    format = fuzzy.FuzzyChoice(['verilog', 'vhdl', 'json', 'csv', 'testbench'])

    @factory.lazy_attribute
    def options(self):
        """Generate format-specific options."""
        options = {}

        if self.format in ['verilog', 'vhdl', 'testbench']:
            options["module_name"] = f"fsm_{fake.word()}"
            options["include_comments"] = random.choice([True, False])
            options["style"] = random.choice(['standard', 'compact', 'verbose'])

        return options


def generate_batch_fsms(count: int = 10) -> List[Dict]:
    """Generate a batch of FSMs."""
    return [FSMFactory() for _ in range(count)]


def generate_test_dataset() -> Dict:
    """Generate a complete test dataset."""
    return {
        "fsms": generate_batch_fsms(20),
        "categories": [CategoryFactory() for _ in range(5)],
        "optimization_requests": [OptimizationRequestFactory() for _ in range(10)],
        "export_requests": [ExportRequestFactory() for _ in range(10)]
    }


if __name__ == "__main__":
    # Generate and print sample data
    dataset = generate_test_dataset()

    print("Generated Test Dataset:")
    print(f"FSMs: {len(dataset['fsms'])}")
    print(f"Categories: {len(dataset['categories'])}")
    print(f"Optimization Requests: {len(dataset['optimization_requests'])}")
    print(f"Export Requests: {len(dataset['export_requests'])}")

    # Save to file
    import json
    with open('test_dataset.json', 'w') as f:
        json.dump(dataset, f, indent=2)

    print("\nTest dataset saved to test_dataset.json")
