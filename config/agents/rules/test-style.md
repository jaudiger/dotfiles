# Testing practices

PREFER extending an existing test when it covers the same behavior and setup. Create a focused new test for different behavior or setup. Keep each test focused on one logical behavior; multiple assertions are fine when they verify facets of that behavior. Keep tests minimal and arrange only what the test needs. Avoid branching and computed test setup or expectations. Table-driven and parameterized tests may use iteration. Do not add a helper abstraction for a single test. Prefer literal expected values so results are obvious at a glance.
