# Python: Testing Patterns

## Valid practices

branch-coverage, edge-cases, assertions, isolation, negative-testing, mutation-resistance

## Version and framework detection

- **Language version**: read `pyproject.toml` (`requires-python`), `setup.cfg` (`python_requires`), `.python-version`, `Pipfile`, or `runtime.txt`.
- **Test framework**: check `pyproject.toml` `[tool.pytest]` / `[tool.pytest.ini_options]`, `setup.cfg` `[tool:pytest]`, `pytest.ini`, or `tox.ini`:
  - `pytest`: dominant framework, look for `conftest.py` files, `@pytest.mark.*` decorators.
  - `unittest`: stdlib, look for `class XxxTest(unittest.TestCase)`.
  - `doctest`: inline tests in docstrings.
  Do NOT mix `pytest` and `unittest` style assertions in the same test unless the project does so intentionally.
- **Test utility libraries**: check `pyproject.toml` or `requirements-dev.txt` for:
  - `pytest-mock` / `unittest.mock`: mocking.
  - `pytest-asyncio` / `anyio`: async test support.
  - `hypothesis`: property-based testing.
  - `responses` / `aioresponses`: HTTP mocking.
  - `freezegun` / `time-machine`: time mocking.
  - `factory-boy` / `faker`: test data generation.
  - `pytest-django` / `pytest-flask` / `pytest-fastapi`: framework integration.
  - `coverage` / `pytest-cov`: coverage reporting.
- **Version-sensitive features**: check Python version before recommending:
  - `match`/`case` statements; check availability.
  - `ExceptionGroup` and `except*`: check availability.
  - Type annotation features (`TypeGuard`, `Self`, `override`); check availability.
  Read actual imports in test files to confirm what is used.

## Test file conventions

- Test files: `test_*.py` or `*_test.py` (configurable in pytest).
- Test functions: `def test_xxx():` (pytest) or `def test_xxx(self):` in `TestCase` subclass.
- Fixtures: `@pytest.fixture` in `conftest.py` or test modules.
- Parametrize: `@pytest.mark.parametrize("arg", [...])`.
- Markers: `@pytest.mark.slow`, `@pytest.mark.integration`, `@pytest.mark.skip`.

## Language-specific patterns

### Pytest fixtures and scope
- Fixtures with `scope="session"` or `scope="module"` share state across tests; verify this is intentional and does not create ordering dependencies.
- `autouse=True` fixtures run for every test; check they do not introduce unexpected side effects.
- Verify fixture teardown: `yield`-based fixtures must have their cleanup code after `yield`. Check that cleanup runs even if the test fails.
- Fixture dependencies: deeply nested fixture chains can obscure test setup. Verify the full dependency tree is understandable.

### Exception testing
- Use `pytest.raises(SpecificException)` as a context manager.
- Verify the `match` parameter or assert on `exc_info.value` attributes; not just the exception type.
- Do NOT use bare `try/except` with `pytest.fail()`: the context manager is clearer and less error-prone.
- For `unittest`: use `self.assertRaises()` or `self.assertRaisesRegex()`.

### Mocking
- `unittest.mock.patch` as decorator or context manager; verify the patch target is the correct import path (patch where it is used, not where it is defined).
- `MagicMock` accepts any attribute access and any call; tests using `MagicMock` without `spec` or `spec_set` will not detect API changes in the mocked object.
- `autospec=True`: verify mocks match the real object's signature.
- Check for mocks that are patched but never asserted on (unused mocks).

### Parametrized tests
- `@pytest.mark.parametrize`: check that parameter sets cover edge cases.
- Use `pytest.param(..., id="descriptive_name")` for readable test IDs.
- Combining multiple `@pytest.mark.parametrize` decorators creates a cross-product; verify this is intentional.

### Async testing
- `pytest-asyncio`: verify `@pytest.mark.asyncio` or `asyncio_mode = "auto"` in config.
- Check that async fixtures use `@pytest_asyncio.fixture`, not `@pytest.fixture`.
- Verify async tests actually `await` the code under test.

### Type checking in tests
- If the project uses `mypy` or `pyright`, check whether tests are type-checked too.
- Tests using `Any` or `# type: ignore` weaken the type safety that the test should verify.
- For runtime type checking (`beartype`, `typeguard`), verify tests exercise typed boundaries.

### Django/Flask/FastAPI specifics
- Django: `TestCase` vs `TransactionTestCase` vs `SimpleTestCase`: verify the correct base class for the test's needs.
- Django: `Client` vs `RequestFactory`: verify the right tool for the level of testing.
- Flask: use `app.test_client()` and `app.test_request_context()`.
- FastAPI: use `TestClient` (sync) or `AsyncClient` (httpx) with dependency overrides.

### Determinism
- Tests should not depend on dictionary ordering (guaranteed in modern Python but relying on it for test assertions with older `dict` is fragile).
- Tests should not depend on set iteration order.
- Random seed control: verify `random.seed()` or `hypothesis` settings for reproducibility.
