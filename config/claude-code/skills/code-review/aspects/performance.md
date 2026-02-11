# Performance

Identify performance concerns in the changeset.

## Checklist

### 1. Algorithmic complexity

- New loops or recursive calls: what is the time complexity? Is it appropriate
  for the expected input size?
- Nested iterations over collections: is this O(n^2) or worse where O(n) or
  O(n log n) is achievable?
- Sorting or searching: are efficient data structures and algorithms used?

### 2. Database and I/O

- N+1 queries: does the code issue queries inside a loop instead of batching?
- Missing indexes: does a new query filter or sort on columns that may lack
  indexes?
- Unbounded queries: is there a LIMIT or pagination mechanism?
- Large payloads: are responses and reads bounded in size?

### 3. Memory and allocations

- Allocations in hot loops: string concatenation, temporary collections,
  boxing or wrapping.
- Unbounded collections: does a new collection grow without a size cap?
- Large copies: are large structures copied where a reference or borrow would
  suffice?

### 4. Concurrency and blocking

- Blocking calls in async context: synchronous I/O, sleep, or CPU-heavy work
  on an async runtime's thread pool.
- Lock contention: is a mutex or lock held across I/O or expensive
  computation?
- Thread, goroutine, or task spawning: is it bounded?

### 5. Caching and redundancy

- Repeated expensive computations: could results be cached or memoized?
- Redundant I/O: is the same file, API, or database queried multiple times
  when once would suffice?
- Cache invalidation: if caching is added, is invalidation correct?

### 6. Resource cleanup

- Connections, file handles, streams: are they closed or released promptly
  after use?
- Temporary files or buffers: are they cleaned up in all code paths?
