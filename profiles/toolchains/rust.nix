{
  inputs,
  config,
  pkgs,
  lib,
  ...
}:

let
  isDarwin = config.nixpkgs.hostPlatform.isDarwin;

  # Shared LSP configuration for rust-analyzer
  rustAnalyzerConfig = {
    cargo = {
      allTargets = true;
      features = "all";
    };
    check = {
      allTargets = true;
      command = "clippy";
    };
    completion = {
      snippets = {
        custom = {
          # Miscellaneous snippets
          "struct impl" = {
            prefix = "struct-impl";
            body = [
              "struct \${1:name} {"
              "    $0"
              "}"
              ""
              "impl $1 {"
              "}"
            ];
            description = "Insert a struct with its implementation statement";
            scope = "item";
          };
          "enum impl" = {
            prefix = "enum-impl";
            body = [
              "enum \${1:name} {"
              "    $0"
              "}"
              ""
              "impl $1 {"
              "}"
            ];
            description = "Insert a enum with its implementation statement";
            scope = "item";
          };
          "enum error impl" = {
            prefix = "enum-error-impl";
            body = [
              "#[derive(Debug, thiserror::Error)]"
              "enum \${1:name} {"
              "    #[error(\"\")]"
              "    $0"
              "}"
            ];
            description = "Insert a enum error statement";
            scope = "item";
          };
          "derive" = {
            prefix = "derive";
            body = [
              "#[derive($0)]"
            ];
            description = "Insert a derive statement";
            scope = "item";
          };
          # Async snippets
          "std thread spawn" = {
            prefix = [ "std-spawn" ];
            body = [
              "thread::spawn(move || {"
              "    $0"
              "});"
            ];
            description = "Insert a std::thread::spawn statement";
            requires = [ "std::thread" ];
            scope = "expr";
          };
          "Tokio async main" = {
            prefix = [ "tokio-main" ];
            body = [
              "#[tokio::main]"
              "async fn main() -> Result<(), Box<dyn std::error::Error>> {"
              "    $0"
              "}"
            ];
            description = "Insert a Tokio async main";
            scope = "item";
          };
          # Test snippets
          "tests" = {
            prefix = "tests";
            body = [
              "#[cfg(test)]"
              "mod tests {"
              "    use super::*;"
              ""
              "    $0"
              "}"
            ];
            description = "Insert a test module";
            scope = "item";
          };
          "unit test" = {
            prefix = "test";
            body = [
              "#[test]"
              "fn \${1:name}() {"
              "    // Given"
              "    $0todo!();"
              ""
              "    // When"
              "    let result = todo!();"
              ""
              "    // Then"
              "    assert!(result);"
              "}"
            ];
            description = "Insert a test statement";
            scope = "item";
          };
        };
      };
    };
    imports = {
      granularity = {
        group = "item";
      };
    };
    inlayHints = {
      closingBraceHints = {
        enable = false;
      };
      closureReturnTypeHints = {
        enable = "always";
      };
      closureStyle = "rust_analyzer";
      discriminantHints = {
        enable = "fieldless";
      };
      expressionAdjustmentHints = {
        enable = "never";
      };
      implicitDrops = {
        enable = true;
      };
      lifetimeElisionHints = {
        enable = "skip_trivial";
      };
      parameterHints = {
        enable = true;
      };
      typeHints = {
        enable = true;
      };
    };
    lens = {
      references = {
        adt = {
          enable = true;
        };
        enumVariant = {
          enable = true;
        };
        method = {
          enable = true;
        };
        trait = {
          enable = true;
        };
      };
    };
    references = {
      excludeImports = true;
      excludeTests = true;
    };
    rust = {
      analyzerTargetDir = true;
    };
    testExplorer = true;
  };
in
{
  nixpkgs.overlays = [ inputs.rust-overlay.overlays.default ];

  modules.home-manager = {
    programs.cargo = {
      enable = true;

      # It will be provided by the overlay.
      package = null;

      settings = {
        cache = {
          auto-clean-frequency = "7 days";
        };
      };
    };

    home = {
      packages = with pkgs; [
        (rust-bin.stable.latest.minimal.override {
          extensions = [
            "clippy"
            "rustfmt"
            "rust-src"
            "llvm-tools-preview"
          ];
        })

        (pkgs.lib.setPrio 10 rustup) # Lower priority to prevent collision with the rust-based packages.

        libllvm
        rust-analyzer
        pkg-config
        grcov

        cargo-audit
        cargo-binutils
        cargo-bloat
        cargo-edit
        cargo-mutants
        cargo-msrv
        cargo-udeps

        tokio-console
      ];

      sessionVariables =
        with pkgs;
        lib.mkMerge [
          (lib.mkIf isDarwin {
            LIBRARY_PATH = "$LIBRARY_PATH\${LIBRARY_PATH:+:}" + "${darwin.libiconv}/lib";
          })
        ];
    };

    # Neovim configuration
    programs.nixvim = {
      plugins.lsp.servers = {
        rust_analyzer = {
          enable = true;
          installCargo = false;
          installRustc = false;
          settings = rustAnalyzerConfig;
        };
      };
    };

    # Zed configuration
    programs.zed-editor.userSettings = {
      lsp = {
        "rust-analyzer" = {
          initialization_options = rustAnalyzerConfig;
        };
      };
    };
  };
}
