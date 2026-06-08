{ pkgs, ... }:

let
  # Shared LSP configuration for jdtls
  jdtlsConfig = {
    java = {
      autobuild = {
        enabled = true;
      };
      configuration = {
        updateBuildConfiguration = "interactive";
      };
      implementationsCodeLens = {
        enabled = true;
      };
      import = {
        gradle = {
          enabled = true;
        };
        maven = {
          enabled = true;
        };
      };
      jdt = {
        ls = {
          lombokSupport = {
            enabled = true;
          };
        };
      };
      referencesCodeLens = {
        enabled = true;
      };
      signatureHelp = {
        enabled = true;
      };
    };
  };
in
{
  modules = {
    home-manager = {
      home.packages = with pkgs; [ maven ];

      programs = {
        java = {
          enable = true;
          package = pkgs.jdk21_headless;
        };

        # Neovim configuration
        nixvim = {
          plugins.lsp.servers = {
            jdtls = {
              enable = true;
              settings = jdtlsConfig;
            };
          };
        };

        # Claude Code configuration
        claude-code = {
          lspServers = {
            jdtls = {
              command = "jdtls";
              extensionToLanguage = {
                ".java" = "java";
              };
            };
          };
        };

        # Opencode configuration
        opencode = {
          settings = {
            lsp = {
              jdtls = {
                command = [ "jdtls" ];
                initialization = jdtlsConfig;
              };
            };
          };
        };

        # Zed configuration
        zed-editor = {
          userSettings = {
            lsp = {
              jdtls = {
                initialization_options = {
                  settings = jdtlsConfig;
                };
              };
            };
          };
        };
      };
    };
  };
}
