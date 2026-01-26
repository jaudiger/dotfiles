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
      programs.java = {
        enable = true;
        package = pkgs.jdk21_headless;
      };

      home.packages = with pkgs; [ maven ];

      # Neovim configuration
      programs.nixvim = {
        plugins.lsp.servers = {
          jdtls = {
            enable = true;
            settings = jdtlsConfig;
          };
        };
      };

      # Zed configuration
      programs.zed-editor.userSettings = {
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
}
