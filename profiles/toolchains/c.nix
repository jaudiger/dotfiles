{
  config,
  pkgs,
  lib,
  ...
}:

let
  isDarwin = config.nixpkgs.hostPlatform.isDarwin;
  isLinux = config.nixpkgs.hostPlatform.isLinux;
in
{
  modules = {
    home-manager.home = {
      packages =
        with pkgs;
        [
          autoconf
          pkg-config
          gnumake
          cmake
          clang-tools
          ninja
          cppcheck
          gcovr
          jemalloc
        ]
        ++ lib.optionals isLinux [
          gcc
          gdb
          valgrind-light
        ]
        ++ lib.optionals isDarwin [ clang ];
    };

    home-manager = {
      # Neovim configuration
      programs.nixvim = {
        plugins.lsp.servers = {
          clangd = {
            enable = true;
          };
        };
      };

      # Claude Code configuration
      programs.claude-code.lspServers = {
        clangd = {
          command = "clangd";
          extensionToLanguage = {
            ".c" = "c";
            ".h" = "c";
            ".cpp" = "cpp";
            ".cc" = "cpp";
            ".cxx" = "cpp";
            ".hpp" = "cpp";
          };
        };
      };
    };

    host.shell.aliases = lib.mkMerge [
      {
        # Cppcheck
        c-analyzer = "cppcheck --std=c11 --std=c++20 --enable=all --check-level=exhaustive --force --suppress=missingIncludeSystem --suppress=missingInclude --suppress=unusedFunction -i./cmake-build-debug -i./cmake-build-release -i./build";
      }

      (lib.mkIf isLinux {
        # Valgrind
        vg = "valgrind --read-inline-info=yes --read-var-info=yes --leak-check=full --track-origins=yes --show-leak-kinds=all";
        vgmemory = "valgrind --tool=massif --time-unit=B --depth=32 --alloc-fn=mmap --alloc-fn=syscall --alloc-fn=pages_map --alloc-fn=chunk_alloc --alloc-fn=malloc --alloc-fn=realloc --max-snapshots=512";
        vgmemory-heap = "vgmemory --pages-as-heap=yes";
        vgmemory-stack = "vgmemory --stacks=yes";
        vgthread = "valgrind --tool=helgrind --free-is-write=yes";
        vggdb = "valgrind --leak-check=full --vgdb=yes --vgdb-error=0";
      })
    ];
  };
}
