# Java — Testing Patterns

## Valid practices

branch-coverage, edge-cases, assertions, isolation, negative-testing, mutation-resistance

## Version and framework detection

- **Language version**: read `pom.xml` (`<java.version>`, `<maven.compiler.source>`, `<maven.compiler.release>`), `build.gradle` / `build.gradle.kts` (`sourceCompatibility`, `targetCompatibility`, `jvmToolchain`), or `.java-version`.
- **Test framework**: check build file dependencies:
  - JUnit 5 (`org.junit.jupiter`) — look for `@Test` from `org.junit.jupiter.api.Test`.
  - JUnit 4 (`junit:junit`) — look for `@Test` from `org.junit.Test`.
  - TestNG — look for `org.testng` imports.
  - Do NOT confuse JUnit 4 and JUnit 5 — their annotations and assertions are incompatible packages.
- **Assertion and mock libraries**: check imports and dependencies for:
  - `org.assertj` — fluent assertions.
  - `org.hamcrest` — matcher-based assertions.
  - `org.mockito` — mocking framework (check major version for API differences).
  - `io.mockk` — Kotlin mocking (in mixed projects).
  - `org.wiremock` — HTTP stubbing.
  - `net.jqwik` — property-based testing.
  - `org.awaitility` — async testing utilities.
  - `org.testcontainers` — container-based integration tests.
- **Spring Boot**: if `spring-boot-starter-test` is present, check for `@SpringBootTest`, `@WebMvcTest`, `@DataJpaTest`, `@MockBean`, `@SpyBean`. These annotations control the test context and determine what is real vs mocked.

## Test file conventions

- Test files in `src/test/java/` mirroring the source package structure.
- Class name: `XxxTest` or `XxxTests` (JUnit 5), `XxxTest` (JUnit 4).
- Methods annotated with `@Test`, `@ParameterizedTest`, `@RepeatedTest`.
- Lifecycle: `@BeforeEach`, `@AfterEach`, `@BeforeAll`, `@AfterAll` (JUnit 5) vs `@Before`, `@After` (JUnit 4).
- Nested tests: `@Nested` inner classes for grouping related tests.

## Language-specific patterns

### JUnit 5 vs JUnit 4
- Verify the project is not mixing JUnit 4 and 5 annotations in the same test class.
- JUnit 5 `@Test` does not support `expected` parameter — use `assertThrows()` instead.
- JUnit 5 `assertAll()` for grouped assertions that report all failures, not just the first.
- `@DisplayName` for readable test names (complements method names, does not replace good naming).

### Exception testing
- Use `assertThrows(SpecificException.class, () -> ...)` and assert on the returned exception.
- Do NOT use `@Test(expected = ...)` (JUnit 4) or try/catch with `fail()` — these are weaker patterns.
- Verify the exception message and cause when they are part of the contract.

### Parameterized tests
- `@ParameterizedTest` with `@MethodSource`, `@CsvSource`, `@ValueSource`, `@EnumSource`.
- Check that parameter sources cover edge cases, not just typical values.
- Verify the display name includes the parameter values for readable failure output.

### Mock verification
- `verify()` calls should assert meaningful interactions, not just that a method was called.
- `verifyNoMoreInteractions()` is often too strict — flag if it makes tests brittle.
- Check for mocks that are set up but never verified (unused mocking setup).
- `@InjectMocks` — verify all dependencies are accounted for; missing mocks get null-injected silently.

### Equality and comparison
- Override `equals()` / `hashCode()` testing: test symmetry, transitivity, consistency, null.
- Use `assertThat(actual).usingRecursiveComparison()` (AssertJ) for deep comparison without relying on `equals()`.
- `Comparable` implementations should be tested for consistency with `equals()`.

### Concurrency
- Tests for concurrent code should use `CountDownLatch`, `CyclicBarrier`, or `CompletableFuture` for synchronization — not `Thread.sleep()`.
- Verify thread-safety tests actually interleave operations (a test that runs sequentially proves nothing about concurrency).
- `@Timeout` annotation to prevent hanging tests.

### Spring context
- Minimize `@SpringBootTest` usage for unit tests — it loads the full application context.
- Use `@WebMvcTest`, `@DataJpaTest`, or `@JsonTest` for slice tests.
- Verify `@MockBean` is used intentionally and that the test actually exercises the real component's logic, not just the mock.
- Check for `@DirtiesContext` — it slows down the test suite and may indicate poor isolation.

### Resource management
- Use `try-with-resources` in tests for `AutoCloseable` resources.
- `@TempDir` (JUnit 5) for temporary directory management.
- Verify database tests use `@Transactional` with rollback or clean up after themselves.
