# C: Language-Specific Patterns

## Valid concerns

leaks, uaf, deadlocks, races, oom, lifecycle, overflow, error-handling, ub, injection

## Allocation and resource patterns

- `malloc`, `calloc`, `realloc`, `aligned_alloc` paired with `free`. Check every path.
- `strdup`, `strndup`, `asprintf` paired with `free`. Often forgotten.
- `fopen` paired with `fclose`. `fdopen` paired with `fclose`. `open` paired with `close`. `socket` paired with `close`.
- `mmap` paired with `munmap`. `shm_open` paired with `shm_unlink` + `close`.
- `realloc(ptr, new_size)`: if it returns NULL, `ptr` is still valid. If the return is stored in `ptr`, the old pointer is lost; leak.
- Goto-cleanup pattern: verify every error goto reaches the cleanup that frees resources acquired before the error.
- `free(NULL)` is safe; double-free is UB.

## Pointer and memory patterns

- Dangling pointer after `free()`: assign NULL after free to make reuse crash instead of corrupt.
- `realloc` invalidates the old pointer even on success. All aliases are dangling.
- Returning pointer to stack-local (array, struct); always UB.
- `memcpy`/`memmove` with wrong size: `sizeof(ptr)` gives pointer size, not allocation size.
- String functions: `strcpy`, `strcat`, `sprintf`: no bounds checking. Prefer `strncpy`, `strncat`, `snprintf`.
- Null terminator: verify all strings passed to string functions are null-terminated.

## Concurrency patterns

- `pthread_mutex_lock`/`pthread_mutex_unlock`. `pthread_mutex_init`/`pthread_mutex_destroy`.
- `pthread_rwlock_rdlock`/`pthread_rwlock_wrlock`/`pthread_rwlock_unlock`.
- `pthread_cond_wait`: must be in a while loop (spurious wakeup). Must hold the mutex.
- `PTHREAD_MUTEX_ERRORCHECK` returns error on self-deadlock; default type is UB on self-deadlock.
- `_Atomic` qualifier and `<stdatomic.h>` for lock-free code.
- `volatile` does NOT provide thread safety; only prevents compiler optimization.

## Error handling patterns

- Return value conventions: negative for error, 0 for success, NULL for failure.
- `errno`: must be checked immediately after the failing call (next call may overwrite).
- Check return of `printf`, `write`, `close`: these can fail.
- `setjmp`/`longjmp`: no cleanup of stack frames. Resources allocated between setjmp and longjmp are leaked.

## Integer and UB patterns

- Signed overflow: UB. Compilers optimize assuming it does not happen (`if (x + 1 < x)` is optimized away).
- Integer promotion rules: `uint8_t + uint8_t` promotes to `int`. Mixed signed/unsigned comparisons.
- `size_t` is unsigned: `size_t x = -1` produces SIZE_MAX.
- Shift by >= bit width: UB. Shift of negative signed: UB.
- Strict aliasing: accessing memory through a pointer of incompatible type is UB (except via `char *`).
- Sequence points: `i++ + i++` is UB. Multiple modifications without intervening sequence point.
- Union type punning: technically UB in C89, defined in C99/C11 (but check compiler).
- `restrict` qualifier: if two restrict pointers alias, UB.

## Injection patterns

- `system()`, `popen()`: shell command injection. Use `execve` with argument array instead.
- `snprintf` into SQL query; use parameterized queries.
- Format string attacks: `printf(user_input)` instead of `printf("%s", user_input)`.
- Path traversal: `snprintf(path, ..., "%s/%s", base, user_input)`: check for `..`, symlinks.
